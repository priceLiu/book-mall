import type { GenerationSubmitTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GENERATION_SUBMIT_TIER_LABEL,
  SUBMIT_BURST_STANDARD,
  SUBMIT_WINDOW_SEC,
} from "@/lib/generation/submit-rate/constants";
import {
  getCachedSubmitQuota,
  setCachedSubmitQuota,
} from "@/lib/generation/submit-rate/submit-quota-cache";

export class SubmitBurstLimitError extends Error {
  readonly code = "SUBMIT_BURST_LIMIT" as const;
  readonly retryAfterSec: number;
  readonly tier: GenerationSubmitTier | null;
  readonly limit: number;

  constructor(input: {
    retryAfterSec: number;
    tier: GenerationSubmitTier | null;
    limit: number;
  }) {
    const tierLabel = input.tier
      ? GENERATION_SUBMIT_TIER_LABEL[input.tier]
      : GENERATION_SUBMIT_TIER_LABEL.STANDARD;
    super(
      `提交过于频繁，请 ${input.retryAfterSec} 秒后重试（当前档位：${tierLabel}，${SUBMIT_WINDOW_SEC} 秒内最多 ${input.limit} 次）`,
    );
    this.name = "SubmitBurstLimitError";
    this.retryAfterSec = input.retryAfterSec;
    this.tier = input.tier;
    this.limit = input.limit;
  }
}

function parseScopeKey(scopeKey: string): {
  ownerType: "USER" | "TENANT";
  ownerId: string;
} {
  if (scopeKey.startsWith("tenant:")) {
    return { ownerType: "TENANT", ownerId: scopeKey.slice("tenant:".length) };
  }
  if (scopeKey.startsWith("user:")) {
    return { ownerType: "USER", ownerId: scopeKey.slice("user:".length) };
  }
  throw new Error(`invalid submit quota scopeKey: ${scopeKey}`);
}

async function loadSubmitQuotaConfig(scopeKey: string): Promise<{
  burstLimit: number;
  tier: GenerationSubmitTier | null;
  version: number;
}> {
  const cached = getCachedSubmitQuota(scopeKey);
  if (cached) {
    return {
      burstLimit: cached.burstLimit,
      tier: cached.tier,
      version: cached.version,
    };
  }

  const state = await prisma.generationTrafficState.findUnique({
    where: { scopeKey },
    select: {
      submitBurstLimit: true,
      submitTier: true,
      quotaConfigVersion: true,
    },
  });

  const burstLimit = state?.submitBurstLimit ?? SUBMIT_BURST_STANDARD;
  const tier = state?.submitTier ?? null;
  const version = state?.quotaConfigVersion ?? 0;

  setCachedSubmitQuota(scopeKey, { burstLimit, tier, version });
  return { burstLimit, tier, version };
}

function windowExpired(windowStart: Date | null, now: Date, windowSec: number): boolean {
  if (!windowStart) return true;
  return now.getTime() - windowStart.getTime() >= windowSec * 1000;
}

function retryAfterSec(windowStart: Date, now: Date, windowSec: number): number {
  const endMs = windowStart.getTime() + windowSec * 1000;
  return Math.max(1, Math.ceil((endMs - now.getTime()) / 1000));
}

export async function assertSubmitBurstAllowed(scopeKey: string): Promise<void> {
  const now = new Date();
  const config = await loadSubmitQuotaConfig(scopeKey);
  const burstLimit = config.burstLimit;
  const { ownerType, ownerId } = parseScopeKey(scopeKey);

  await prisma.$transaction(async (tx) => {
    let state = await tx.generationTrafficState.findUnique({
      where: { scopeKey },
      select: {
        submitCount: true,
        submitWindowStartAt: true,
        submitWindowSec: true,
        submitBurstLimit: true,
        submitTier: true,
      },
    });

    if (!state) {
      await tx.generationTrafficState.create({
        data: {
          scopeKey,
          ownerType,
          ownerId,
          submitBurstLimit: burstLimit,
          submitTier: config.tier,
          submitWindowSec: SUBMIT_WINDOW_SEC,
          submitCount: 1,
          submitWindowStartAt: now,
        },
      });
      return;
    }

    const windowSec = state.submitWindowSec || SUBMIT_WINDOW_SEC;
    const limit = state.submitBurstLimit ?? burstLimit;
    const tier = state.submitTier ?? config.tier;

    if (windowExpired(state.submitWindowStartAt, now, windowSec)) {
      await tx.generationTrafficState.update({
        where: { scopeKey },
        data: {
          submitCount: 1,
          submitWindowStartAt: now,
        },
      });
      return;
    }

    const windowStart = state.submitWindowStartAt!;
    if (state.submitCount >= limit) {
      throw new SubmitBurstLimitError({
        retryAfterSec: retryAfterSec(windowStart, now, windowSec),
        tier,
        limit,
      });
    }

    await tx.generationTrafficState.update({
      where: { scopeKey },
      data: { submitCount: { increment: 1 } },
    });
  });
}
