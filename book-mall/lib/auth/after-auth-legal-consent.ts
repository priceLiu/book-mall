import type { Session } from "next-auth";

import { submitAiLegalConsent } from "@/lib/auth/submit-ai-legal-consent-client";

type SessionUpdate = (data?: { aiLegalConsentComplete?: boolean }) => Promise<Session | null>;

/** 登录/注册成功后：补写缺失的法律同意时间，并刷新会话标记。 */
export async function syncAiLegalConsentAfterAuth(
  update: SessionUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const res = await submitAiLegalConsent();
  if (!res.ok) return res;
  await update({ aiLegalConsentComplete: true });
  return { ok: true };
}