/** SSO 授权码 · 短时重复 exchange 宽限（浏览器/callback 双请求时不致 400）。 */
export const SSO_EXCHANGE_REPLAY_GRACE_MS = 120_000;

export function isSsoAuthorizationCodeReplayAllowed(
  row: { consumedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  if (!row.consumedAt) return false;
  if (row.expiresAt < now) return false;
  return now.getTime() - row.consumedAt.getTime() <= SSO_EXCHANGE_REPLAY_GRACE_MS;
}
