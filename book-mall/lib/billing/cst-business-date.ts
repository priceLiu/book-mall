/** 业务日 · 中国标准时间（UTC+8），无服务端依赖，客户端可安全 import */

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

export function cstBusinessDate(d: Date = new Date()): string {
  const cst = new Date(d.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

export function cstDayStartUtc(businessDate: string): Date {
  const [y, m, day] = businessDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!, -8, 0, 0, 0));
}

export function cstDayEndUtc(businessDate: string): Date {
  const start = cstDayStartUtc(businessDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

const CST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 校验 `YYYY-MM-DD` 业务日参数；非法时返回 null */
export function parseCstBusinessDateParam(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s || !CST_DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return s;
}
