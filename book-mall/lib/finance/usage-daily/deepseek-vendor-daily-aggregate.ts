/**
 * DeepSeek cost + amount CSV → 按 CST 日 + api_key_name + model 聚合。
 */
import { parse as parseCsv } from "csv-parse/sync";

import {
  isDeepseekAmountBillCsv,
  isDeepseekCostBillCsv,
} from "@/lib/finance/reconciliation-v2/deepseek-usage-v2-adapter";
import { resolveDeepseekReconciliationModelKey } from "@/lib/pricing/deepseek-v4-pricing";
import {
  calendarDateFromIso,
  normalizePeriod,
  type ReconciliationPeriod,
} from "@/lib/finance/reconciliation-v2/period-range";
import { normalizeDeepseekVendorKeyName } from "@/lib/finance/usage-daily/key-normalize";
import type { VendorDailyRow } from "@/lib/finance/usage-daily/types";

type CsvRow = Record<string, string>;

function parseFloatLoose(s: string | undefined): number {
  if (s == null || s.trim() === "") return 0;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

type Agg = {
  apiKeyName: string;
  modelKey: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  costYuan: number;
};

function aggKey(day: string, apiKeyName: string, modelKey: string): string {
  return `${day}\0${apiKeyName}\0${modelKey}`;
}

function parseRows(csvText: string): CsvRow[] {
  return parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];
}

function mergeCostRecords(records: CsvRow[], period: ReconciliationPeriod, agg: Map<string, Agg>) {
  for (const row of records) {
    const day = calendarDateFromIso(row.start_time_iso);
    if (!day || day < period.from || day > period.to) continue;
    const cost = parseFloatLoose(row.cost);
    if (cost <= 0) continue;
    const apiKeyName = (row.api_key_name ?? "unknown").trim() || "unknown";
    const modelKey = resolveDeepseekReconciliationModelKey(row.model ?? "");
    const k = aggKey(day, apiKeyName, modelKey);
    const cur =
      agg.get(k) ??
      ({
        apiKeyName,
        modelKey,
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        costYuan: 0,
      } satisfies Agg);
    cur.costYuan += cost;
    agg.set(k, cur);
  }
}

function mergeAmountRecords(records: CsvRow[], period: ReconciliationPeriod, agg: Map<string, Agg>) {
  for (const row of records) {
    const day = calendarDateFromIso(row.start_time_iso);
    if (!day || day < period.from || day > period.to) continue;
    const apiKeyName = (row.api_key_name ?? "unknown").trim() || "unknown";
    const modelKey = resolveDeepseekReconciliationModelKey(row.model ?? "");
    const k = aggKey(day, apiKeyName, modelKey);
    const cur =
      agg.get(k) ??
      ({
        apiKeyName,
        modelKey,
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        costYuan: 0,
      } satisfies Agg);

    const typ = row.type?.trim() ?? "";
    const amt = parseFloatLoose(row.amount);
    const price = parseFloatLoose(row.price);

    if (typ === "request_count") {
      cur.requestCount += amt;
    } else if (typ === "input_cache_hit_tokens" || typ === "input_cache_miss_tokens") {
      cur.inputTokens += amt;
      if (price > 0 && cur.costYuan <= 0) cur.costYuan += price * amt;
    } else if (typ === "output_tokens") {
      cur.outputTokens += amt;
      if (price > 0 && cur.costYuan <= 0) cur.costYuan += price * amt;
    }

    agg.set(k, cur);
  }
}

export type ParseDeepseekVendorDailyInput = {
  costCsv?: string;
  amountCsv?: string;
  period: ReconciliationPeriod;
};

export function aggregateDeepseekVendorDaily(
  input: ParseDeepseekVendorDailyInput,
): VendorDailyRow[] {
  const period = normalizePeriod(input.period);
  const agg = new Map<string, Agg>();

  if (input.amountCsv?.trim()) {
    if (!isDeepseekAmountBillCsv(input.amountCsv)) {
      throw new Error("amount CSV 格式无效（须含 api_key_name 与 input_cache_hit_tokens）");
    }
    mergeAmountRecords(parseRows(input.amountCsv), period, agg);
  }

  if (input.costCsv?.trim()) {
    if (!isDeepseekCostBillCsv(input.costCsv)) {
      throw new Error("cost CSV 格式无效（须含 wallet_type 与 cost）");
    }
    mergeCostRecords(parseRows(input.costCsv), period, agg);
  }

  if (agg.size === 0) {
    throw new Error("未解析到 DeepSeek 用量行，请上传 cost 和/或 amount CSV");
  }

  const rows: VendorDailyRow[] = [];
  for (const [k, a] of agg) {
    const day = k.split("\0")[0]!;
    rows.push({
      day,
      apiKeyName: a.apiKeyName,
      channelKey: normalizeDeepseekVendorKeyName(a.apiKeyName),
      modelKey: a.modelKey,
      requestCount: Math.round(a.requestCount),
      inputTokens: Math.round(a.inputTokens),
      outputTokens: Math.round(a.outputTokens),
      costYuan: Math.round(a.costYuan * 1e4) / 1e4,
    });
  }

  return rows.sort((a, b) =>
    a.day === b.day
      ? a.channelKey.localeCompare(b.channelKey) || a.modelKey.localeCompare(b.modelKey)
      : a.day.localeCompare(b.day),
  );
}

/** 按日 + channelKey 汇总（对账 join 用）。 */
export function rollupVendorDailyByChannel(
  rows: VendorDailyRow[],
): Map<string, VendorDailyRow> {
  const map = new Map<string, VendorDailyRow>();
  for (const r of rows) {
    const k = `${r.day}\0${r.channelKey}`;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r, modelKey: "ALL", apiKeyName: r.channelKey });
      continue;
    }
    cur.requestCount += r.requestCount;
    cur.inputTokens += r.inputTokens;
    cur.outputTokens += r.outputTokens;
    cur.costYuan = Math.round((cur.costYuan + r.costYuan) * 1e4) / 1e4;
  }
  return map;
}
