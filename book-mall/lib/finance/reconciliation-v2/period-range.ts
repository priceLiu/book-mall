/**
 * 对账时间窗口 — 厂商 CSV 与 Gateway 平台侧须用同一 [from, to] 日历日（UTC+8）。
 */
export type ReconciliationPeriod = {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidCalendarDate(s: string): boolean {
  const m = s.trim().match(DATE_RE);
  if (!m) return false;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00+08:00`);
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() + 1 === Number(m[2]) &&
    d.getUTCDate() === Number(m[3])
  );
}

export function normalizePeriod(input: ReconciliationPeriod): ReconciliationPeriod {
  const from = input.from.trim();
  const to = input.to.trim();
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) {
    throw new Error(`无效日期区间：${from} ~ ${to}（须 YYYY-MM-DD）`);
  }
  if (from > to) {
    throw new Error(`开始日期不能晚于结束日期：${from} > ${to}`);
  }
  return { from, to };
}

/** joinKey 末段：20260724_20260822 */
export function periodKey(period: ReconciliationPeriod): string {
  const p = normalizePeriod(period);
  return `${p.from.replace(/-/g, "")}_${p.to.replace(/-/g, "")}`;
}

export function parsePeriodKey(key: string): ReconciliationPeriod | null {
  const m = key.trim().match(/^(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const from = `${m[1]}-${m[2]}-${m[3]}`;
  const to = `${m[4]}-${m[5]}-${m[6]}`;
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) return null;
  return { from, to };
}

/** ISO / 带时区字符串 → YYYY-MM-DD（按 +08:00 日历日） */
export function calendarDateFromIso(raw: string | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const da = parts.find((p) => p.type === "day")?.value;
  return y && mo && da ? `${y}-${mo}-${da}` : "";
}

export function dateInPeriod(date: string, period: ReconciliationPeriod): boolean {
  const d = date.trim();
  if (!d) return false;
  const p = normalizePeriod(period);
  return d >= p.from && d <= p.to;
}

/** Gateway 查询：[from 00:00 +8, to+1 00:00 +8) */
export function periodQueryBounds(period: ReconciliationPeriod): { from: Date; to: Date } {
  const p = normalizePeriod(period);
  return {
    from: new Date(`${p.from}T00:00:00+08:00`),
    to: new Date(`${p.to}T23:59:59.999+08:00`),
  };
}

/** YYYYMM 账单月是否与日历区间有交集 */
export function monthKeyOverlapsPeriod(monthKey: string, period: ReconciliationPeriod): boolean {
  const mk = monthKey.trim();
  if (!/^\d{6}$/.test(mk)) return false;
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(4, 6));
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const p = normalizePeriod(period);
  return monthStart <= p.to && monthEnd >= p.from;
}

export function periodFromMonthKey(monthKey: string): ReconciliationPeriod {
  const mk = monthKey.trim();
  if (!/^\d{6}$/.test(mk)) {
    throw new Error(`无效月份 ${monthKey}，须 YYYYMM`);
  }
  const y = mk.slice(0, 4);
  const m = mk.slice(4, 6);
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function detectPeriodFromDates(dates: string[]): ReconciliationPeriod {
  const valid = dates.map((d) => d.trim()).filter(isValidCalendarDate).sort();
  if (valid.length === 0) {
    throw new Error("无法从账单推断日期区间（无有效日期）");
  }
  return { from: valid[0]!, to: valid[valid.length - 1]! };
}

export function resolvePeriod(input: {
  period?: ReconciliationPeriod | null;
  month?: string | null;
  months?: string[];
  fallbackDates?: string[];
}): ReconciliationPeriod {
  if (input.period?.from && input.period?.to) {
    return normalizePeriod(input.period);
  }
  if (input.months?.length) {
    return periodFromMonthKeys(input.months);
  }
  if (input.month?.trim() && /^\d{6}$/.test(input.month.trim())) {
    return periodFromMonthKey(input.month.trim());
  }
  if (input.fallbackDates?.length) {
    return detectPeriodFromDates(input.fallbackDates);
  }
  throw new Error("请指定对账日期区间（开始日 ~ 结束日）");
}

export function periodFromMonthKeys(monthKeys: string[]): ReconciliationPeriod {
  const sorted = monthKeys.filter((m) => /^\d{6}$/.test(m.trim())).sort();
  if (sorted.length === 0) {
    throw new Error("无效月份列表");
  }
  const first = periodFromMonthKey(sorted[0]!);
  const last = periodFromMonthKey(sorted[sorted.length - 1]!);
  return { from: first.from, to: last.to };
}

export function monthLabelFromPeriod(period: ReconciliationPeriod): string {
  const fromM = period.from.slice(0, 7).replace("-", "");
  const toM = period.to.slice(0, 7).replace("-", "");
  return fromM === toM ? fromM : `${fromM}+`;
}
