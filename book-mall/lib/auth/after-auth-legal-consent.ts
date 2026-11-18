import type { Session } from "next-auth";

import { submitAiLegalConsent } from "@/lib/auth/submit-ai-legal-consent-client";

type SessionUpdate = (data?: { aiLegalConsentComplete?: boolean }) => Promise<Session | null>;

/** 补签弹窗等场景：写入缺失的法律同意时间并刷新 JWT 标记（登录页不再调用）。 */
export async function syncAiLegalConsentAfterAuth(
  update: SessionUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const res = await submitAiLegalConsent();
  if (!res.ok) return res;
  await update({ aiLegalConsentComplete: true });
  return { ok: true };
}