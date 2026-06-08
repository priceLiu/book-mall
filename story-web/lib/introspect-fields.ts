/** 将主站 introspect JSON 字段规范为壳层会话（兼容缺省字段与非 string） */

export function introspectStringField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
