/**
 * 调价提案审批流（财务 2.0 · Phase 4）— DB 状态机 + 六维测算 + 反向验算落库。
 *
 * 流转：DRAFT →(测算) SIMULATED →(提交) FINANCE_REVIEW →(财务) APPROVED/REJECTED →(超管终审) EFFECTIVE。
 * 全程写 PlanChangeEvent 留痕。测算/反向验算用 pricing-simulation 纯函数，口径与运行时扣费一致。
 */
import type { PlanChangeStatus, Prisma } from "@prisma/client";

import { deriveVideoMonthlyCredits, VIDEO_MODEL_SEEDS } from "@/lib/billing/video-model-seeds";
import { prisma } from "@/lib/prisma";
import { loadPricingConfig, publishModelCreditPrice } from "./credit-pricing-engine";
import {
  reverseBreakEven,
  reverseTargetMargin,
  simulatePlanChange,
  simulateRevenue,
  type ModelCostBasis,
  type RevenueScenario,
  type TierPricing,
} from "./pricing-simulation";

export interface ProposalPayload {
  /** 代表性模型 canonicalKey（默认 happyhorse-r2v） */
  model?: string;
  /** 拟定视频系数 M（默认取全局 videoMarginM） */
  videoMarginM?: number;
  /** 校验护栏（默认取全局 videoMinMarginGuard） */
  guard?: number;
  /** 拟定档位定价（缺省取库中 PERSONAL/MONTH） */
  tiers?: TierPricing[];
  /** 反向验算模式 A 目标毛利（默认 = guard） */
  targetMargin?: number;
  /** 营收模拟订阅量 */
  scenarios?: RevenueScenario[];
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

async function logEvent(
  proposalId: string,
  fromStatus: PlanChangeStatus | null,
  toStatus: PlanChangeStatus,
  actorId: string,
  actorRole?: string | null,
  note?: string,
) {
  await prisma.planChangeEvent.create({
    data: { proposalId, fromStatus, toStatus, actorId, actorRole: actorRole ?? null, note: note ?? null },
  });
}

export async function createProposal(input: {
  title: string;
  payload: ProposalPayload;
  createdBy: string;
  actorRole?: string | null;
}) {
  const proposal = await prisma.planChangeProposal.create({
    data: {
      title: input.title,
      status: "DRAFT",
      payload: input.payload as unknown as Prisma.InputJsonValue,
      createdBy: input.createdBy,
    },
  });
  await logEvent(proposal.id, null, "DRAFT", input.createdBy, input.actorRole, "创建提案");
  return proposal;
}

/** 解析拟定档位：payload.tiers 优先，否则取库中个人·月付五档。 */
async function resolveTiers(payload: ProposalPayload): Promise<TierPricing[]> {
  if (payload.tiers && payload.tiers.length) return payload.tiers;
  const plans = await prisma.membershipPlan.findMany({
    where: { family: "PERSONAL", interval: "MONTH", active: true },
    orderBy: { sortOrder: "asc" },
    select: { tier: true, priceYuan: true, monthlyCredits: true, includedSeats: true },
  });
  return plans.map((p) => ({
    tier: p.tier,
    priceYuan: num(p.priceYuan),
    monthlyCredits: p.monthlyCredits,
    includedSeats: p.includedSeats,
  }));
}

/** 解析代表性模型成本（CHANNEL 优先），并按拟定 M 计算单位挂牌价。 */
async function resolveModelBasis(payload: ProposalPayload, videoMarginM: number, units: number): Promise<ModelCostBasis> {
  const modelKey = payload.model ?? "happyhorse-r2v";
  const profiles = await prisma.modelCostProfile.findMany({
    where: { canonicalModelKey: modelKey, active: true },
  });
  const rank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
  const chosen = [...profiles].sort(
    (a, b) => (rank[a.channel] ?? 9) - (rank[b.channel] ?? 9) || num(a.netCostYuan) - num(b.netCostYuan),
  )[0];
  const netCostYuan = chosen ? num(chosen.netCostYuan) : 0;
  return {
    canonicalModelKey: modelKey,
    netCostYuan,
    units,
    listPriceYuan: netCostYuan * videoMarginM,
  };
}

/** 运行六维测算 + 反向验算，落库并置 SIMULATED。 */
export async function runSimulation(input: { proposalId: string; actorId: string; actorRole?: string | null }) {
  const proposal = await prisma.planChangeProposal.findUnique({ where: { id: input.proposalId } });
  if (!proposal) throw new Error("提案不存在");
  const payload = (proposal.payload ?? {}) as ProposalPayload;

  const config = await loadPricingConfig();
  const videoMarginM = payload.videoMarginM ?? config.videoMarginM;
  const guard = payload.guard ?? config.videoMinMarginGuard;
  const units = config.defaultVideoSec;

  const tiers = await resolveTiers(payload);
  const model = await resolveModelBasis(payload, videoMarginM, units);

  const report = simulatePlanChange({ tiers, model, guard });
  const revenue = payload.scenarios?.length
    ? simulateRevenue({ report, tiers, scenarios: payload.scenarios })
    : null;
  const reverseA = reverseTargetMargin({ targetMargin: payload.targetMargin ?? guard, model, tiers });
  const reverseB = reverseBreakEven({
    model,
    tiers,
    currentCreditsByTier: report.rows.map((r) => ({ tier: r.tier, creditsPerGen: r.creditsPerGen })),
  });

  const marginPassed = report.allPassed && reverseB.passed;

  const updated = await prisma.planChangeProposal.update({
    where: { id: input.proposalId },
    data: {
      status: "SIMULATED",
      marginPassed,
      simulation: { report, revenue, videoMarginM, guard, units } as unknown as Prisma.InputJsonValue,
      reverseCheck: { modeA: reverseA, modeB: reverseB } as unknown as Prisma.InputJsonValue,
    },
  });
  await logEvent(
    input.proposalId,
    proposal.status,
    "SIMULATED",
    input.actorId,
    input.actorRole,
    marginPassed ? "测算通过" : "测算未通过（毛利低于护栏）",
  );
  return updated;
}

const ALLOWED: Record<PlanChangeStatus, PlanChangeStatus[]> = {
  DRAFT: ["SIMULATED", "CANCELLED"],
  SIMULATED: ["FINANCE_REVIEW", "DRAFT", "CANCELLED"],
  FINANCE_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["EFFECTIVE", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  EFFECTIVE: [],
  CANCELLED: [],
};

export class ProposalTransitionError extends Error {
  constructor(from: PlanChangeStatus, to: PlanChangeStatus) {
    super(`提案状态不可从 ${from} 流转到 ${to}`);
    this.name = "ProposalTransitionError";
  }
}

/** 通用状态流转（带留痕 + 校验 + 关口）。 */
export async function transitionProposal(input: {
  proposalId: string;
  to: PlanChangeStatus;
  actorId: string;
  actorRole?: string | null;
  note?: string;
  rejectedReason?: string;
}) {
  const proposal = await prisma.planChangeProposal.findUnique({ where: { id: input.proposalId } });
  if (!proposal) throw new Error("提案不存在");
  if (!ALLOWED[proposal.status]?.includes(input.to)) {
    throw new ProposalTransitionError(proposal.status, input.to);
  }
  // 提交财务复核须测算通过
  if (input.to === "FINANCE_REVIEW" && !proposal.marginPassed) {
    throw new Error("测算未通过（毛利低于护栏），不可提交财务复核");
  }

  const data: Prisma.PlanChangeProposalUpdateInput = { status: input.to };
  if (input.to === "FINANCE_REVIEW") data.financeReviewedBy = undefined;
  if (input.to === "APPROVED") data.financeReviewedBy = input.actorId;
  if (input.to === "REJECTED") data.rejectedReason = input.rejectedReason ?? input.note ?? null;
  if (input.to === "EFFECTIVE") {
    data.approvedBy = input.actorId;
    data.effectiveAt = new Date();
  }

  const updated = await prisma.planChangeProposal.update({ where: { id: input.proposalId }, data });
  await logEvent(input.proposalId, proposal.status, input.to, input.actorId, input.actorRole, input.note);

  if (input.to === "EFFECTIVE") {
    await applyEffectiveProposal(input.proposalId, input.actorId);
  }

  return updated;
}

function derivePricePerCredit(priceYuan: number, monthlyCredits: number, includedSeats: number): number {
  const denom = Math.max(1, includedSeats) * monthlyCredits;
  if (denom <= 0) return 0;
  return Math.round((priceYuan / denom) * 1e6) / 1e6;
}

/** 审批生效：写回套餐、全局视频参数，并重发布视频模型报价。 */
export async function applyEffectiveProposal(proposalId: string, actorId: string): Promise<void> {
  const proposal = await prisma.planChangeProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new Error("提案不存在");
  const payload = (proposal.payload ?? {}) as ProposalPayload;

  if (payload.videoMarginM != null || payload.guard != null) {
    await prisma.platformPricingConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        creditAnchorYuan: 0.04,
        defaultMarginM: 2.5,
        minMarginGuard: 0.3,
        defaultVideoSec: 15,
        videoMarginM: payload.videoMarginM ?? 4,
        videoMinMarginGuard: payload.guard ?? 0.75,
      },
      update: {
        ...(payload.videoMarginM != null ? { videoMarginM: payload.videoMarginM } : {}),
        ...(payload.guard != null ? { videoMinMarginGuard: payload.guard } : {}),
      },
    });
  }

  const tiers = payload.tiers?.length ? payload.tiers : await resolveTiers(payload);
  for (const t of tiers) {
    const includedSeats = t.includedSeats ?? 1;
    const videoMonthlyCredits = deriveVideoMonthlyCredits(t.monthlyCredits);
    const pricePerCreditYuan = derivePricePerCredit(t.priceYuan, t.monthlyCredits, includedSeats);
    await prisma.membershipPlan.updateMany({
      where: { family: "PERSONAL", interval: "MONTH", tier: t.tier },
      data: {
        priceYuan: t.priceYuan,
        monthlyCredits: t.monthlyCredits,
        videoMonthlyCredits,
        pricePerCreditYuan,
        includedSeats,
      },
    });
  }

  for (const v of VIDEO_MODEL_SEEDS) {
    try {
      await publishModelCreditPrice({
        canonicalModelKey: v.canonicalModelKey,
        displayName: v.displayName,
        publishedBy: actorId,
      });
    } catch {
      /* 毛利护栏拦截时跳过单行 */
    }
  }

  await logEvent(proposalId, "EFFECTIVE", "EFFECTIVE", actorId, null, "写回套餐与视频报价");
}

export async function listProposals(take = 50) {
  return prisma.planChangeProposal.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
}

export async function getProposal(id: string) {
  return prisma.planChangeProposal.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
}
