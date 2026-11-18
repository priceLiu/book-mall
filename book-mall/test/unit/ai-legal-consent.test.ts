import { describe, expect, it } from "vitest";

import {
  buildAiLegalConsentUpdate,
  isAiLegalConsentComplete,
} from "@/lib/auth/ai-legal-consent";
describe("ai legal consent", () => {
  it("detects complete consent", () => {
    const now = new Date();
    expect(
      isAiLegalConsentComplete({
        aiUserAgreementAcceptedAt: now,
        aiAppPermissionsAcceptedAt: now,
        aiPrivacyPolicyAcceptedAt: now,
      }),
    ).toBe(true);
    expect(
      isAiLegalConsentComplete({
        aiUserAgreementAcceptedAt: now,
        aiAppPermissionsAcceptedAt: null,
        aiPrivacyPolicyAcceptedAt: now,
      }),
    ).toBe(false);
  });

  it("only patches missing fields", () => {
    const agreed = new Date("2020-01-01");
    const patch = buildAiLegalConsentUpdate(
      {
        aiUserAgreementAcceptedAt: agreed,
        aiAppPermissionsAcceptedAt: null,
        aiPrivacyPolicyAcceptedAt: null,
      },
      { userAgreement: true, appPermissions: true, privacyPolicy: true },
    );
    expect(patch.aiUserAgreementAcceptedAt).toBeUndefined();
    expect(patch.aiAppPermissionsAcceptedAt).toBeInstanceOf(Date);
    expect(patch.aiPrivacyPolicyAcceptedAt).toBeInstanceOf(Date);
  });

});