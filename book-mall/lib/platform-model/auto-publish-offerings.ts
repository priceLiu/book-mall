import type { CanvasModelRole, GatewayProviderKind } from "@prisma/client";

import {
  marginGuardForUnit,
  marginPassesGuard,
  publishModelCreditPrice,
  loadPricingConfig,
  computeCreditPrice,
  resolveModelMarginM,
} from "@/lib/pricing/credit-pricing-engine";
import { prisma } from "@/lib/prisma";
import {
  GATEWAY_CANONICAL_REGISTRY,
  type CanonicalRouteDef,
} from "@/lib/platform-model/canonical-registry";

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

async function loadRoutesForCanonical(
  canonicalModelKey: string,
): Promise<CanonicalRouteDef[]> {
  const dbRoutes = await prisma.gatewayModelRoute.findMany({
    where: { canonicalModelKey, active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (dbRoutes.length > 0) {
    return dbRoutes.map((r) => ({
      vendor: r.vendor,
      modelKey: r.modelKey,
      providerKind: r.providerKind,
    }));
  }
  const def = GATEWAY_CANONICAL_REGISTRY.find((c) => c.canonicalModelKey === canonicalModelKey);
  return def?.routes ?? [];
}

async function pickBestRoute(
  canonicalModelKey: string,
  config: Awaited<ReturnType<typeof loadPricingConfig>>,
  costCanonicalKey?: string,
): Promise<{
  route: CanonicalRouteDef;
  netCostYuan: number;
  marginOk: boolean;
  estimatedMargin: number;
  creditsPerUnit: number;
} | null> {
  let best: {
    route: CanonicalRouteDef;
    netCostYuan: number;
    marginOk: boolean;
    estimatedMargin: number;
    creditsPerUnit: number;
  } | null = null;

  const routes = await loadRoutesForCanonical(canonicalModelKey);
  const costKey = costCanonicalKey ?? canonicalModelKey;

  for (const route of routes) {
    const profiles = await prisma.modelCostProfile.findMany({
      where: { canonicalModelKey: costKey, vendor: route.vendor, active: true },
      orderBy: [{ channel: "asc" }, { netCostYuan: "asc" }],
    });
    const profile = profiles[0];
    if (!profile) continue;

    const netCostYuan = toNum(profile.netCostYuan);
    const marginM = resolveModelMarginM({
      unit: profile.unit,
      netCostYuan,
      defaultMarginM: config.defaultMarginM,
      videoMarginM: config.videoMarginM,
    });
    const minGuard = marginGuardForUnit(profile.unit, config);
    const comp = computeCreditPrice({
      listCostYuan: toNum(profile.listCostYuan),
      discountRate: toNum(profile.discountRate),
      marginM,
      anchorYuan: config.creditAnchorYuan,
    });
    const marginOk = marginPassesGuard(comp.baseMarginRate, minGuard);
    if (!marginOk) continue;

    if (!best || netCostYuan < best.netCostYuan) {
      best = {
        route,
        netCostYuan,
        marginOk,
        estimatedMargin: comp.baseMarginRate,
        creditsPerUnit: comp.creditsPerUnit,
      };
    }
  }

  return best;
}

export async function autoPublishPlatformOfferings(input?: {
  canonicalKeys?: string[];
  publishedBy?: string;
}): Promise<{ published: number; skipped: number; warnings: string[] }> {
  const config = await loadPricingConfig();
  const defs = input?.canonicalKeys
    ? GATEWAY_CANONICAL_REGISTRY.filter((c) =>
        input.canonicalKeys!.includes(c.canonicalModelKey),
      )
    : GATEWAY_CANONICAL_REGISTRY;

  let published = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const def of defs) {
    const offering = await prisma.appModelOffering.findUnique({
      where: { canonicalModelKey: def.canonicalModelKey },
    });
    if (offering?.routeLocked) {
      skipped++;
      continue;
    }

    const pricingCanonicalKey =
      def.canonicalModelKey === "lib-nano-pro"
        ? "lib-nano-pro-2k"
        : def.canonicalModelKey;

    const best = await pickBestRoute(
      def.canonicalModelKey,
      config,
      pricingCanonicalKey,
    );
    if (!best) {
      warnings.push(`${def.canonicalModelKey}: 无合规路由（成本或毛利不达标）`);
      skipped++;
      continue;
    }

    try {
      if (def.canonicalModelKey === "lib-nano-pro") {
        await publishModelCreditPrice({
          canonicalModelKey: pricingCanonicalKey,
          displayName: `${def.displayName} · 2K`,
          publishedBy: input?.publishedBy,
        });
      } else {
        await publishModelCreditPrice({
          canonicalModelKey: def.canonicalModelKey,
          displayName: def.displayName,
          publishedBy: input?.publishedBy,
        });
      }
    } catch (e) {
      warnings.push(
        `${def.canonicalModelKey}: 发布报价失败 ${e instanceof Error ? e.message : String(e)}`,
      );
      skipped++;
      continue;
    }

    const offeringRow = await prisma.appModelOffering.upsert({
      where: { canonicalModelKey: def.canonicalModelKey },
      create: {
        canonicalModelKey: def.canonicalModelKey,
        role: def.role,
        displayName: def.displayName,
        requestKind: def.requestKind,
        sortOrder: def.sortOrder,
        status: "ACTIVE",
        activeCanonicalKey: def.canonicalModelKey,
        activeVendor: best.route.vendor,
        activeProviderKind: best.route.providerKind,
        activeModelKey: best.route.modelKey,
        publishedCreditsPerUnit: best.creditsPerUnit,
        estimatedMargin: best.estimatedMargin,
      },
      update: {
        displayName: def.displayName,
        requestKind: def.requestKind,
        sortOrder: def.sortOrder,
        status: "ACTIVE",
        activeCanonicalKey: def.canonicalModelKey,
        activeVendor: best.route.vendor,
        activeProviderKind: best.route.providerKind,
        activeModelKey: best.route.modelKey,
        publishedCreditsPerUnit: best.creditsPerUnit,
        estimatedMargin: best.estimatedMargin,
      },
    });

    const routes = await loadRoutesForCanonical(def.canonicalModelKey);
    await prisma.appModelCandidate.deleteMany({ where: { offeringId: offeringRow.id } });

    for (const r of routes) {
      const profiles = await prisma.modelCostProfile.findMany({
        where: { canonicalModelKey: def.canonicalModelKey, vendor: r.vendor, active: true },
      });
      const profile = profiles[0];
      const netCostYuan = profile ? toNum(profile.netCostYuan) : 0;
      let marginOk = false;
      if (profile) {
        const comp = computeCreditPrice({
          listCostYuan: toNum(profile.listCostYuan),
          discountRate: toNum(profile.discountRate),
          marginM: resolveModelMarginM({
            unit: profile.unit,
            netCostYuan,
            defaultMarginM: config.defaultMarginM,
            videoMarginM: config.videoMarginM,
          }),
          anchorYuan: config.creditAnchorYuan,
        });
        marginOk = marginPassesGuard(
          comp.baseMarginRate,
          marginGuardForUnit(profile.unit, config),
        );
      }
      await prisma.appModelCandidate.create({
        data: {
          offeringId: offeringRow.id,
          vendor: r.vendor,
          canonicalModelKey: def.canonicalModelKey,
          providerKind: r.providerKind,
          modelKey: r.modelKey,
          netCostYuan,
          marginOk,
          isActiveRoute:
            r.modelKey === best.route.modelKey && r.vendor === best.route.vendor,
        },
      });
    }

    await prisma.offeringPublishLog.create({
      data: {
        offeringId: offeringRow.id,
        action: "AUTO_PUBLISH",
        toCanonicalKey: def.canonicalModelKey,
        toProviderKind: best.route.providerKind,
        netCostYuan: best.netCostYuan,
        estimatedMargin: best.estimatedMargin,
        publishedBy: input?.publishedBy ?? "system",
      },
    });

    published++;
  }

  const validKeys = new Set(defs.map((d) => d.canonicalModelKey));
  await prisma.appModelOffering.updateMany({
    where: {
      status: { not: "DEPRECATED" },
      canonicalModelKey: { notIn: [...validKeys] },
    },
    data: { status: "DEPRECATED" },
  });

  return { published, skipped, warnings };
}

export type PlatformModelRow = {
  canonicalModelKey: string;
  modelKey: string;
  displayName: string;
  description: string;
  role: CanvasModelRole;
  requestKind: string;
  creditsPerUnit: number | null;
  credentialBound: true;
};

/** 平台代付：按 appTag / appKey 返回已上架模型（每 canonical 一行）。 */
export async function listPlatformModelsForApp(input: {
  appKey?: string;
  appTag?: string;
  role?: CanvasModelRole;
}): Promise<PlatformModelRow[]> {
  const tag = (input.appTag ?? input.appKey ?? "canvas").trim().toLowerCase();
  const normalized =
    tag === "e-commerce-toolkit" || tag === "ecom-toolkit"
      ? "ecom"
      : tag === "prompt-optimizer"
        ? "prompt-optimizer"
        : tag;
  const defs = GATEWAY_CANONICAL_REGISTRY.filter((c) =>
    c.appTags.some((t) => t.toLowerCase() === normalized),
  );

  const keys = defs.map((d) => d.canonicalModelKey);
  const rows = await prisma.appModelOffering.findMany({
    where: {
      canonicalModelKey: { in: keys },
      status: "ACTIVE",
      ...(input.role ? { role: input.role } : {}),
      activeModelKey: { not: null },
    },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  const defMap = new Map(defs.map((d) => [d.canonicalModelKey, d]));

  return rows.map((r) => {
    const def = defMap.get(r.canonicalModelKey);
    return {
      canonicalModelKey: r.canonicalModelKey,
      modelKey: r.activeModelKey!,
      displayName: r.displayName,
      description: def?.description ?? "",
      role: r.role,
      requestKind: r.requestKind,
      creditsPerUnit: r.publishedCreditsPerUnit,
      credentialBound: true as const,
    };
  });
}
