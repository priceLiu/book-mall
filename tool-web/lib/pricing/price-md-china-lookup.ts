import type { PriceMdChinaTokenRow } from "./price-md-china-types";

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * 在解析结果中按模型关键字匹配 **中国内地首条** 命中行（表格自上而下）。
 * `query` 示例：`qwen3.6-plus`、`qwen3.6-plus-2026-04-02`。
 */
export function lookupMainlandTokenRow(
  rows: PriceMdChinaTokenRow[],
  query: string,
): PriceMdChinaTokenRow | null {
  const q = normKey(query);
  if (!q) return null;

  for (const row of rows) {
    const keys = row.modelKeys.map(normKey);
    if (keys.some((k) => k === q || k.includes(q) || q.includes(k))) {
      return row;
    }
    const raw = normKey(row.modelRaw.split(">")[0] ?? row.modelRaw);
    if (raw.includes(q) || q.includes(raw)) return row;
  }
  return null;
}

/** 返回该模型在文档中出现的 **第一行**阶梯（通常即首档最低价区） */
export function lookupMainlandTokenFirstTier(
  rows: PriceMdChinaTokenRow[],
  query: string,
): PriceMdChinaTokenRow | null {
  const hit = lookupMainlandTokenRow(rows, query);
  if (!hit) return null;
  const needle = normKey(hit.modelKeys[0] ?? hit.modelRaw.split(">")[0] ?? hit.modelRaw);
  for (const row of rows) {
    const cand = normKey(row.modelKeys[0] ?? row.modelRaw.split(">")[0] ?? row.modelRaw);
    if (cand === needle) return row;
  }
  return hit;
}
