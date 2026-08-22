/**
 * KIE usage_data Excel/CSV → VendorBillLine 聚合。
 * 表头：API Key, Model, Credits Consumed, Create Time, Task ID
 * 按 model + 月 汇总 KIE 积分；对账 joinKey 用 CALL + 积分用量。
 */
import { parse as parseCsv } from "csv-parse/sync";
import { ModelAliasSource } from "@prisma/client";

import { canonicalKeysByAliases } from "@/lib/model-catalog/resolve";

import { buildJoinKey } from "./billable-units";
import {
  calendarDateFromIso,
  dateInPeriod,
  monthLabelFromPeriod,
  normalizePeriod,
  periodKey as toPeriodKey,
  resolvePeriod,
  type ReconciliationPeriod,
} from "./period-range";
import type { VendorBillLine } from "./types";

/** KIE 标准充值档 ¥36/1000 积分 */
export const KIE_CREDIT_YUAN = 0.036;

export const KIE_USAGE_BILL_MARKER = "Credits Consumed";

type CsvRow = Record<string, string>;

/** KIE 账单 model 名 → Gateway modelKey（Catalog 未命中时兜底） */
const KIE_BILL_MODEL_FALLBACK: Record<string, string> = {
  "kling/v3-turbo-image-to-video": "kling/v3-turbo-image-to-video",
  "kling-3.0/video": "kling-3.0-turbo-i2v",
  "nano-banana-pro": "nano-banana-pro",
  "gpt-image-2-image-to-image": "gpt-image-2-image-to-image",
  "gpt-5-5": "gpt-5-5",
  "gemini-3-flash": "gemini-3-flash",
};

function parseFloatLoose(s: string | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function monthFromCreateTime(raw: string | undefined): string {
  const text = (raw ?? "").trim();
  const m = text.match(/^(\d{4})-(\d{2})/);
  if (!m) return "";
  return `${m[1]}${m[2]}`;
}

function apiKeyId(raw: string | undefined): string | null {
  const text = (raw ?? "").trim();
  const m = text.match(/\(([a-f0-9]+)\)/i);
  if (m?.[1]) return m[1];
  return text || null;
}

export function isKieUsageBillCsv(csvText: string): boolean {
  const head = csvText.slice(0, 2000);
  return (
    head.includes("API Key") &&
    head.includes("Model") &&
    head.includes(KIE_USAGE_BILL_MARKER)
  );
}

export type ParseKieUsageResult = {
  rows: CsvRow[];
  months: string[];
  period: ReconciliationPeriod;
  periodKey: string;
  lines: VendorBillLine[];
  taskRowCount: number;
};

function resolveKieModelKeySync(
  rawModel: string,
  aliasLookup: Map<string, string>,
): string {
  const trimmed = rawModel.trim();
  if (!trimmed) return "(unknown)";

  const hit = aliasLookup.get(`${ModelAliasSource.VENDOR_RESOURCE_SPEC}::${trimmed}`);
  if (hit) return hit;

  const lower = trimmed.toLowerCase();
  for (const [alias, key] of Object.entries(KIE_BILL_MODEL_FALLBACK)) {
    if (alias.toLowerCase() === lower) return key;
  }

  return trimmed;
}

function parseKieUsageRecords(
  records: CsvRow[],
  aliasLookup: Map<string, string>,
  period: ReconciliationPeriod,
): { lines: VendorBillLine[]; months: string[] } {
  const agg = new Map<string, VendorBillLine>();
  const monthsSet = new Set<string>();
  const pk = toPeriodKey(period);
  const monthLabel = monthLabelFromPeriod(period);

  for (const row of records) {
    const credits = parseFloatLoose(row["Credits Consumed"]);
    if (credits <= 0) continue;

    const day = calendarDateFromIso(row["Create Time"]);
    if (!dateInPeriod(day, period)) continue;
    const month = monthFromCreateTime(row["Create Time"]);
    if (month) monthsSet.add(month);

    const rawModel = row.Model?.trim() ?? "";
    const modelKey = resolveKieModelKeySync(rawModel, aliasLookup);
    const cloudAccountId = apiKeyId(row["API Key"]);

    const joinKey = buildJoinKey({
      vendor: "kie",
      modelKey,
      tierRaw: null,
      unitKind: "CALL",
      tokenDirection: "none",
      periodKey: pk,
    });

    const cur =
      agg.get(joinKey) ??
      ({
        vendor: "kie",
        joinKey,
        month: monthLabel,
        period,
        periodKey: pk,
        cloudAccountId,
        modelKey,
        tierRaw: null,
        unitKind: "CALL",
        tokenDirection: "none",
        vendorUnits: 0,
        listUnitYuan: KIE_CREDIT_YUAN,
        vendorListYuan: 0,
        csvRowCount: 0,
      } satisfies VendorBillLine);

    cur.vendorUnits += credits;
    cur.vendorListYuan = Math.round(cur.vendorUnits * KIE_CREDIT_YUAN * 1e4) / 1e4;
    cur.csvRowCount += 1;
    if (!cur.cloudAccountId && cloudAccountId) cur.cloudAccountId = cloudAccountId;
    agg.set(joinKey, cur);
  }

  return {
    lines: [...agg.values()].sort((a, b) => b.vendorListYuan - a.vendorListYuan),
    months: [...monthsSet].sort(),
  };
}

/** 单测用：同步解析，可注入 model 别名表。 */
export function parseKieUsageBillCsvSync(
  csvText: string,
  aliasMap: Record<string, string> = {},
  opts?: { period?: ReconciliationPeriod },
): ParseKieUsageResult {
  if (!isKieUsageBillCsv(csvText)) {
    throw new Error(
      "文件表头须包含 API Key / Model / Credits Consumed（KIE usage_data 导出格式）",
    );
  }

  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const aliasLookup = new Map<string, string>(
    Object.entries(aliasMap).map(([k, v]) => [
      `${ModelAliasSource.VENDOR_RESOURCE_SPEC}::${k}`,
      v,
    ]),
  );

  const period = normalizePeriod(
    resolvePeriod({
      period: opts?.period,
      fallbackDates: records
        .map((r) => calendarDateFromIso(r["Create Time"]))
        .filter(Boolean),
    }),
  );

  const { lines, months } = parseKieUsageRecords(records, aliasLookup, period);
  return {
    rows: records,
    months,
    period,
    periodKey: toPeriodKey(period),
    lines,
    taskRowCount: records.length,
  };
}

export async function parseKieUsageBillCsv(
  csvText: string,
  opts?: { period?: ReconciliationPeriod },
): Promise<ParseKieUsageResult> {
  if (!isKieUsageBillCsv(csvText)) {
    throw new Error(
      "文件表头须包含 API Key / Model / Credits Consumed（KIE usage_data 导出格式）",
    );
  }

  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const modelNames = [
    ...new Set(records.map((r) => r.Model?.trim()).filter(Boolean) as string[]),
  ];
  const aliasLookup = await canonicalKeysByAliases(
    modelNames.map((aliasValue) => ({
      source: ModelAliasSource.VENDOR_RESOURCE_SPEC,
      aliasValue,
    })),
  );

  const period = normalizePeriod(
    resolvePeriod({
      period: opts?.period,
      fallbackDates: records
        .map((r) => calendarDateFromIso(r["Create Time"]))
        .filter(Boolean),
    }),
  );

  const { lines, months } = parseKieUsageRecords(records, aliasLookup, period);
  return {
    rows: records,
    months,
    period,
    periodKey: toPeriodKey(period),
    lines,
    taskRowCount: records.length,
  };
}
