import { NextResponse } from "next/server";
import type { GenerationSubmitTier, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildUserScopeKey } from "@/lib/generation/traffic-control/scope-key";
import {
  parseBurstOverride,
  parseGenerationSubmitTier,
  requireAdminSession,
} from "@/lib/admin/generation-quota-admin";
import { batchStampUserSubmitQuota } from "@/lib/generation/submit-rate/stamp-traffic-state";
import { GENERATION_SUBMIT_TIER_LABEL } from "@/lib/generation/submit-rate/constants";
import { resolveSubmitQuotaFromSource } from "@/lib/generation/submit-rate/resolve-submit-quota";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const tierFilter = parseGenerationSubmitTier(url.searchParams.get("tier"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  if (tierFilter) {
    where.generationSubmitTier = tierFilter;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        generationSubmitTier: true,
        generationSubmitBurstOverride: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const scopeKeys = users.map((u) => buildUserScopeKey(u.id));
  const states =
    scopeKeys.length > 0
      ? await prisma.generationTrafficState.findMany({
          where: { scopeKey: { in: scopeKeys } },
          select: {
            scopeKey: true,
            submitBurstLimit: true,
            submitTier: true,
            updatedAt: true,
          },
        })
      : [];
  const stateByScope = new Map(states.map((s) => [s.scopeKey, s]));

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total,
    items: users.map((u) => {
      const scopeKey = buildUserScopeKey(u.id);
      const state = stateByScope.get(scopeKey);
      const effective = resolveSubmitQuotaFromSource({
        tier: u.generationSubmitTier,
        burstOverride: u.generationSubmitBurstOverride,
        userRole: u.role,
      });
      return {
        id: u.id,
        email: u.email,
        phone: u.phone,
        name: u.name,
        role: u.role,
        configuredTier: u.generationSubmitTier,
        configuredTierLabel: u.generationSubmitTier
          ? GENERATION_SUBMIT_TIER_LABEL[u.generationSubmitTier]
          : null,
        burstOverride: u.generationSubmitBurstOverride,
        effectiveTier: effective.tier,
        effectiveTierLabel: GENERATION_SUBMIT_TIER_LABEL[effective.tier],
        effectiveBurstLimit: effective.burstLimit,
        stampedBurstLimit: state?.submitBurstLimit ?? null,
        stampedTier: state?.submitTier ?? null,
        stampedAt: state?.updatedAt?.toISOString() ?? null,
        scopeKey,
      };
    }),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const payload = body as {
    userIds?: string[];
    tier?: unknown;
    burstOverride?: unknown;
  };

  const tier = parseGenerationSubmitTier(payload.tier);
  if (!tier) {
    return NextResponse.json({ error: "tier required" }, { status: 400 });
  }

  const userIds = Array.isArray(payload.userIds)
    ? payload.userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  let burstOverride = parseBurstOverride(payload.burstOverride);
  if (tier !== "HEAVY") {
    burstOverride = null;
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      generationSubmitTier: tier,
      generationSubmitBurstOverride: burstOverride,
    },
  });

  await batchStampUserSubmitQuota(userIds);

  return NextResponse.json({ ok: true, updated: userIds.length, tier, burstOverride });
}
