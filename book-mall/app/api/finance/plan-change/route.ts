import { NextRequest } from "next/server";

import {
  canCreateProposal,
  canFinalApprove,
  canFinanceReview,
  canViewFinanceCost,
} from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  createProposal,
  listProposals,
  runSimulation,
  transitionProposal,
  type ProposalPayload,
} from "@/lib/pricing/plan-change-service";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 列出调价提案（运营及以上）。成本字段按权限裁剪。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canCreateProposal(user.role)) return financeForbidden(request, "需要运营及以上权限");

  const showCost = canViewFinanceCost(user.role);
  const take = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 50)));
  const proposals = await listProposals(take);

  return financeJson(request, {
    proposals: proposals.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      marginPassed: p.marginPassed,
      createdBy: p.createdBy,
      createdAt: p.createdAt.toISOString(),
      payload: p.payload,
      simulation: showCost ? p.simulation : null,
      reverseCheck: showCost ? p.reverseCheck : null,
      rejectedReason: p.rejectedReason,
      events: p.events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorRole: e.actorRole,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
    canViewCost: showCost,
  });
}

type ActionBody = {
  action: string;
  id?: string;
  title?: string;
  model?: string;
  videoMarginM?: number;
  guard?: number;
  targetMargin?: number;
  note?: string;
};

/** 调价提案写操作（创建/测算/审批流）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return financeJson(request, { ok: false, error: "无效 JSON" }, { status: 400 });
  }

  const { action } = body;

  try {
    switch (action) {
      case "createAndSimulate": {
        if (!canCreateProposal(user.role)) return financeForbidden(request);
        if (!body.title?.trim()) return financeJson(request, { ok: false, error: "请填写提案标题" });
        const payload: ProposalPayload = {
          model: body.model,
          videoMarginM: body.videoMarginM,
          guard: body.guard,
          targetMargin: body.targetMargin,
        };
        const proposal = await createProposal({
          title: body.title.trim(),
          payload,
          createdBy: user.id,
          actorRole: user.role,
        });
        await runSimulation({ proposalId: proposal.id, actorId: user.id, actorRole: user.role });
        return financeJson(request, { ok: true, id: proposal.id });
      }
      case "reSimulate": {
        if (!canCreateProposal(user.role)) return financeForbidden(request);
        if (!body.id) return financeJson(request, { ok: false, error: "缺少提案 id" });
        await runSimulation({ proposalId: body.id, actorId: user.id, actorRole: user.role });
        return financeJson(request, { ok: true });
      }
      case "submitForReview": {
        if (!canCreateProposal(user.role)) return financeForbidden(request);
        if (!body.id) return financeJson(request, { ok: false, error: "缺少提案 id" });
        await transitionProposal({
          proposalId: body.id,
          to: "FINANCE_REVIEW",
          actorId: user.id,
          actorRole: user.role,
          note: "提交财务复核",
        });
        return financeJson(request, { ok: true });
      }
      case "financeApprove": {
        if (!canFinanceReview(user.role)) return financeForbidden(request);
        if (!body.id) return financeJson(request, { ok: false, error: "缺少提案 id" });
        await transitionProposal({
          proposalId: body.id,
          to: "APPROVED",
          actorId: user.id,
          actorRole: user.role,
          note: "财务复核通过",
        });
        return financeJson(request, { ok: true });
      }
      case "financeReject": {
        if (!canFinanceReview(user.role)) return financeForbidden(request);
        if (!body.id) return financeJson(request, { ok: false, error: "缺少提案 id" });
        await transitionProposal({
          proposalId: body.id,
          to: "REJECTED",
          actorId: user.id,
          actorRole: user.role,
          rejectedReason: body.note ?? "财务复核驳回",
          note: body.note ?? "财务复核驳回",
        });
        return financeJson(request, { ok: true });
      }
      case "finalApprove": {
        if (!canFinalApprove(user.role)) return financeForbidden(request);
        if (!body.id) return financeJson(request, { ok: false, error: "缺少提案 id" });
        await transitionProposal({
          proposalId: body.id,
          to: "EFFECTIVE",
          actorId: user.id,
          actorRole: user.role,
          note: "超管终审生效",
        });
        return financeJson(request, { ok: true });
      }
      case "cancel": {
        if (!canCreateProposal(user.role)) return financeForbidden(request);
        if (!body.id) return financeJson(request, { ok: false, error: "缺少提案 id" });
        await transitionProposal({
          proposalId: body.id,
          to: "CANCELLED",
          actorId: user.id,
          actorRole: user.role,
          note: "撤销提案",
        });
        return financeJson(request, { ok: true });
      }
      default:
        return financeJson(request, { ok: false, error: `未知操作: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return financeJson(request, { ok: false, error: e instanceof Error ? e.message : "操作失败" });
  }
}
