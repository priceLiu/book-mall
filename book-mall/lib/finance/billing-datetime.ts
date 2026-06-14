/** 费用明细展示时区（对外一律北京时间）。 */
export const BILLING_DISPLAY_TZ = "Asia/Shanghai";

/** `YYYY-MM-DD HH:mm:ss`（北京时间，用于明细列与前端排序）。 */
export function formatBillingDateTime(d: Date): string {
  return d.toLocaleString("sv-SE", {
    timeZone: BILLING_DISPLAY_TZ,
    hour12: false,
  });
}

/** 账单月份键 `YYYYMM`（按北京时间自然月）。 */
export function billingMonthKeyFromDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}${month}`;
}

/** 套餐对帐 periodKey `YYYY-MM`（按北京时间自然月）。 */
export function billingPeriodKeyFromDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
