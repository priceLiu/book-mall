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
 * 解析当前生效的按次单价（点，1 点 = ¥0.01）。
 * 匹配同一 toolKey 下 effectiveFrom ≤ now ≤ effectiveTo（或 effectiveTo 为空），
 * 且 action 等于给定 action，或定价行为 null（通配该工具下 action）。
 * 优先采用「action 精确匹配」的行；否则采用 action 为 null 的行。
 * 若多行 action 相同且均带 schemeARefModelKey（如分析室 8 模型），用 opts.schemeARefModelKey 命中；
 * 未传 schemeARefModelKey 时：分析室回落 qwen3.6-plus；AI 试衣页回落 aitryon；图生视频回落 happyhorse-1.0-i2v。
 */
export async function resolveBillablePricePoints(
  toolKey: string,
  action: string,
  opts?: ResolveBillablePriceOpts,
): Promise<number | undefined> {
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
  const v = row.pricePoints;
  return typeof v === "number" && v > 0 ? v : undefined;
}
