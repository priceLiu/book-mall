export type UserContactFields = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  id?: string;
};

/** 表格主行：昵称 → 手机号 → 邮箱 → ID 前缀 */
export function formatUserCellPrimary(u: UserContactFields): string {
  return u.name?.trim() || u.phone?.trim() || u.email?.trim() || u.id?.slice(0, 8) || "—";
}

/** 昵称下方副行：手机号 · 邮箱 */
export function formatUserContactSubline(u: UserContactFields): string | null {
  const parts: string[] = [];
  const phone = u.phone?.trim();
  const email = u.email?.trim();
  if (phone) parts.push(phone);
  if (email) parts.push(email);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** 下拉 / 紧凑单元格：昵称 → 手机号 → 邮箱 → ID */
export function formatUserOptionLabel(u: UserContactFields): string {
  return u.name?.trim() || u.phone?.trim() || u.email?.trim() || u.id || "—";
}
