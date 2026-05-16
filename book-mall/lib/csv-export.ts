/** 浏览器/服务端通用：把行集转为 CSV 文本（UTF-8，含 BOM 头可让 Excel 正确识别中文）。 */
export function rowsToCsv<T extends Record<string, unknown>>(
  headers: Array<{ key: keyof T & string; label: string }>,
  rows: ReadonlyArray<T>,
  opts: { withBom?: boolean } = {},
): string {
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : typeof v === "boolean" ? (v ? "true" : "false") : JSON.stringify(v);
    if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const head = headers.map((h) => escape(h.label)).join(",");
  const body = rows
    .map((r) => headers.map((h) => escape(r[h.key])).join(","))
    .join("\n");
  const out = `${head}\n${body}\n`;
  return opts.withBom !== false ? `\uFEFF${out}` : out;
}

/** 仅浏览器：把 CSV 文本作为文件下载。需要在 use client 组件中调用。 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 形如 20260516-1903 的时间戳，文件名中常用。 */
export function tsForFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}
