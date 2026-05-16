export type RawBillRow = Record<string, string>;

export function cloudJsonToRawRow(cloudRow: unknown): RawBillRow {
  if (!cloudRow || typeof cloudRow !== "object" || Array.isArray(cloudRow)) return {};
  const out: RawBillRow = {};
  for (const [k, v] of Object.entries(cloudRow as Record<string, unknown>)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}
