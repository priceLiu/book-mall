/** Server Action 统一返回类型（须在非 "use server" 模块导出）。 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };
