/**
 * 导入 Gateway 统一模型注册表（ModelCatalog + GatewayModelRoute + PlatformMediaDefault）。
 *
 *   pnpm tsx scripts/seed-gateway-model-registry.ts --confirm
 */
import type { PricingBillingKind } from "@prisma/client";

import {
  GATEWAY_CANONICAL_REGISTRY,
  PLATFORM_MEDIA_DEFAULTS,
} from "../lib/platform-model/canonical-registry";
import { prisma } from "../lib/prisma";

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

async function main() {
  const confirm = process.argv.includes("--confirm");
  if (!confirm) {
    console.log(`将写入 ${GATEWAY_CANONICAL_REGISTRY.length} 个 canonical 模型。请加 --confirm 执行。`);
    return;
  }

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

  console.log(
    `已 seed ${GATEWAY_CANONICAL_REGISTRY.length} 个 canonical 与 ${Object.keys(PLATFORM_MEDIA_DEFAULTS).length} 个媒介默认槽。`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
