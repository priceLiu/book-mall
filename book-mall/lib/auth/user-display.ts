/** Gateway / Book 同步用的 `{phone}@phone.book` 标识 */
export function phoneFromGatewayEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = "@phone.book";
  if (email.endsWith(suffix)) return email.slice(0, -suffix.length);
  return null;
}

/** 用户可见主标识：昵称 → 手机号 → 真实邮箱 → id 前缀 */
export function formatUserDisplayLabel(opts: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  id?: string;
}): string {
  const name = opts.name?.trim();
  const phone = opts.phone?.trim() || phoneFromGatewayEmail(opts.email)?.trim();
  const email = opts.email?.trim();
  const realEmail = email && !phoneFromGatewayEmail(email) ? email : null;
  return name || phone || realEmail || opts.id?.slice(0, 8) || "用户";
}
