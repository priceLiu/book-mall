import { prisma } from "@/lib/prisma";

/** 与工具站 visual-lab-analysis-models 默认模型 id（qwen3.6-plus）一致 */
export const VISUAL_LAB_ANALYSIS_DEFAULT_SCHEME_A_MODEL_KEY = "qwen3.6-plus";

/** catalog `aiTryOn.defaultModel`：与 fitting-room__ai-fit 多模型参考价并存时的表价回落 */
export const FITTING_ROOM_AI_FIT_DEFAULT_SCHEME_A_MODEL_KEY = "aitryon";

/** catalog 图生视频默认示例模型（与工具站 lab 默认首位一致）：多模型参考价并存时的表价回落 */
export const IMAGE_TO_VIDEO_DEFAULT_SCHEME_A_MODEL_KEY = "happyhorse-1.0-i2v";

export type ResolveBillablePriceOpts = {
  /** 对应 Prisma `ToolBillablePrice.schemeARefModelKey`；分析室等多模型共用同一 toolKey+action 时用于命中行 */
  schemeARefModelKey?: string | null;
};

/**
 * v002 引入：解析「定价快照」——除点数外，附带云成本单价、零售系数、命中行 id 与模型键。
 * 用于在 `recordToolUsageAndConsumeWallet` 写 ToolBillingDetailLine 时一次性固化 internal* 列。
 *
 * - `points`：本次扣减点数（与旧 `resolveBillablePricePoints` 同口径）
 * - `unitCostYuan`：命中行 `schemeAUnitCostYuan`，未填则 null
 * - `retailMultiplier`：命中行 `schemeAAdminRetailMultiplier`，未填则 null
 * - `ourUnitYuan`：cost × M（任一缺失则 null）
 * - `schemeARefModelKey`：命中行的 catalog 模型 id
 * - `billablePriceId`：命中行 id（便于审计）
 */
export type BillableSnapshot = {
  points: number;
  unitCostYuan: number | null;
  retailMultiplier: number | null;
  ourUnitYuan: number | null;
  schemeARefModelKey: string | null;
  billablePriceId: string;
};

/**
 * 解析当前生效的「按次定价行」——返回包含成本快照的完整对象（v002）。
 * 旧函数 `resolveBillablePricePoints` 仍保留为兼容封装，仅返回 `points`。
 */
export async function resolveBillableSnapshot(
  toolKey: string,
  action: string,
  opts?: ResolveBillablePriceOpts,
): Promise<BillableSnapshot | undefined> {
  const now = new Date();
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      active: true,
      toolKey,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { updatedAt: "desc" }],
  });

  const applicable = rows.filter(
    (r) => r.action == null || r.action === action,
  );
  if (applicable.length === 0) return undefined;

  const actionMatched = applicable.filter((r) => r.action === action);
  const pool =
    actionMatched.length > 0
      ? actionMatched
      : applicable.filter((r) => r.action == null);
  if (pool.length === 0) return undefined;

  const mk = opts?.schemeARefModelKey?.trim();
  let chosen = pool;

  if (mk) {
    const hit = pool.filter((r) => r.schemeARefModelKey === mk);
    if (hit.length > 0) chosen = hit;
  }

  if (chosen.length > 1) {
    if (toolKey === "visual-lab__analysis") {
      const def = chosen.find(
        (r) =>
          r.schemeARefModelKey === VISUAL_LAB_ANALYSIS_DEFAULT_SCHEME_A_MODEL_KEY,
      );
      chosen = def ? [def] : [chosen[0]!];
    } else if (toolKey === "fitting-room__ai-fit") {
      const def = chosen.find(
        (r) =>
          r.schemeARefModelKey === FITTING_ROOM_AI_FIT_DEFAULT_SCHEME_A_MODEL_KEY,
      );
      chosen = def ? [def] : [chosen[0]!];
    } else if (toolKey === "image-to-video") {
      const def = chosen.find(
        (r) =>
          r.schemeARefModelKey === IMAGE_TO_VIDEO_DEFAULT_SCHEME_A_MODEL_KEY,
      );
      chosen = def ? [def] : [chosen[0]!];
    } else {
      chosen = [chosen[0]!];
    }
  }

  const row = chosen[0]!;
  const points = typeof row.pricePoints === "number" && row.pricePoints > 0 ? row.pricePoints : 0;
  if (points <= 0) return undefined;

  const storedCost =
    typeof row.schemeAUnitCostYuan === "number" && Number.isFinite(row.schemeAUnitCostYuan) && row.schemeAUnitCostYuan > 0
      ? row.schemeAUnitCostYuan
      : null;
  const mult =
    typeof row.schemeAAdminRetailMultiplier === "number" && Number.isFinite(row.schemeAAdminRetailMultiplier) && row.schemeAAdminRetailMultiplier > 0
      ? row.schemeAAdminRetailMultiplier
      : null;

  /**
   * v002 兼容：早期管理端只填了 `pricePoints` 与 `schemeAAdminRetailMultiplier`，
   * 没维护 `schemeAUnitCostYuan` 时，按定义反推：cost = pricePoints / M / 100。
   * 这样 `ToolBillingDetailLine.internalCloudCostUnitYuan` 不再为 null，财务表能立即展示。
   */
  const cost =
    storedCost != null
      ? storedCost
      : mult != null
        ? points / mult / 100
        : null;

  const ourUnit = cost != null && mult != null ? cost * mult : null;

  return {
    points,
    unitCostYuan: cost,
    retailMultiplier: mult,
    ourUnitYuan: ourUnit,
    schemeARefModelKey: row.schemeARefModelKey ?? null,
    billablePriceId: row.id,
  };
}

/**
 * 兼容封装：保留旧 API 形态，仅返回 points。
 * 新代码请用 `resolveBillableSnapshot` 以拿到 cost / M / 命中行 id。
 */
export async function resolveBillablePricePoints(
  toolKey: string,
  action: string,
  opts?: ResolveBillablePriceOpts,
): Promise<number | undefined> {
  const snap = await resolveBillableSnapshot(toolKey, action, opts);
  return snap?.points;
}
