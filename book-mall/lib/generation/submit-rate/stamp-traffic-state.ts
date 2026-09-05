import type { GenerationSubmitTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildTenantScopeKey,
  buildUserScopeKey,
} from "@/lib/generation/traffic-control/scope-key";
import { resolveSubmitQuotaFromSource } from "@/lib/generation/submit-rate/resolve-submit-quota";
import { SUBMIT_WINDOW_SEC } from "@/lib/generation/submit-rate/constants";
import {
  setCachedSubmitQuota,
} from "@/lib/generation/submit-rate/submit-quota-cache";

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

async function readUserSubmitSource(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      generationSubmitTier: true,
      generationSubmitBurstOverride: true,
    },
  });
}

async function readTenantSubmitSource(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      generationSubmitTier: true,
      generationSubmitBurstOverride: true,
    },
  });
}

export async function stampUserSubmitQuota(userId: string): Promise<void> {
  const user = await readUserSubmitSource(userId);
  if (!user) return;

  const resolved = resolveSubmitQuotaFromSource({
    tier: user.generationSubmitTier,
    burstOverride: user.generationSubmitBurstOverride,
    userRole: user.role,
  });

  await upsertSubmitQuotaStamp(buildUserScopeKey(userId), resolved);
}

export async function stampTenantSubmitQuota(tenantId: string): Promise<void> {
  const tenant = await readTenantSubmitSource(tenantId);
  if (!tenant) return;

  const resolved = resolveSubmitQuotaFromSource({
    tier: tenant.generationSubmitTier,
    burstOverride: tenant.generationSubmitBurstOverride,
  });

  await upsertSubmitQuotaStamp(buildTenantScopeKey(tenantId), resolved);
}

export async function upsertSubmitQuotaStamp(
  scopeKey: string,
  resolved: { tier: GenerationSubmitTier; burstLimit: number },
): Promise<void> {
  const { ownerType, ownerId } = parseScopeKey(scopeKey);

  const existing = await prisma.generationTrafficState.findUnique({
    where: { scopeKey },
    select: { quotaConfigVersion: true },
  });

  const nextVersion = (existing?.quotaConfigVersion ?? 0) + 1;

  await prisma.generationTrafficState.upsert({
    where: { scopeKey },
    create: {
      scopeKey,
      ownerType,
      ownerId,
      submitBurstLimit: resolved.burstLimit,
      submitTier: resolved.tier,
      submitWindowSec: SUBMIT_WINDOW_SEC,
      submitCount: 0,
      submitWindowStartAt: null,
      quotaConfigVersion: nextVersion,
    },
    update: {
      submitBurstLimit: resolved.burstLimit,
      submitTier: resolved.tier,
      submitWindowSec: SUBMIT_WINDOW_SEC,
      quotaConfigVersion: nextVersion,
    },
  });

  setCachedSubmitQuota(scopeKey, {
    burstLimit: resolved.burstLimit,
    tier: resolved.tier,
    version: nextVersion,
  });
}

export async function batchStampUserSubmitQuota(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await stampUserSubmitQuota(userId);
  }
}

export async function batchStampTenantSubmitQuota(tenantIds: string[]): Promise<void> {
  for (const tenantId of tenantIds) {
    await stampTenantSubmitQuota(tenantId);
  }
}
