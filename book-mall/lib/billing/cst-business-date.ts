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
