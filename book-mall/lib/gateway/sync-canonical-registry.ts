import type { PricingBillingKind } from "@prisma/client";

import {
  GATEWAY_CANONICAL_REGISTRY,
  PLATFORM_MEDIA_DEFAULTS,
} from "@/lib/platform-model/canonical-registry";
import { prisma } from "@/lib/prisma";

function billingKind(
  k: "PER_IMAGE" | "PER_SECOND" | "PER_1K_TOKENS" | "PER_CALL" | undefined,
): PricingBillingKind {
  switch (k) {
    case "PER_SECOND":
      return "VIDEO_MODEL_SPEC";
    case "PER_1K_TOKENS":
      return "TOKEN_IN_OUT";
    default:
      return "COST_PER_IMAGE";
  }
}

async function upsertAlias(catalogId: string, modelKey: string) {
  await prisma.modelAlias.upsert({
    where: {
      source_aliasValue: { source: "INTERNAL_SCHEME_A_MODEL", aliasValue: modelKey },
    },
    create: {
      source: "INTERNAL_SCHEME_A_MODEL",
      aliasValue: modelKey,
      catalogId,
      confidence: "HIGH",
      matchedBy: "seed-gateway-registry",
      active: true,
    },
    update: { catalogId, active: true },
  });
}

/** 将 GATEWAY_CANONICAL_REGISTRY 全量 upsert 到 ModelCatalog + GatewayModelRoute。 */
export async function syncGatewayCanonicalRegistryToDb(): Promise<{
  canonicalCount: number;
  mediaDefaultCount: number;
}> {
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    const catalog = await prisma.modelCatalog.upsert({
      where: { canonicalKey: def.canonicalModelKey },
      create: {
        canonicalKey: def.canonicalModelKey,
        displayName: def.displayName,
        vendor: def.primaryVendor,
        billingKind: billingKind(def.billingKind),
        unitLabel: def.unitLabel ?? "元/次",
        active: true,
        gatewayPublished: true,
        requestKind: def.requestKind,
        role: def.role,
        mediaKind: def.mediaKind,
        appTags: def.appTags,
        note: def.description,
      },
      update: {
        displayName: def.displayName,
        vendor: def.primaryVendor,
        billingKind: billingKind(def.billingKind),
        unitLabel: def.unitLabel ?? "元/次",
        active: true,
        gatewayPublished: true,
        requestKind: def.requestKind,
        role: def.role,
        mediaKind: def.mediaKind,
        appTags: def.appTags,
        note: def.description,
      },
    });

    for (let i = 0; i < def.routes.length; i++) {
      const r = def.routes[i]!;
      await prisma.gatewayModelRoute.upsert({
        where: {
          canonicalModelKey_vendor_modelKey: {
            canonicalModelKey: def.canonicalModelKey,
            vendor: r.vendor,
            modelKey: r.modelKey,
          },
        },
        create: {
          canonicalModelKey: def.canonicalModelKey,
          vendor: r.vendor,
          modelKey: r.modelKey,
          providerKind: r.providerKind,
          active: true,
          sortOrder: i,
        },
        update: {
          providerKind: r.providerKind,
          active: true,
          sortOrder: i,
        },
      });
      await upsertAlias(catalog.id, r.modelKey);
    }
  }

  for (const [mediaKind, defaultCanonicalKey] of Object.entries(PLATFORM_MEDIA_DEFAULTS)) {
    await prisma.platformMediaDefault.upsert({
      where: { mediaKind: mediaKind as keyof typeof PLATFORM_MEDIA_DEFAULTS },
      create: {
        mediaKind: mediaKind as keyof typeof PLATFORM_MEDIA_DEFAULTS,
        defaultCanonicalKey,
      },
      update: { defaultCanonicalKey },
    });
  }

  const validRouteKeys = new Set<string>();
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    for (const r of def.routes) {
      validRouteKeys.add(`${def.canonicalModelKey}\0${r.vendor}\0${r.modelKey}`);
    }
  }
  const staleRoutes = await prisma.gatewayModelRoute.findMany({
    where: { active: true },
    select: { id: true, canonicalModelKey: true, vendor: true, modelKey: true },
  });
  for (const route of staleRoutes) {
    const key = `${route.canonicalModelKey}\0${route.vendor}\0${route.modelKey}`;
    if (!validRouteKeys.has(key)) {
      await prisma.gatewayModelRoute.update({
        where: { id: route.id },
        data: { active: false },
      });
    }
  }

  return {
    canonicalCount: GATEWAY_CANONICAL_REGISTRY.length,
    mediaDefaultCount: Object.keys(PLATFORM_MEDIA_DEFAULTS).length,
  };
}

let syncInFlight: Promise<void> | null = null;

/**
 * 代码注册表有新增 canonical 时自动补齐 DB，避免 Gateway 模型管理页缺项。
 * 仅在检测到缺失 canonical 时执行全量 upsert（幂等）。
 */
export async function ensureGatewayCanonicalRegistrySynced(): Promise<void> {
  const registryKeys = GATEWAY_CANONICAL_REGISTRY.map((d) => d.canonicalModelKey);
  const dbCount = await prisma.modelCatalog.count({
    where: {
      canonicalKey: { in: registryKeys },
      gatewayPublished: true,
      active: true,
    },
  });
  if (dbCount >= registryKeys.length) return;

  if (!syncInFlight) {
    syncInFlight = syncGatewayCanonicalRegistryToDb()
      .then(() => undefined)
      .finally(() => {
        syncInFlight = null;
      });
  }
  await syncInFlight;
}
