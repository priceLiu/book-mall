/**
 * 阿里云 consumedetailbill_v2 CSV → VendorBillLine 聚合。
 */
import { parse as parseCsv } from "csv-parse/sync";
import { ModelAliasSource } from "@prisma/client";

import { candidateAliasesFromCloudRow } from "@/lib/finance/reconciliation-run";
import { canonicalKeysByAliases } from "@/lib/model-catalog/resolve";

import { buildJoinKey } from "./billable-units";
import {
  monthKeyOverlapsPeriod,
  monthLabelFromPeriod,
  normalizePeriod,
  periodKey as toPeriodKey,
  resolvePeriod,
  type ReconciliationPeriod,
} from "./period-range";
import type { TokenDirection, UnitKind, VendorBillLine } from "./types";

type CsvRow = Record<string, string>;

function parseFloatLoose(s: string | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function trimAccountId(raw: string | undefined): string | null {
  const id = (raw ?? "").replace(/\t/g, "").trim();
  return id || null;
}

function parseSelectionJson(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const text = (raw ?? "").trim();
  if (!text.startsWith("[")) return out;
  try {
    const arr = JSON.parse(text) as Array<{ name?: string; value?: string }>;
    for (const item of arr) {
      if (item?.name && item.value) out[item.name] = item.value;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function modelFromRow(row: CsvRow): string {
  const sel = parseSelectionJson(row["产品信息/选型配置"]);
  const keys = [
    "视频生成模型规格",
    "图片生成模型规格",
    "文本生成模型规格",
    "语音识别模型",
    "语音合成模型",
    "图片检测模型规格",
    "向量模型规格",
  ];
  for (const k of keys) {
    if (sel[k]) return sel[k]!;
  }
  const spec = row["产品信息/规格"]?.trim();
  if (spec) return spec;
  const instance = row["资源信息/实例ID（出账粒度）"] ?? "";
  const parts = instance.split(";").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (
      p.startsWith("happyhorse") ||
      p.startsWith("qwen") ||
      p.startsWith("wan") ||
      p.startsWith("text-embedding")
    ) {
      return p;
    }
  }
  return row["产品信息/计费项Code"]?.trim() || "(unknown)";
}

function tierFromRow(row: CsvRow): string | null {
  const sel = parseSelectionJson(row["产品信息/选型配置"]);
  const tier =
    sel["视频生成画幅规格"] ??
    sel["画幅规格"] ??
    null;
  if (tier) return tier.toUpperCase();
  const instance = row["资源信息/实例ID（出账粒度）"] ?? "";
  const parts = instance.split(";").map((p) => p.trim());
  const found = parts.find((p) => /^(720P|1080P|480P)$/i.test(p));
  return found ? found.toUpperCase() : null;
}

function tokenDirectionFromRow(row: CsvRow): TokenDirection {
  const sel = parseSelectionJson(row["产品信息/选型配置"]);
  const tokenType = sel["Token类型"] ?? "";
  const lower = tokenType.toLowerCase();
  if (lower.includes("input") || lower.includes("_input")) return "input";
  if (lower.includes("output") || lower.includes("_output")) return "output";
  if (lower.includes("cache")) return "cache";
  return "none";
}

function unitKindFromRow(row: CsvRow): UnitKind {
  const unit = (row["用量信息/用量单位"] || "").trim();
  if (unit === "秒") {
    const model = modelFromRow(row).toLowerCase();
    if (model.includes("asr")) return "AUDIO_SEC";
    return "SEC";
  }
  if (unit === "张") return "IMAGE";
  if (unit.toLowerCase().includes("token")) return "KTOKEN";
  if (unit.includes("万字") || unit.includes("字符")) return "CHAR_10K";
  return "CALL";
}

function shouldSkipRow(row: CsvRow): boolean {
  const feeType = (row["账单信息/费用类型"] || "").trim();
  const units = parseFloatLoose(row["用量信息/用量"]);
  if (feeType === "免费额度" && units === 0) return true;
  return false;
}

async function resolveCanonicalKey(
  row: CsvRow,
  aliasLookup: Map<string, string>,
): Promise<string> {
  const candidates: Array<[ModelAliasSource, string | undefined]> = [
    [ModelAliasSource.VENDOR_RESOURCE_SPEC, row["产品信息/规格"]?.trim()],
    [ModelAliasSource.VENDOR_COMMODITY_CODE, row["产品信息/商品Code"]?.trim()],
    [ModelAliasSource.VENDOR_BILLABLE_ITEM, row["产品信息/计费项Code"]?.trim()],
    [ModelAliasSource.VENDOR_PRODUCT_NAME, row["产品信息/产品名称"]?.trim()],
  ];
  for (const c of candidateAliasesFromCloudRow(row)) {
    candidates.push([c.source, c.aliasValue]);
  }
  for (const [source, alias] of candidates) {
    if (!alias) continue;
    const hit = aliasLookup.get(`${source}::${alias}`);
    if (hit) return hit;
  }
  return modelFromRow(row);
}

export type ParseAliyunCsvResult = {
  rows: CsvRow[];
  months: string[];
  period: ReconciliationPeriod;
  periodKey: string;
  lines: VendorBillLine[];
};

export async function parseAliyunConsumedetailCsv(
  csvText: string,
  opts?: { period?: ReconciliationPeriod },
): Promise<ParseAliyunCsvResult> {
  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const aliasCollect: Array<{ source: ModelAliasSource; aliasValue: string }> = [];
  for (const row of records) {
    if (shouldSkipRow(row)) continue;
    for (const c of candidateAliasesFromCloudRow(row)) {
      aliasCollect.push({ source: c.source, aliasValue: c.aliasValue });
    }
    const spec = row["产品信息/规格"]?.trim();
    if (spec) aliasCollect.push({ source: ModelAliasSource.VENDOR_RESOURCE_SPEC, aliasValue: spec });
    const commodity = row["产品信息/商品Code"]?.trim();
    if (commodity) aliasCollect.push({ source: ModelAliasSource.VENDOR_COMMODITY_CODE, aliasValue: commodity });
    const billable = row["产品信息/计费项Code"]?.trim();
    if (billable) aliasCollect.push({ source: ModelAliasSource.VENDOR_BILLABLE_ITEM, aliasValue: billable });
    const product = row["产品信息/产品名称"]?.trim();
    if (product) aliasCollect.push({ source: ModelAliasSource.VENDOR_PRODUCT_NAME, aliasValue: product });
  }
  const aliasLookup = await canonicalKeysByAliases(aliasCollect);

  const monthsSet = new Set<string>();
  for (const row of records) {
    if (shouldSkipRow(row)) continue;
    const month = (row["账单信息/账单月份"] || "").trim();
    if (month) monthsSet.add(month);
  }
  const period = normalizePeriod(
    resolvePeriod({ period: opts?.period, months: [...monthsSet] }),
  );
  const pk = toPeriodKey(period);
  const monthLabel = monthLabelFromPeriod(period);

  const agg = new Map<string, VendorBillLine>();

  for (const row of records) {
    if (shouldSkipRow(row)) continue;
    const month = (row["账单信息/账单月份"] || "").trim();
    if (month && !monthKeyOverlapsPeriod(month, period)) continue;
    const cloudAccountId = trimAccountId(row["身份信息/资源购买账号ID"]);
    const modelKey = await resolveCanonicalKey(row, aliasLookup);
    const tierRaw = tierFromRow(row);
    const unitKind = unitKindFromRow(row);
    const tokenDirection = tokenDirectionFromRow(row);
    const vendorUnits = parseFloatLoose(row["用量信息/用量"]);
    const listUnitYuan = parseFloatLoose(row["定价信息/官网目录价"]);
    const vendorListYuan = parseFloatLoose(row["费用信息/目录总价"]);
    const joinKey = buildJoinKey({
      vendor: "aliyun",
      modelKey,
      tierRaw,
      unitKind,
      tokenDirection,
      periodKey: pk,
    });

    const cur =
      agg.get(joinKey) ??
      ({
        vendor: "aliyun",
        joinKey,
        month: monthLabel,
        period,
        periodKey: pk,
        cloudAccountId,
        modelKey,
        tierRaw,
        unitKind,
        tokenDirection,
        vendorUnits: 0,
        listUnitYuan,
        vendorListYuan: 0,
        csvRowCount: 0,
      } satisfies VendorBillLine);

    cur.vendorUnits += vendorUnits;
    cur.vendorListYuan += vendorListYuan;
    cur.csvRowCount += 1;
    if (listUnitYuan > 0) cur.listUnitYuan = listUnitYuan;
    agg.set(joinKey, cur);
  }

  return {
    rows: records,
    months: [...monthsSet].sort(),
    period,
    periodKey: pk,
    lines: [...agg.values()].sort((a, b) => b.vendorListYuan - a.vendorListYuan),
  };
}

/** 同步解析（测试用，alias 不查 DB）。 */
export function parseAliyunConsumedetailCsvSync(
  csvText: string,
  aliasMap: Record<string, string> = {},
): Omit<ParseAliyunCsvResult, "lines"> & { lines: VendorBillLine[] } {
  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const map = new Map<string, string>(
    Object.entries(aliasMap).map(([k, v]) => [k.toLowerCase(), v]),
  );

  const monthsSet = new Set<string>();
  for (const row of records) {
    if (shouldSkipRow(row)) continue;
    const month = (row["账单信息/账单月份"] || "").trim();
    if (month) monthsSet.add(month);
  }
  const period = normalizePeriod(resolvePeriod({ months: [...monthsSet] }));
  const pk = toPeriodKey(period);
  const monthLabel = monthLabelFromPeriod(period);

  const agg = new Map<string, VendorBillLine>();

  for (const row of records) {
    if (shouldSkipRow(row)) continue;
    const month = (row["账单信息/账单月份"] || "").trim();
    if (month && !monthKeyOverlapsPeriod(month, period)) continue;
    const cloudAccountId = trimAccountId(row["身份信息/资源购买账号ID"]);
    let modelKey = modelFromRow(row);
    for (const c of candidateAliasesFromCloudRow(row)) {
      const hit = map.get(c.aliasValue.toLowerCase());
      if (hit) {
        modelKey = hit;
        break;
      }
    }
    const tierRaw = tierFromRow(row);
    const unitKind = unitKindFromRow(row);
    const tokenDirection = tokenDirectionFromRow(row);
    const vendorUnits = parseFloatLoose(row["用量信息/用量"]);
    const listUnitYuan = parseFloatLoose(row["定价信息/官网目录价"]);
    const vendorListYuan = parseFloatLoose(row["费用信息/目录总价"]);
    const joinKey = buildJoinKey({
      vendor: "aliyun",
      modelKey,
      tierRaw,
      unitKind,
      tokenDirection,
      periodKey: pk,
    });

    const cur =
      agg.get(joinKey) ??
      ({
        vendor: "aliyun",
        joinKey,
        month: monthLabel,
        period,
        periodKey: pk,
        cloudAccountId,
        modelKey,
        tierRaw,
        unitKind,
        tokenDirection,
        vendorUnits: 0,
        listUnitYuan,
        vendorListYuan: 0,
        csvRowCount: 0,
      } satisfies VendorBillLine);

    cur.vendorUnits += vendorUnits;
    cur.vendorListYuan += vendorListYuan;
    cur.csvRowCount += 1;
    if (listUnitYuan > 0) cur.listUnitYuan = listUnitYuan;
    agg.set(joinKey, cur);
  }

  return {
    rows: records,
    months: [...monthsSet].sort(),
    period,
    periodKey: pk,
    lines: [...agg.values()],
  };
}
