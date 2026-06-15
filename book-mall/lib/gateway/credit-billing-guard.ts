/**
 * 统一积分计费 — 凭证/模型绑定校验 + 成本快照（unified-credit-billing 防护）
 *
 * 目标（你的第 1 点：绑错 key 影响盈亏）：
 *  - 绑定校验：模型路由到某凭证时，校验 credential.vendor === model.vendor 且存在生效中的 ModelCostProfile；
 *    否则阻断生成 + 告警。
 *  - 成本快照：每次生成把 costSnapshotYuan / marginSnapshot 写入日志，事后绑错可追溯。
 */
import type { CreditCostUnit, GatewayProviderKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { libNanoProCanonicalFromModelKey } from "@/lib/billing/lib-nano-pro-canonical";
import { resolveSbv1BillingCanonicalFromInputSummary } from "@/lib/gateway/log-pricing-hints";
import { canonicalKeyForAlias } from "@/lib/model-catalog/resolve";
import {
  computeBaseMarginRate,
  DEFAULT_CREDIT_ANCHOR_YUAN,
} from "@/lib/pricing/credit-pricing-formulas";

/** providerKind → 财务口径 vendor（与 ModelCatalog.vendor / ModelCostProfile.vendor 对齐） */
export function vendorForProviderKind(kind: GatewayProviderKind): string {
  switch (kind) {
    case "KIE":
      return "kie";
    case "BAILIAN":
    case "DASHSCOPE":
      return "aliyun";
    case "VOLCENGINE":
      return "volcengine";
    case "HUNYUAN":
      return "tencent";
    case "DEEPSEEK":
      return "deepseek";
    default:
      return String(kind).toLowerCase();
  }
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 把厂商模型字串归口到 canonicalModelKey。
 * 顺序：① 直接命中成本档/报价的 canonicalModelKey；② ModelAlias（SCHEME_A / 产品名）。
 */
export async function resolveCanonicalModelKey(modelKey: string): Promise<string | null> {
  const v = modelKey.trim();
  if (!v) return null;

  const direct = await prisma.modelCostProfile.findFirst({
    where: { canonicalModelKey: v, active: true },
    select: { canonicalModelKey: true },
  });
  if (direct) return direct.canonicalModelKey;

  for (const source of ["INTERNAL_SCHEME_A_MODEL", "VENDOR_PRODUCT_NAME", "PRICE_MD_LABEL"] as const) {
    const hit = await canonicalKeyForAlias({ source, aliasValue: v });
    if (hit) return hit;
  }
  return null;
}

/**
 * 计费归口：sbv1 分档 variant → tier canonical；否则 modelKey 别名。
 */
export async function resolveBillingCanonicalKey(input: {
  modelKey: string;
  inputSummary?: unknown;
}): Promise<string | null> {
  const fromSbv1 = resolveSbv1BillingCanonicalFromInputSummary(
    input.inputSummary,
    input.modelKey,
  );
  if (fromSbv1) return fromSbv1;

  const canonical = await resolveCanonicalModelKey(input.modelKey);
  if (canonical === "lib-nano-pro") {
    return (
      libNanoProCanonicalFromModelKey(input.modelKey, null) ?? "lib-nano-pro-2k"
    );
  }
  return canonical;
}

export interface CostSnapshot {
  canonicalModelKey: string;
  netCostYuan: number;
  marginRate: number | null;
  creditsPerUnit: number | null;
  /** 单位挂牌价（元/秒、元/张、元/千token），逐档积分换算用 */
  listPriceYuan: number | null;
  unit: CreditCostUnit | null;
  vendor: string;
}

/**
 * 取某模型当前生效的成本快照（优先 CHANNEL 折扣档），用于日志审计与积分扣费。
 * 找不到成本档返回 null（由调用方决定是否阻断）。
 */
export async function resolveCostSnapshot(canonicalModelKey: string): Promise<CostSnapshot | null> {
  const now = new Date();
  const profiles = await prisma.modelCostProfile.findMany({
    where: {
      canonicalModelKey,
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
  });
  if (profiles.length === 0) return null;

  const rank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
  const chosen = [...profiles].sort((a, b) => {
    const r = (rank[a.channel] ?? 9) - (rank[b.channel] ?? 9);
    if (r !== 0) return r;
    return num(a.netCostYuan) - num(b.netCostYuan);
  })[0];

  const price = await prisma.modelCreditPrice.findUnique({ where: { canonicalModelKey } });
  const anchor = DEFAULT_CREDIT_ANCHOR_YUAN;
  const creditsPerUnit = price?.creditsPerUnit ?? null;
  const marginRate =
    creditsPerUnit != null
      ? computeBaseMarginRate(num(chosen.netCostYuan), creditsPerUnit, anchor)
      : null;

  return {
    canonicalModelKey,
    netCostYuan: num(chosen.netCostYuan),
    marginRate,
    creditsPerUnit,
    listPriceYuan: price?.listPriceYuan != null ? num(price.listPriceYuan) : null,
    unit: price?.unit ?? chosen.unit ?? null,
    vendor: chosen.vendor,
  };
}

export class CredentialBindingError extends Error {
  constructor(
    public readonly reason: "VENDOR_MISMATCH" | "NO_COST_PROFILE" | "UNKNOWN_MODEL",
    message: string,
  ) {
    super(message);
    this.name = "CredentialBindingError";
  }
}

export interface BindingCheckResult {
  ok: boolean;
  reason?: CredentialBindingError["reason"];
  message?: string;
  canonicalModelKey?: string;
  snapshot?: CostSnapshot;
}

/**
 * 校验「凭证厂商 == 模型厂商」且存在生效成本档。
 * - 平台 Key（会员积分）模式应在调用前 assert，绑错直接阻断。
 * - BYOK 模式可放宽：未知模型不阻断，但仍尽量给出 canonicalKey 供日志。
 */
export async function checkCredentialModelBinding(input: {
  providerKind: GatewayProviderKind;
  modelKey: string;
  enforceCostProfile?: boolean; // 平台 Key 模式传 true
}): Promise<BindingCheckResult> {
  const vendor = vendorForProviderKind(input.providerKind);
  const canonical = await resolveCanonicalModelKey(input.modelKey);

  if (!canonical) {
    return {
      ok: !input.enforceCostProfile,
      reason: "UNKNOWN_MODEL",
      message: `模型 ${input.modelKey} 未归口到标准模型键`,
    };
  }

  const snapshot = await resolveCostSnapshot(canonical);
  if (!snapshot) {
    return {
      ok: !input.enforceCostProfile,
      reason: "NO_COST_PROFILE",
      message: `模型 ${canonical} 无生效成本档`,
      canonicalModelKey: canonical,
    };
  }

  if (snapshot.vendor !== vendor) {
    return {
      ok: false,
      reason: "VENDOR_MISMATCH",
      message: `凭证厂商(${vendor}) 与模型成本档厂商(${snapshot.vendor}) 不一致：${canonical}`,
      canonicalModelKey: canonical,
      snapshot,
    };
  }

  return { ok: true, canonicalModelKey: canonical, snapshot };
}

/** 平台 Key 模式：绑定不通过直接抛错（阻断生成）。 */
export async function assertCredentialModelBinding(input: {
  providerKind: GatewayProviderKind;
  modelKey: string;
}): Promise<{ canonicalModelKey: string; snapshot: CostSnapshot }> {
  const r = await checkCredentialModelBinding({ ...input, enforceCostProfile: true });
  if (!r.ok || !r.canonicalModelKey || !r.snapshot) {
    throw new CredentialBindingError(r.reason ?? "UNKNOWN_MODEL", r.message ?? "凭证-模型绑定校验失败");
  }
  return { canonicalModelKey: r.canonicalModelKey, snapshot: r.snapshot };
}
