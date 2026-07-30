import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeKey } from "@/lib/generation/traffic-control/scope-key";
import {
  parseBurstOverride,
  parseGenerationSubmitTier,
  requireAdminSession,
} from "@/lib/admin/generation-quota-admin";
import { batchStampTenantSubmitQuota } from "@/lib/generation/submit-rate/stamp-traffic-state";
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

  const where: Prisma.TenantWhereInput = { type: "TEAM" };
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }
  if (tierFilter) {
    where.generationSubmitTier = tierFilter;
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        status: true,
        seatLimit: true,
        generationSubmitTier: true,
        generationSubmitBurstOverride: true,
        owner: { select: { email: true, name: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  const scopeKeys = tenants.map((t) => buildTenantScopeKey(t.id));
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
    items: tenants.map((t) => {
      const scopeKey = buildTenantScopeKey(t.id);
      const state = stateByScope.get(scopeKey);
      const effective = resolveSubmitQuotaFromSource({
        tier: t.generationSubmitTier,
        burstOverride: t.generationSubmitBurstOverride,
      });
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        seatLimit: t.seatLimit,
        ownerEmail: t.owner.email,
        ownerName: t.owner.name,
        configuredTier: t.generationSubmitTier,
        configuredTierLabel: t.generationSubmitTier
          ? GENERATION_SUBMIT_TIER_LABEL[t.generationSubmitTier]
          : null,
        burstOverride: t.generationSubmitBurstOverride,
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
    tenantIds?: string[];
    tier?: unknown;
    burstOverride?: unknown;
  };

  const tier = parseGenerationSubmitTier(payload.tier);
  if (!tier) {
    return NextResponse.json({ error: "tier required" }, { status: 400 });
  }

  const tenantIds = Array.isArray(payload.tenantIds)
    ? payload.tenantIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (tenantIds.length === 0) {
    return NextResponse.json({ error: "tenantIds required" }, { status: 400 });
  }

  let burstOverride = parseBurstOverride(payload.burstOverride);
  if (tier !== "HEAVY") {
    burstOverride = null;
  }

  await prisma.tenant.updateMany({
    where: { id: { in: tenantIds } },
    data: {
      generationSubmitTier: tier,
      generationSubmitBurstOverride: burstOverride,
    },
  });

  await batchStampTenantSubmitQuota(tenantIds);

  return NextResponse.json({ ok: true, updated: tenantIds.length, tier, burstOverride });
}
