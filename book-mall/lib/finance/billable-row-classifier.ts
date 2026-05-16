import type { PricingBillingKind } from "@prisma/client";

/**
 * 给一行 `ToolBillablePrice` 解析其 `billingKind / tierRaw`。
 *
 * 历史数据里 `cloudBillingKind / cloudTierRaw` 多为 NULL（v002 才加这两列），
 * 此处用三级 fallback 兜底，让 UI 立即可见正确的「计价标准/单位」：
 * 1. 优先用 row.cloudBillingKind（v002 之后的真源）
 * 2. 否则用 PricingSourceLine 反查（按 modelKey），拿到现行价目源里同一模型的 billingKind / tierRaw
 * 3. 否则按 toolKey 前缀启发式（image-to-video → VIDEO_MODEL_SPEC 等）
 *
 * 任意一行若三级都拿不到答案，最后返回 `billingKind=null`；UI 仍会显示「—」，不影响计费。
 */
export type ClassifyInput = {
  toolKey: string;
  schemeARefModelKey: string | null;
  cloudModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: PricingBillingKind | null;
};

export type ClassifyOutput = {
  billingKind: PricingBillingKind | null;
  tierRaw: string | null;
  /** 该结果来自哪个层级，便于审计/回填脚本日志 */
  source: "billable" | "source-line" | "heuristic" | "unknown";
};

export type SourceLineRef = {
  modelKey: string;
  tierRaw: string | null;
  billingKind: PricingBillingKind;
};

function heuristicFromToolKey(toolKey: string): PricingBillingKind | null {
  if (toolKey.startsWith("image-to-video")) return "VIDEO_MODEL_SPEC";
  if (toolKey.startsWith("text-to-image")) return "OUTPUT_IMAGE";
  if (toolKey.startsWith("fitting-room")) return "COST_PER_IMAGE";
  if (toolKey.startsWith("visual-lab")) return "TOKEN_IN_OUT";
  return null;
}

export function classifyBillableRow(
  row: ClassifyInput,
  sourceLineLookup: (modelKey: string) => SourceLineRef | undefined,
): ClassifyOutput {
  if (row.cloudBillingKind) {
    return {
      billingKind: row.cloudBillingKind,
      tierRaw: row.cloudTierRaw,
      source: "billable",
    };
  }
  const modelLookup = row.cloudModelKey ?? row.schemeARefModelKey;
  if (modelLookup) {
    const hit = sourceLineLookup(modelLookup);
    if (hit) {
      return {
        billingKind: hit.billingKind,
        tierRaw: row.cloudTierRaw ?? hit.tierRaw,
        source: "source-line",
      };
    }
  }
  const fromTool = heuristicFromToolKey(row.toolKey);
  if (fromTool) {
    return {
      billingKind: fromTool,
      tierRaw: row.cloudTierRaw,
      source: "heuristic",
    };
  }
  return { billingKind: null, tierRaw: row.cloudTierRaw, source: "unknown" };
}

/** 把列表打包成「modelKey → 首条匹配」的查找 Map，供分类器调用。 */
export function buildSourceLineLookup(
  lines: ReadonlyArray<SourceLineRef>,
): (modelKey: string) => SourceLineRef | undefined {
  const map = new Map<string, SourceLineRef>();
  for (const l of lines) {
    if (!map.has(l.modelKey)) map.set(l.modelKey, l);
  }
  return (k: string) => map.get(k);
}

/** billingKind → 计价单位文案；统一在 UI 各处复用，避免分散维护。 */
export function unitLabelFor(
  bk: PricingBillingKind | null | undefined,
  tierRaw?: string | null,
): string {
  switch (bk) {
    case "TOKEN_IN_OUT":
      return "元 / 百万 tokens";
    case "OUTPUT_IMAGE":
    case "COST_PER_IMAGE":
      return "元 / 张";
    case "VIDEO_MODEL_SPEC":
      return tierRaw ? `元 / 秒（${tierRaw}）` : "元 / 秒";
    default:
      return "—";
  }
}

/** billingKind → 计算公式简述。 */
export function formulaTextFor(bk: PricingBillingKind | null | undefined): string {
  switch (bk) {
    case "TOKEN_IN_OUT":
      return "in×M / 1e6 × 点率 + out×M / 1e6 × 点率（按 token 实际加权）";
    case "OUTPUT_IMAGE":
    case "COST_PER_IMAGE":
      return "成本 × 系数 × 100 → 取整（最少 1 点）";
    case "VIDEO_MODEL_SPEC":
      return "成本/秒 × 系数 × 实际秒数 × 100 → 取整";
    default:
      return "成本 × 系数 × 100";
  }
}
