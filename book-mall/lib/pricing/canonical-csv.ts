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

/**
 * 表头别名 → 规范英文列。
 *
 * 已知 vendor CSV 表头（按 norm 后 lowercase 形式）：
 * - **阿里云**：`region/区域`、`model_key/modelid/模型`、`tier/规格`、`billing_kind/计费类型`、`input_yuan_per_million/输入(元/百万tokens)`、`output_yuan_per_million/输出(元/百万tokens)`、`cost_json/成本json`
 * - **腾讯云**：`地域/region`、`产品/模型`、`计费方式/billing_kind`、`输入价格元/百万tokens`、`输出价格元/百万tokens`
 * - **火山引擎/Doubao**：`region`、`model_name`、`billing_type`、`input_price_per_million_tokens_yuan`、`output_price_per_million_tokens_yuan`
 * - **智谱 AI / Moonshot**：`region`、`model`、`type`、`input_price_per_1m_tokens`、`output_price_per_1m_tokens`
 * - **百度文心**：`region`、`model_id`、`billing_kind`、`input_yuan_per_million_tokens`、`output_yuan_per_million_tokens`
 *
 * 未识别表头时，由 UI 转换器把原始表头并排到规范名，提示运营手动改头或粘贴 JSON 别名补丁。
 */
const HEADER_ALIASES: Record<string, string> = {
  // region
  地域: "region",
  区域: "region",
  地区: "region",
  region_code: "region",
  // model_key
  模型: "model_key",
  模型键: "model_key",
  模型id: "model_key",
  modelid: "model_key",
  modelkey: "model_key",
  model: "model_key",
  model_name: "model_key",
  model_id: "model_key",
  产品: "model_key",
  // tier_raw
  阶梯: "tier_raw",
  规格: "tier_raw",
  档位: "tier_raw",
  tier: "tier_raw",
  spec: "tier_raw",
  // billing_kind
  计费类型: "billing_kind",
  计费方式: "billing_kind",
  类型: "billing_kind",
  type: "billing_kind",
  billingkind: "billing_kind",
  billing_type: "billing_kind",
  "billing kind": "billing_kind",
  // input_yuan_per_million
  输入元每百万token: "input_yuan_per_million",
  输入元每百万tokens: "input_yuan_per_million",
  "输入(元/百万tokens)": "input_yuan_per_million",
  "输入(元/百万token)": "input_yuan_per_million",
  输入元百万tokens: "input_yuan_per_million", // stripped form
  输入元百万token: "input_yuan_per_million", // stripped form
  输入: "input_yuan_per_million",
  输入价格元百万tokens: "input_yuan_per_million",
  "输入价格(元/百万tokens)": "input_yuan_per_million",
  输入价格元百万token: "input_yuan_per_million",
  input_price_per_million_tokens_yuan: "input_yuan_per_million",
  input_price_per_million: "input_yuan_per_million",
  input_price_per_1m_tokens: "input_yuan_per_million",
  input_yuan_per_million_tokens: "input_yuan_per_million",
  in_yuan_per_mtok: "input_yuan_per_million",
  // output_yuan_per_million
  输出元每百万token: "output_yuan_per_million",
  输出元每百万tokens: "output_yuan_per_million",
  "输出(元/百万tokens)": "output_yuan_per_million",
  "输出(元/百万token)": "output_yuan_per_million",
  输出元百万tokens: "output_yuan_per_million",
  输出元百万token: "output_yuan_per_million",
  输出: "output_yuan_per_million",
  输出价格元百万tokens: "output_yuan_per_million",
  "输出价格(元/百万tokens)": "output_yuan_per_million",
  输出价格元百万token: "output_yuan_per_million",
  output_price_per_million_tokens_yuan: "output_yuan_per_million",
  output_price_per_million: "output_yuan_per_million",
  output_price_per_1m_tokens: "output_yuan_per_million",
  output_yuan_per_million_tokens: "output_yuan_per_million",
  out_yuan_per_mtok: "output_yuan_per_million",
  // cost_json
  成本json: "cost_json",
  cost: "cost_json",
  spec_json: "cost_json",
  cost_object: "cost_json",
};

/** 规范列名（与 REQUIRED 同序），供上传 UI / CLI 引用。 */
export const CANONICAL_COLUMNS = REQUIRED;

/** 多级 fallback 归一化：原 → trim → lower → 去标点/空格 → 别名表 */
function normHeader(h: string): string {
  const raw = h.replace(/\uFEFF/g, "").trim();
  if (HEADER_ALIASES[raw]) return HEADER_ALIASES[raw]!;

  const lower = raw.toLowerCase();
  if (HEADER_ALIASES[lower]) return HEADER_ALIASES[lower]!;

  // 中英括号、斜线、空格、连字符、句点 → 全部去掉，便于对齐 alias 表
  const stripped = lower
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]【】{}]/g, "")
    .replace(/[\/\\\-_.·]/g, "");
  if (HEADER_ALIASES[stripped]) return HEADER_ALIASES[stripped]!;

  // 仅含字母数字下划线的紧凑形
  const compact = lower.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
  if (HEADER_ALIASES[compact]) return HEADER_ALIASES[compact]!;

  return compact;
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

/** 把额外的 raw → canonical 别名补丁（来自 UI / 运营手填）合并进 normHeader 的查找路径。 */
function applyExtraAliases(
  raw: string,
  extra: Record<string, string> | undefined,
): string | null {
  if (!extra) return null;
  // 1) 原样
  if (extra[raw] && (REQUIRED as readonly string[]).includes(extra[raw]!)) {
    return extra[raw]!;
  }
  // 2) lower
  const lower = raw.toLowerCase();
  if (extra[lower] && (REQUIRED as readonly string[]).includes(extra[lower]!)) {
    return extra[lower]!;
  }
  return null;
}

export function buildColumnIndex(
  rawHeaders: string[],
  extraAliases?: Record<string, string>,
): { ok: true; index: Record<string, number> } | { ok: false; error: string } {
  const index: Record<string, number> = {};
  rawHeaders.forEach((raw, i) => {
    const fromExtra = applyExtraAliases(raw, extraAliases);
    const canon = fromExtra ?? normHeader(raw);
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

/** 表头识别报告：哪些列已识别 → 规范名，哪些没识别，哪些规范列还缺失。 */
export type HeaderAnalysis = {
  rawHeaders: string[];
  recognized: Array<{ raw: string; canonical: string }>;
  unrecognized: string[];
  missingCanonical: string[];
};

/** 对单行表头做识别（不解析数据），供 UI 转换器使用。 */
export function analyzeCsvHeader(
  text: string,
  extraAliases?: Record<string, string>,
): { ok: true; report: HeaderAnalysis } | { ok: false; error: string } {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return { ok: false, error: "空文件" };
  const rawHeaders = parseCsvLine(firstLine);
  const recognized: HeaderAnalysis["recognized"] = [];
  const unrecognized: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawHeaders) {
    const fromExtra = applyExtraAliases(raw, extraAliases);
    const canon = fromExtra ?? normHeader(raw);
    if ((REQUIRED as readonly string[]).includes(canon)) {
      recognized.push({ raw, canonical: canon });
      seen.add(canon);
    } else {
      unrecognized.push(raw);
    }
  }
  const missing = REQUIRED.filter((k) => !seen.has(k));
  return {
    ok: true,
    report: {
      rawHeaders,
      recognized,
      unrecognized,
      missingCanonical: [...missing],
    },
  };
}

export function parseCanonicalPricingCsv(
  text: string,
  extraAliases?: Record<string, string>,
): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: "CSV 至少需要表头+一行数据" };

  const headerCells = parseCsvLine(lines[0]!);
  const hi = buildColumnIndex(headerCells, extraAliases);
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
export function rewriteCsvToCanonicalOrder(
  csvText: string,
  extraAliases?: Record<string, string>,
): { ok: true; out: string } | { ok: false; error: string } {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 1 || !lines[0]?.trim()) return { ok: false, error: "空文件" };
  const headerCells = parseCsvLine(lines[0]!);
  const hi = buildColumnIndex(headerCells, extraAliases);
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
