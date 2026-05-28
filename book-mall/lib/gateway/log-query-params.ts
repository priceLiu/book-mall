/** Gateway 日志列表 · 查询参数解析 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 开始日期（含当日 00:00:00.000 UTC） */
export function parseLogSubmittedFromParam(
  value: string | null | undefined,
): Date | undefined {
  const v = value?.trim();
  if (!v || !DATE_ONLY.test(v)) return undefined;
  return new Date(`${v}T00:00:00.000Z`);
}

/** 结束日期（含当日 23:59:59.999 UTC） */
export function parseLogSubmittedToParam(
  value: string | null | undefined,
): Date | undefined {
  const v = value?.trim();
  if (!v || !DATE_ONLY.test(v)) return undefined;
  return new Date(`${v}T23:59:59.999Z`);
}
