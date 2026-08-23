/**
 * DeepSeek 控制台用量 CSV → VendorBillLine（按对账日历区间聚合）。
 */
import { parse as parseCsv } from "csv-parse/sync";

import { findDeepseekListPrice, resolveDeepseekReconciliationModelKey } from "@/lib/pricing/deepseek-v4-pricing";

import { buildJoinKey } from "./billable-units";
import {
  calendarDateFromIso,
  dateInPeriod,
  detectPeriodFromDates,
  monthLabelFromPeriod,
  normalizePeriod,
  periodKey as toPeriodKey,
  type ReconciliationPeriod,
  resolvePeriod,
} from "./period-range";
import type { TokenDirection, UnitKind, VendorBillLine } from "./types";

type CsvRow = Record<string, string>;

export const DEEPSEEK_COST_BILL_MARKER = "wallet_type";
export const DEEPSEEK_AMOUNT_BILL_MARKER = "input_cache_hit_tokens";

function parseFloatLoose(s: string | undefined): number {
  if (s == null || s.trim() === "") return 0;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function isDeepseekCostBillCsv(csvText: string): boolean {
  const head = csvText.slice(0, 1500);
  return head.includes("wallet_type") && head.includes(",cost,") && head.includes(",model,");
}

export function isDeepseekAmountBillCsv(csvText: string): boolean {
  const head = csvText.slice(0, 1500);
  return (
    head.includes("api_key_name") &&
    head.includes(",type,") &&
    head.includes("input_cache_hit_tokens")
  );
}

function resolveModelKey(raw: string): string {
  return resolveDeepseekReconciliationModelKey(raw);
}

function tokenDirectionFromType(type: string): TokenDirection {
  const t = type.trim().toLowerCase();
  if (t.includes("output")) return "output";
  if (t.includes("input") || t.includes("cache")) return "input";
  return "none";
}

export type ParseDeepseekUsageResult = {
  rows: CsvRow[];
  months: string[];
  period: ReconciliationPeriod;
  periodKey: string;
  lines: VendorBillLine[];
  rowCount: number;
  source: "cost" | "amount" | "merged";
};

type AggLine = {
  modelKey: string;
  tokenDirection: TokenDirection;
  vendorUnits: number;
  vendorListYuan: number;
  listUnitYuan: number;
  csvRowCount: number;
};

function lineFromAgg(
  joinKey: string,
  period: ReconciliationPeriod,
  a: AggLine,
): VendorBillLine {
  return {
    vendor: "deepseek",
    joinKey,
    month: monthLabelFromPeriod(period),
    period,
    periodKey: toPeriodKey(period),
    cloudAccountId: null,
    modelKey: a.modelKey,
    tierRaw: null,
    unitKind: "KTOKEN",
    tokenDirection: a.tokenDirection,
    vendorUnits: Math.round(a.vendorUnits * 1e4) / 1e4,
    listUnitYuan: a.listUnitYuan,
    vendorListYuan: Math.round(a.vendorListYuan * 1e4) / 1e4,
    csvRowCount: a.csvRowCount,
  };
}

function parseCostRecords(records: CsvRow[], period: ReconciliationPeriod): VendorBillLine[] {
  const agg = new Map<string, AggLine>();
  for (const row of records) {
    const day = calendarDateFromIso(row.start_time_iso);
    if (!dateInPeriod(day, period)) continue;
    const cost = parseFloatLoose(row.cost);
    if (cost <= 0) continue;
    const modelKey = resolveModelKey(row.model ?? "");
    const joinKey = buildJoinKey({
      vendor: "deepseek",
      modelKey,
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection: "none",
      period,
    });
    const cur =
      agg.get(joinKey) ??
      ({
        modelKey,
        tokenDirection: "none" as const,
        vendorUnits: 0,
        vendorListYuan: 0,
        listUnitYuan: findDeepseekListPrice(modelKey)?.inputListCostYuan ?? 0,
        csvRowCount: 0,
      } satisfies AggLine);
    cur.vendorListYuan += cost;
    cur.csvRowCount += 1;
    agg.set(joinKey, cur);
  }
  return [...agg.entries()].map(([joinKey, a]) => lineFromAgg(joinKey, period, a));
}

function parseAmountRecords(records: CsvRow[], period: ReconciliationPeriod): VendorBillLine[] {
  const agg = new Map<string, AggLine>();
  for (const row of records) {
    const type = row.type?.trim() ?? "";
    if (type === "request_count") continue;
    const day = calendarDateFromIso(row.start_time_iso);
    if (!dateInPeriod(day, period)) continue;
    const amount = parseFloatLoose(row.amount);
    if (amount <= 0) continue;
    const modelKey = resolveModelKey(row.model ?? "");
    const tokenDirection = tokenDirectionFromType(type);
    const joinKey = buildJoinKey({
      vendor: "deepseek",
      modelKey,
      tierRaw: null,
      unitKind: "KTOKEN",
      tokenDirection,
      period,
    });
    const pricePerToken = parseFloatLoose(row.price);
    const rowYuan = pricePerToken > 0 ? pricePerToken * amount : 0;
    const listUnitYuan =
      pricePerToken > 0 ? Math.round(pricePerToken * 1000 * 1e8) / 1e8 : 0;
    const cur =
      agg.get(joinKey) ??
      ({
        modelKey,
        tokenDirection,
        vendorUnits: 0,
        vendorListYuan: 0,
        listUnitYuan,
        csvRowCount: 0,
      } satisfies AggLine);
    cur.vendorUnits += amount / 1000;
    cur.vendorListYuan += rowYuan;
    if (cur.listUnitYuan <= 0 && listUnitYuan > 0) cur.listUnitYuan = listUnitYuan;
    cur.csvRowCount += 1;
    agg.set(joinKey, cur);
  }
  return [...agg.entries()].map(([joinKey, a]) => lineFromAgg(joinKey, period, a));
}

function collectDatesFromRecords(records: CsvRow[]): string[] {
  return records
    .map((r) => calendarDateFromIso(r.start_time_iso))
    .filter(Boolean);
}

export function parseDeepseekUsageBillCsvSync(
  csvText: string,
  opts?: { extraCsv?: string; period?: ReconciliationPeriod },
): ParseDeepseekUsageResult {
  const isCost = isDeepseekCostBillCsv(csvText);
  const isAmount = isDeepseekAmountBillCsv(csvText);
  if (!isCost && !isAmount) {
    throw new Error(
      "无法识别 DeepSeek 账单：须为 cost-*.csv（含 wallet_type,cost）或 amount-*.csv（含 input_cache_hit_tokens）",
    );
  }

  const primary = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const allRecords = [...primary];
  if (opts?.extraCsv?.trim()) {
    allRecords.push(
      ...(parseCsv(opts.extraCsv, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        trim: true,
      }) as CsvRow[]),
    );
  }

  const period = resolvePeriod({
    period: opts?.period,
    fallbackDates: collectDatesFromRecords(allRecords),
  });
  normalizePeriod(period);

  let amountLines: VendorBillLine[] = [];
  let costLines: VendorBillLine[] = [];

  if (isAmount) amountLines = parseAmountRecords(primary, period);
  if (isCost) costLines = parseCostRecords(primary, period);

  if (opts?.extraCsv?.trim()) {
    const extra = opts.extraCsv;
    if (isDeepseekAmountBillCsv(extra) && !isAmount) {
      amountLines = parseAmountRecords(
        parseCsv(extra, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as CsvRow[],
        period,
      );
    } else if (isDeepseekCostBillCsv(extra) && !isCost) {
      costLines = parseCostRecords(
        parseCsv(extra, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as CsvRow[],
        period,
      );
    }
  }

  const lines =
    amountLines.length > 0
      ? amountLines.sort((a, b) => b.vendorListYuan - a.vendorListYuan)
      : costLines.sort((a, b) => b.vendorListYuan - a.vendorListYuan);

  const pk = toPeriodKey(period);
  const monthsSet = new Set<string>();
  if (period.from.slice(0, 7) === period.to.slice(0, 7)) {
    monthsSet.add(period.from.slice(0, 7).replace("-", ""));
  } else {
    monthsSet.add(period.from.slice(0, 7).replace("-", ""));
    monthsSet.add(period.to.slice(0, 7).replace("-", ""));
  }

  return {
    rows: primary,
    months: [...monthsSet].sort(),
    period,
    periodKey: pk,
    lines,
    rowCount: primary.length,
    source:
      amountLines.length > 0 && costLines.length > 0
        ? "merged"
        : amountLines.length > 0
          ? "amount"
          : "cost",
  };
}

export async function parseDeepseekUsageBillCsv(
  csvText: string,
  opts?: { extraCsv?: string; period?: ReconciliationPeriod },
): Promise<ParseDeepseekUsageResult> {
  return parseDeepseekUsageBillCsvSync(csvText, opts);
}
