import { z } from "zod";

export const aiLegalConsentBodySchema = z.object({
  userAgreement: z.literal(true),
  appPermissions: z.literal(true),
  privacyPolicy: z.literal(true),
});

export type AiLegalConsentBody = z.infer<typeof aiLegalConsentBodySchema>;

export type AiLegalConsentTimestamps = {
  aiUserAgreementAcceptedAt: Date | null;
  aiAppPermissionsAcceptedAt: Date | null;
  aiPrivacyPolicyAcceptedAt: Date | null;
};

export function isAiLegalConsentComplete(user: AiLegalConsentTimestamps): boolean {
  return Boolean(
    user.aiUserAgreementAcceptedAt &&
      user.aiAppPermissionsAcceptedAt &&
      user.aiPrivacyPolicyAcceptedAt,
  );
}

/** 注册：三份同时落库。补签：仅为此前为空字段写入勾选时间。 */
export function buildAiLegalConsentUpdate(
  user: AiLegalConsentTimestamps,
  _consent: AiLegalConsentBody,
): Partial<AiLegalConsentTimestamps> {
  const now = new Date();
  const patch: Partial<AiLegalConsentTimestamps> = {};
  if (!user.aiUserAgreementAcceptedAt) patch.aiUserAgreementAcceptedAt = now;
  if (!user.aiAppPermissionsAcceptedAt) patch.aiAppPermissionsAcceptedAt = now;
  if (!user.aiPrivacyPolicyAcceptedAt) patch.aiPrivacyPolicyAcceptedAt = now;
  return patch;
}

export function buildAiLegalConsentForRegistration(): AiLegalConsentTimestamps {
  const now = new Date();
  return {
    aiUserAgreementAcceptedAt: now,
    aiAppPermissionsAcceptedAt: now,
    aiPrivacyPolicyAcceptedAt: now,
  };
}