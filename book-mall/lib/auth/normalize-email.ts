/** 邮箱归一化（登录/绑定查询用） */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s || !s.includes("@")) return null;
  return s;
}
