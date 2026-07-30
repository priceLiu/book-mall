import type { GenerationSubmitTier, UserRole } from "@prisma/client";
import {
  burstLimitForTier,
  SUBMIT_BURST_ELEVATED,
  SUBMIT_BURST_STANDARD,
} from "@/lib/generation/submit-rate/constants";

export type ResolvedSubmitQuota = {
  tier: GenerationSubmitTier;
  burstLimit: number;
};

function isAdminDefaultElevated(role: UserRole | string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function resolveSubmitQuotaFromSource(input: {
  tier?: GenerationSubmitTier | null;
  burstOverride?: number | null;
  userRole?: UserRole | string | null;
}): ResolvedSubmitQuota {
  if (input.tier) {
    return {
      tier: input.tier,
      burstLimit: burstLimitForTier(input.tier, input.burstOverride),
    };
  }

  if (isAdminDefaultElevated(input.userRole)) {
    return { tier: "ELEVATED", burstLimit: SUBMIT_BURST_ELEVATED };
  }

  return { tier: "STANDARD", burstLimit: SUBMIT_BURST_STANDARD };
}
