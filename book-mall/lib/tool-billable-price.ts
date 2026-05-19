import { PricingBillingKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 与工具站 visual-lab-analysis-models 默认模型 id（qwen3.6-plus）一致 */
export const VISUAL_LAB_ANALYSIS_DEFAULT_SCHEME_A_MODEL_KEY = "qwen3.6-plus";

/** catalog `aiTryOn.defaultModel`：与 fitting-room__ai-fit 多模型参考价并存时的表价回落 */
export const FITTING_ROOM_AI_FIT_DEFAULT_SCHEME_A_MODEL_KEY = "aitryon";

/** catalog 图生视频默认示例模型（与工具站 lab 默认首位一致）：多模型参考价并存时的表价回落 */
export const IMAGE_TO_VIDEO_DEFAULT_SCHEME_A_MODEL_KEY = "happyhorse-1.0-i2v";

/** v003 按秒计费：当前 PlatformConfig 加载失败/未配置时的兜底值（与默认 default 行一致） */
const FALLBACK_MIN_BILLED_VIDEO_SEC = 5;
const FALLBACK_MIN_BILLED_IMAGE_COUNT = 1;
const FALLBACK_MIN_CHARGE_POINTS = 1;

export type ResolveBillablePriceOpts = {
  /** 对应 Prisma `ToolBillablePrice.schemeARefModelKey`；分析室等多模型共用同一 toolKey+action 时用于命中行 */
  schemeARefModelKey?: string | null;
  /**
   * v003：实际用量。按 cloudBillingKind 取对应键计算实际扣点；不传时退化为旧行为（仅返回 row.pricePoints）。
   * - `durationSec`：视频按秒计费时传入（VIDEO_MODEL_SPEC）
   * - `imageCount`：按张计费时传入（OUTPUT_IMAGE / COST_PER_IMAGE）
   * - `inputTokens` / `outputTokens`：按 Token 计费时传入（TOKEN_IN_OUT）
   * - `videoSr`：视频分辨率（720 / 1080 / 360 等）；用于在多档位行中选择 cloudTierRaw 匹配的行（v004）
   * - `videoAudio`：是否带音频（true/false）；wan2.6-flash 等按音频维度区分单价时使用（v004）
   */
  actuals?: {
    durationSec?: number;
    imageCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    videoSr?: number | string;
    videoAudio?: boolean;
  };
};

/**
 * v004：把 actuals.videoSr / videoAudio 标准化为 ToolBillablePrice.cloudTierRaw 的候选列表，
 * 按"精确度从高到低"排序。读侧按列表顺序逐项尝试命中，第一个命中的档位即为最终命中行。
 *
 * 候选示例：
 * - sr=1080, audio=true → ["1080P|audio", "1080P"]
 * - sr=720,  audio=false → ["720P|silent", "720P"]
 * - sr=360 → ["360P"]
 * - 其它 → []
 *
 * 约定：720 → "720P"，1080 → "1080P"，360 → "360P"（与 PricingSourceLine.tierRaw 同一组命名）。
 * "|audio" / "|silent" 后缀仅用于 wan2.6-flash 这类按音频细分的模型；普通视频模型只用纯档位行。
 */
export function videoTierCandidates(
  sr: number | string | null | undefined,
  audio: boolean | undefined,
): string[] {
  let srNum: number | null = null;
  if (typeof sr === "number" && Number.isFinite(sr) && sr > 0) srNum = Math.round(sr);
  else if (typeof sr === "string") {
    const m = sr.trim().toUpperCase().match(/^(\d{3,4})P?$/);
    if (m) srNum = parseInt(m[1]!, 10);
  }
  if (srNum == null) return [];
  const base = `${srNum}P`;
  const list: string[] = [];
  if (audio === true) list.push(`${base}|audio`);
  if (audio === false) list.push(`${base}|silent`);
  list.push(base);
  return list;
}

/** 兼容旧 API：仅返回最精确的候选档位（或 null） */
export function normalizeVideoTierRaw(input: number | string | null | undefined): string | null {
  const list = videoTierCandidates(input, undefined);
  return list[0] ?? null;
}

/**
 * v002 引入：解析「定价快照」——除点数外，附带云成本单价、零售系数、命中行 id 与模型键。
 * 用于在 `recordToolUsageAndConsumeWallet` 写 ToolBillingDetailLine 时把
 * 「厂商定价/官网目录价 + 平台/系数(M) + 平台/定价 + 平台/扣点」固化到 cloudRow JSON。
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
  /** v003：实际计费秒数（视频按秒计费写入）；旧路径为 null */
  billedVideoSec: number | null;
  /** v003：实际计费张数（按张计费写入）；旧路径为 null */
  billedImageCount: number | null;
  /** v003：本次命中的计费维度（来自 ToolBillablePrice.cloudBillingKind 或推断） */
  billingKind: PricingBillingKind | null;
};

/**
 * 内部：根据 cloudBillingKind 与 actuals 计算实际扣点（仅按"挂牌价 × 用量 × M"，不算折扣/免费额度）。
 * 任何一项关键输入缺失（cost / M / 关键用量）则返回 null，调用方退回 row.pricePoints。
 *
 * - VIDEO_MODEL_SPEC：unitCostYuan(元/秒) × max(minBilledVideoSec, ceil(durationSec)) × M × 100
 * - OUTPUT_IMAGE / COST_PER_IMAGE：unitCostYuan(元/张) × max(minBilledImageCount, imageCount) × M × 100
 * - TOKEN_IN_OUT：(inputYuanPerMillion × inputTokens + outputYuanPerMillion × outputTokens) / 1e6 × M × 100
 *   （目前我们尚未把分输入/输出存到 ToolBillablePrice；TOKEN_IN_OUT 暂退回 row.pricePoints）
 */
function computeChargePointsFromActuals(input: {
  billingKind: PricingBillingKind | null;
  unitCostYuan: number | null;
  retailMultiplier: number | null;
  actuals?: ResolveBillablePriceOpts["actuals"];
  minBilledVideoSec: number;
  minBilledImageCount: number;
  minChargePointsPerInvoke: number;
}): {
  chargePoints: number;
  billedVideoSec: number | null;
  billedImageCount: number | null;
} | null {
  const { billingKind, unitCostYuan, retailMultiplier, actuals } = input;
  if (
    !billingKind ||
    !actuals ||
    unitCostYuan == null ||
    retailMultiplier == null ||
    !(unitCostYuan > 0) ||
    !(retailMultiplier > 0)
  ) {
    return null;
  }

  if (billingKind === PricingBillingKind.VIDEO_MODEL_SPEC) {
    const dur = typeof actuals.durationSec === "number" && Number.isFinite(actuals.durationSec) ? actuals.durationSec : NaN;
    if (!Number.isFinite(dur) || dur <= 0) return null;
    const billed = Math.max(input.minBilledVideoSec, Math.ceil(dur));
    const yuan = unitCostYuan * billed * retailMultiplier;
    const pts = Math.max(input.minChargePointsPerInvoke, Math.round(yuan * 100));
    return { chargePoints: pts, billedVideoSec: billed, billedImageCount: null };
  }

  if (billingKind === PricingBillingKind.OUTPUT_IMAGE || billingKind === PricingBillingKind.COST_PER_IMAGE) {
    const n = typeof actuals.imageCount === "number" && Number.isFinite(actuals.imageCount) ? actuals.imageCount : NaN;
    if (!Number.isFinite(n) || n <= 0) return null;
    const billed = Math.max(input.minBilledImageCount, Math.ceil(n));
    const yuan = unitCostYuan * billed * retailMultiplier;
    const pts = Math.max(input.minChargePointsPerInvoke, Math.round(yuan * 100));
    return { chargePoints: pts, billedVideoSec: null, billedImageCount: billed };
  }

  return null;
}

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

  /**
   * v004：按视频档位 + 音频开关在多档位行中选命中行。
   * - 候选顺序："1080P|audio" → "1080P" → ...，按精确度从高到低
   * - 命中则把 chosen 收敛到该档位；未命中（如 D 表只配了 720P 没配 1080P）保持原来的 chosen
   *   并在下文 fallback 取首行——这种情况 audit 会单独报警，便于人工补行
   */
  const tierCandidates = videoTierCandidates(
    opts?.actuals?.videoSr,
    opts?.actuals?.videoAudio,
  );
  if (tierCandidates.length > 0 && chosen.length > 1) {
    for (const t of tierCandidates) {
      const tierHit = chosen.filter((r) => r.cloudTierRaw === t);
      if (tierHit.length > 0) {
        chosen = tierHit;
        break;
      }
    }
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
  const fallbackPoints =
    typeof row.pricePoints === "number" && row.pricePoints > 0 ? row.pricePoints : 0;

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
   * 这样 cloudRow 内「厂商定价/官网目录价」不再为空，财务表能立即展示。
   */
  const cost =
    storedCost != null
      ? storedCost
      : mult != null && fallbackPoints > 0
        ? fallbackPoints / mult / 100
        : null;

  const ourUnit = cost != null && mult != null ? cost * mult : null;

  /**
   * v003：按 cloudBillingKind + actuals 计算"实际用量×挂牌价×系数"扣点。
   * - 按秒（VIDEO_MODEL_SPEC）：以云厂商返回的 durationSec 为准，向上取整后做最低秒数兜底
   * - 按张（OUTPUT_IMAGE/COST_PER_IMAGE）：以实际 imageCount 为准
   * - 任一关键输入缺失 → 退回 row.pricePoints（与 v002 行为兼容）
   */
  const cfg = await prisma.platformConfig.findUnique({
    where: { id: "default" },
    select: {
      minBilledVideoSec: true,
      minBilledImageCount: true,
      minChargePointsPerInvoke: true,
    },
  });
  const minBilledVideoSec =
    typeof cfg?.minBilledVideoSec === "number" && cfg.minBilledVideoSec > 0
      ? cfg.minBilledVideoSec
      : FALLBACK_MIN_BILLED_VIDEO_SEC;
  const minBilledImageCount =
    typeof cfg?.minBilledImageCount === "number" && cfg.minBilledImageCount > 0
      ? cfg.minBilledImageCount
      : FALLBACK_MIN_BILLED_IMAGE_COUNT;
  const minChargePointsPerInvoke =
    typeof cfg?.minChargePointsPerInvoke === "number" && cfg.minChargePointsPerInvoke > 0
      ? cfg.minChargePointsPerInvoke
      : FALLBACK_MIN_CHARGE_POINTS;

  const computed = computeChargePointsFromActuals({
    billingKind: row.cloudBillingKind ?? null,
    unitCostYuan: cost,
    retailMultiplier: mult,
    actuals: opts?.actuals,
    minBilledVideoSec,
    minBilledImageCount,
    minChargePointsPerInvoke,
  });

  const points = computed?.chargePoints ?? fallbackPoints;
  if (points <= 0) return undefined;

  return {
    points,
    unitCostYuan: cost,
    retailMultiplier: mult,
    ourUnitYuan: ourUnit,
    schemeARefModelKey: row.schemeARefModelKey ?? null,
    billablePriceId: row.id,
    billedVideoSec: computed?.billedVideoSec ?? null,
    billedImageCount: computed?.billedImageCount ?? null,
    billingKind: row.cloudBillingKind ?? null,
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
