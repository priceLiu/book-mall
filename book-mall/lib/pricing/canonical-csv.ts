/**
 * 价目上传：**规范 CSV** 校验与列名别名转换。
 * 规范列（首行须能映射到）： region, model_key, tier_raw, billing_kind, input_yuan_per_million, output_yuan_per_million, cost_json
 *
 * CLI：`pnpm pricing:normalize-upload-csv -- in.csv out.csv`
 */
import type { PricingBillingKind } from "@prisma/client";
import type { PricingDraftLine } from "./price-md-china-types";

const REQUIRED = [
  "region",
  "model_key",
  "tier_raw",
  "billing_kind",
  "input_yuan_per_million",
  "output_yuan_per_million",
  "cost_json",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  地域: "region",
  模型键: "model_key",
  modelkey: "model_key",
  模型: "model_key",
  阶梯: "tier_raw",
  tier: "tier_raw",
  计费类型: "billing_kind",
  billingkind: "billing_kind",
  "billing kind": "billing_kind",
  输入元每百万token: "input_yuan_per_million",
  输出元每百万token: "output_yuan_per_million",
  成本json: "cost_json",
};

function normHeader(h: string): string {
  const raw = h.replace(/\uFEFF/g, "").trim();
  if (HEADER_ALIASES[raw]) return HEADER_ALIASES[raw]!;
  const t = raw.toLowerCase().replace(/\s+/g, "_");
  if (HEADER_ALIASES[t]) return HEADER_ALIASES[t]!;
  return t;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

const KIND_LIST = [
  "TOKEN_IN_OUT",
  "OUTPUT_IMAGE",
  "COST_PER_IMAGE",
  "VIDEO_MODEL_SPEC",
] as const;
const KINDS = new Set<string>(KIND_LIST);

export type CsvParseResult =
  | { ok: true; rows: PricingDraftLine[]; normalizedHeader: string[] }
  | { ok: false; error: string };

export function buildColumnIndex(rawHeaders: string[]): { ok: true; index: Record<string, number> } | { ok: false; error: string } {
  const index: Record<string, number> = {};
  rawHeaders.forEach((raw, i) => {
    const canon = normHeader(raw);
    index[canon] = i;
  });
  const miss = REQUIRED.filter((k) => index[k] === undefined);
  if (miss.length) {
    return {
      ok: false,
      error: `缺少可映射列: ${miss.join(", ")}。规范名: ${REQUIRED.join(", ")}`,
    };
  }
  return { ok: true, index };
}

export function parseCanonicalPricingCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: "CSV 至少需要表头+一行数据" };

  const headerCells = parseCsvLine(lines[0]!);
  const hi = buildColumnIndex(headerCells);
  if (!hi.ok) return hi;
  const I = hi.index;
  const rows: PricingDraftLine[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]!);
    if (cells.every((c) => !c)) continue;
    const get = (k: string) => cells[I[k]!] ?? "";
    const region = get("region");
    if (region && region !== "china_mainland") {
      return { ok: false, error: `L${r + 1}: 仅支持 region=china_mainland` };
    }
    const modelKey = get("model_key").trim();
    const tierRaw = get("tier_raw").trim();
    const kindRaw = get("billing_kind").trim().toUpperCase();
    if (!modelKey) return { ok: false, error: `L${r + 1}: model_key 不能为空` };
    if (!KINDS.has(kindRaw)) {
      return { ok: false, error: `L${r + 1}: billing_kind 须为 ${KIND_LIST.join(" | ")}` };
    }
    const billingKind = kindRaw as PricingBillingKind;

    const inS = get("input_yuan_per_million");
    const outS = get("output_yuan_per_million");
    const cj = get("cost_json");
    let inputYuanPerMillion: number | null = inS === "" ? null : parseFloat(inS);
    let outputYuanPerMillion: number | null = outS === "" ? null : parseFloat(outS);
    let costJson: unknown | null = null;
    if (cj.trim()) {
      try {
        costJson = JSON.parse(cj) as unknown;
      } catch {
        return { ok: false, error: `L${r + 1}: cost_json 须为合法 JSON` };
      }
    }
    if (billingKind === "TOKEN_IN_OUT") {
      if (
        inputYuanPerMillion == null ||
        outputYuanPerMillion == null ||
        !Number.isFinite(inputYuanPerMillion) ||
        !Number.isFinite(outputYuanPerMillion)
      ) {
        return { ok: false, error: `L${r + 1}: TOKEN_IN_OUT 须填 input/output 数值` };
      }
    } else {
      if (!costJson || typeof costJson !== "object") {
        return { ok: false, error: `L${r + 1}: 非 TOKEN 行须填 cost_json 对象` };
      }
      inputYuanPerMillion = null;
      outputYuanPerMillion = null;
    }

    rows.push({
      sectionH2: "csv",
      sectionH3: "csv",
      modelKey,
      modelLabelRaw: modelKey,
      tierRaw: tierRaw || (billingKind === "TOKEN_IN_OUT" ? "—" : ""),
      billingKind,
      inputYuanPerMillion,
      outputYuanPerMillion,
      costJson,
      sourceLine: r + 1,
    });
  }

  return { ok: true, rows, normalizedHeader: [...REQUIRED] };
}

/** 将上传 CSV 转为**规范列序** CSV（首行英文规范名，列按 REQUIRED 顺序输出）。 */
export function rewriteCsvToCanonicalOrder(csvText: string): { ok: true; out: string } | { ok: false; error: string } {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 1 || !lines[0]?.trim()) return { ok: false, error: "空文件" };
  const headerCells = parseCsvLine(lines[0]!);
  const hi = buildColumnIndex(headerCells);
  if (!hi.ok) return hi;
  const I = hi.index;
  const head = [...REQUIRED].join(",");
  const body: string[] = [];
  for (let r = 1; r < lines.length; r++) {
    const L = lines[r] ?? "";
    if (!L.trim()) continue;
    const cells = parseCsvLine(L);
    const get = (k: string) => cells[I[k]!] ?? "";
    body.push(
      [...REQUIRED]
        .map((k) => {
          const v = get(k);
          return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    );
  }
  return { ok: true, out: `${head}\n${body.join("\n")}\n` };
}
