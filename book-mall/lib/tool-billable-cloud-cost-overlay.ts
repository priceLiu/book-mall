/**
 * 工具管理「按次单价」表的云厂商当前成本回链。
 *
 * 用途：把 `ToolBillablePrice` 的 v002 字段 `cloudModelKey + cloudTierRaw + cloudBillingKind`
 * 映射到 `PricingSourceLine`（且其 `version.isCurrent=true`）上的最新成本行，给 admin 直观比对
 * 「行内成本快照」与「当前云厂商真源」是否还一致。
 */
import type {
  PricingBillingKind,
  PricingSourceLine,
} from "@prisma/client";
import {
  unitLabelFor,
} from "@/lib/finance/billable-row-classifier";
import type { CloudCostOverlay } from "@/lib/tool-billable-row-payloads";

export type CloudCostLookupKey = {
  modelKey: string | null;
  tierRaw: string | null;
  billingKind: PricingBillingKind | null;
};

function keyOf(k: CloudCostLookupKey): string {
  return `${k.modelKey ?? ""}|${k.tierRaw ?? ""}|${k.billingKind ?? ""}`;
}

function fallbackKey(k: CloudCostLookupKey): string {
  return `${k.modelKey ?? ""}||${k.billingKind ?? ""}`;
}

function modelOnlyKey(k: CloudCostLookupKey): string {
  return `${k.modelKey ?? ""}|||`;
}

/** 把 current 版本的 PricingSourceLine 数组打包为多级 lookup map（精确→无 tier→仅 modelKey） */
export function buildCloudCostLookup(
  currentLines: PricingSourceLine[],
): (k: CloudCostLookupKey) => PricingSourceLine | undefined {
  const exact = new Map<string, PricingSourceLine>();
  const noTier = new Map<string, PricingSourceLine>();
  const modelOnly = new Map<string, PricingSourceLine>();
  for (const l of currentLines) {
    const exactK = `${l.modelKey}|${l.tierRaw}|${l.billingKind}`;
    if (!exact.has(exactK)) exact.set(exactK, l);
    const noTierK = `${l.modelKey}||${l.billingKind}`;
    if (!noTier.has(noTierK)) noTier.set(noTierK, l);
    const moK = `${l.modelKey}|||`;
    if (!modelOnly.has(moK)) modelOnly.set(moK, l);
  }
  return (k) => {
    if (!k.modelKey) return undefined;
    return (
      exact.get(keyOf(k)) ??
      noTier.get(fallbackKey(k)) ??
      modelOnly.get(modelOnlyKey(k))
    );
  };
}

/** 从 PricingSourceLine 推一个"代表展示值"（双轨 in/out / 张 / 秒）。 */
function formatCloudCostDisplay(line: PricingSourceLine): string | null {
  switch (line.billingKind) {
    case "TOKEN_IN_OUT": {
      const inV = line.inputYuanPerMillion;
      const outV = line.outputYuanPerMillion;
      if (inV == null && outV == null) return null;
      const fmt = (v: number | null | undefined) =>
        v == null
          ? "—"
          : v.toLocaleString("zh-CN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            });
      return `in ${fmt(inV)} / out ${fmt(outV)}`;
    }
    case "OUTPUT_IMAGE":
    case "COST_PER_IMAGE": {
      const v = pickNumberFromCostJson(line.costJson, [
        "pricePerImageYuan",
        "costYuanPerImage",
        "yuanPerImage",
      ]);
      if (v == null) return null;
      return v.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    }
    case "VIDEO_MODEL_SPEC": {
      const flat = pickNumberFromCostJson(line.costJson, ["flatYuanPerSecond"]);
      if (flat != null) {
        return flat.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        });
      }
      // 多档（480/720/1080）：取所有可识别档展示「最低-最高」
      const candidates = ["yuanPerSecond480", "yuanPerSecond720", "yuanPerSecond1080"]
        .map((k) => pickNumberFromCostJson(line.costJson, [k]))
        .filter((n): n is number => typeof n === "number");
      if (candidates.length === 0) return null;
      const lo = Math.min(...candidates);
      const hi = Math.max(...candidates);
      if (lo === hi) {
        return lo.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        });
      }
      return `${lo}-${hi}`;
    }
    default:
      return null;
  }
}

function pickNumberFromCostJson(
  costJson: unknown,
  keys: string[],
): number | null {
  if (!costJson || typeof costJson !== "object") return null;
  const obj = costJson as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}

/** 取一个用于"漂移"比对的代表数值（与本行 schemeAUnitCostYuan 同单位）。
 * 主要用于按张/按秒/按千 token 的"单价口径" —— TOKEN_IN_OUT 取 input 一侧近似比对。 */
function representativeCloudCostYuan(line: PricingSourceLine): number | null {
  switch (line.billingKind) {
    case "TOKEN_IN_OUT": {
      const v = line.inputYuanPerMillion;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    case "OUTPUT_IMAGE":
    case "COST_PER_IMAGE":
      return pickNumberFromCostJson(line.costJson, [
        "pricePerImageYuan",
        "costYuanPerImage",
        "yuanPerImage",
      ]);
    case "VIDEO_MODEL_SPEC":
      return pickNumberFromCostJson(line.costJson, [
        "flatYuanPerSecond",
        "yuanPerSecond720",
        "yuanPerSecond1080",
      ]);
    default:
      return null;
  }
}

/** 构造单行的 CloudCostOverlay：成本展示 + 单位 + 漂移百分比。 */
export function makeCloudCostOverlay(input: {
  cloudModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: PricingBillingKind | null;
  schemeARefModelKey: string | null;
  schemeAUnitCostYuan: number | null;
  lookup: (k: CloudCostLookupKey) => PricingSourceLine | undefined;
}): CloudCostOverlay {
  const cmk = input.cloudModelKey ?? input.schemeARefModelKey;
  const hit = input.lookup({
    modelKey: cmk ?? null,
    tierRaw: input.cloudTierRaw,
    billingKind: input.cloudBillingKind,
  });
  if (!hit) {
    return {
      cloudModelKey: input.cloudModelKey,
      cloudTierRaw: input.cloudTierRaw,
      cloudBillingKind: input.cloudBillingKind,
      cloudUnitLabel: null,
      cloudCostDisplay: null,
      cloudCostDriftPercent: null,
    };
  }
  const display = formatCloudCostDisplay(hit);
  const cmp = representativeCloudCostYuan(hit);
  let drift: number | null = null;
  if (
    cmp != null &&
    input.schemeAUnitCostYuan != null &&
    Number.isFinite(input.schemeAUnitCostYuan) &&
    input.schemeAUnitCostYuan > 0 &&
    hit.billingKind !== "TOKEN_IN_OUT" // TOKEN_IN_OUT 单位不一致，直接展示双轨更直观
  ) {
    drift = (cmp - input.schemeAUnitCostYuan) / input.schemeAUnitCostYuan;
  }
  return {
    cloudModelKey: input.cloudModelKey,
    cloudTierRaw: hit.tierRaw || input.cloudTierRaw,
    cloudBillingKind: hit.billingKind,
    cloudUnitLabel: unitLabelFor(hit.billingKind, hit.tierRaw),
    cloudCostDisplay: display,
    cloudCostDriftPercent: drift,
  };
}
