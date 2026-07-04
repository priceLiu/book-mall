/**
 * Gateway 统一模型注册表（DB 真源 + 应用选模 / invoke 校验）。
 */
import type {
  CanvasModelRole,
  GatewayProviderKind,
  ModelMediaKind,
} from "@prisma/client";

import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  PLATFORM_MEDIA_KIND_LABEL,
  canonicalByKey,
  GATEWAY_CANONICAL_REGISTRY,
} from "@/lib/platform-model/canonical-registry";
import { prisma } from "@/lib/prisma";

export class UnregisteredGatewayModelError extends Error {
  readonly modelKey: string;
  constructor(modelKey: string) {
    super(`模型未在 Gateway 注册：${modelKey}`);
    this.name = "UnregisteredGatewayModelError";
    this.modelKey = modelKey;
  }
}

export type RegistryModelRow = {
  canonicalModelKey: string;
  modelKey: string;
  displayName: string;
  description: string;
  role: CanvasModelRole;
  requestKind: string;
  mediaKind: ModelMediaKind | null;
  mediaKindLabel: string | null;
  providerKind: GatewayProviderKind;
  vendor: string;
  credentialBound: boolean;
  creditsPerUnit: number | null;
  platformOffering: boolean;
};

export type ListModelsForAppInput = {
  appTag: string;
  role?: CanvasModelRole;
  /** platform credit: 仅已上架 offering；byok: 全注册表 + 凭证过滤 */
  persona: "PLATFORM_CREDIT" | "BYOK";
  boundKinds: GatewayProviderKind[];
};

/** 按 canonicalKey 去重（保留第一条）。 */
export function dedupeByCanonical<T extends { canonicalModelKey: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.canonicalModelKey)) continue;
    seen.add(r.canonicalModelKey);
    out.push(r);
  }
  return out;
}

export async function assertModelRegistered(modelKey: string): Promise<{
  canonicalModelKey: string;
  providerKind: GatewayProviderKind;
  vendor: string;
}> {
  const key = modelKey.trim();
  if (!key) throw new UnregisteredGatewayModelError(modelKey);

  const registryCount = await prisma.gatewayModelRoute.count({ where: { active: true } });
  if (registryCount === 0) {
    const routed = routeGatewayModel(key);
    return { canonicalModelKey: key, providerKind: routed.providerKind, vendor: "" };
  }

  const routeWhere = {
    active: true as const,
    catalog: { gatewayPublished: true, active: true },
  };

  const direct = await prisma.gatewayModelRoute.findFirst({
    where: { modelKey: key, ...routeWhere },
    include: { catalog: { select: { canonicalKey: true } } },
  });
  if (direct) {
    return {
      canonicalModelKey: direct.canonicalModelKey,
      providerKind: direct.providerKind,
      vendor: direct.vendor,
    };
  }

  const alias = await prisma.modelAlias.findUnique({
    where: {
      source_aliasValue: {
        source: "INTERNAL_SCHEME_A_MODEL",
        aliasValue: key,
      },
    },
    select: { catalog: { select: { canonicalKey: true } } },
  });
  const aliasCanonical = alias?.catalog?.canonicalKey;
  if (aliasCanonical) {
    const viaAlias = await prisma.gatewayModelRoute.findFirst({
      where: { canonicalModelKey: aliasCanonical, ...routeWhere },
      include: { catalog: { select: { canonicalKey: true } } },
      orderBy: { sortOrder: "asc" },
    });
    if (viaAlias) {
      return {
        canonicalModelKey: viaAlias.canonicalModelKey,
        providerKind: viaAlias.providerKind,
        vendor: viaAlias.vendor,
      };
    }
  }

  const codeDef = GATEWAY_CANONICAL_REGISTRY.find((d) =>
    d.routes.some((r) => r.modelKey === key),
  );
  if (codeDef) {
    const codeRoute = codeDef.routes.find((r) => r.modelKey === key)!;
    const viaCanonical = await prisma.gatewayModelRoute.findFirst({
      where: { canonicalModelKey: codeDef.canonicalModelKey, ...routeWhere },
      orderBy: { sortOrder: "asc" },
    });
    if (viaCanonical) {
      return {
        canonicalModelKey: viaCanonical.canonicalModelKey,
        providerKind: codeRoute.providerKind,
        vendor: codeRoute.vendor,
      };
    }
    return {
      canonicalModelKey: codeDef.canonicalModelKey,
      providerKind: codeRoute.providerKind,
      vendor: codeRoute.vendor,
    };
  }

  // 与 registryCount === 0 一致：model-router 可路由的 Story LLM 等仍允许 invoke（UI 硬编码列表与 DB 未同步时）
  try {
    const routed = routeGatewayModel(key);
    return {
      canonicalModelKey: key,
      providerKind: routed.providerKind,
      vendor: "",
    };
  } catch {
    throw new UnregisteredGatewayModelError(key);
  }
}

/** 纯函数：canonical / model-router 侧已知 modelKey（单测与 audit 脚本用）。 */
export function resolveKnownGatewayModelRegistration(modelKey: string): {
  canonicalModelKey: string;
  providerKind: GatewayProviderKind;
  vendor: string;
} | null {
  const key = modelKey.trim();
  if (!key) return null;

  const codeDef = GATEWAY_CANONICAL_REGISTRY.find((d) =>
    d.routes.some((r) => r.modelKey === key),
  );
  if (codeDef) {
    const codeRoute = codeDef.routes.find((r) => r.modelKey === key)!;
    return {
      canonicalModelKey: codeDef.canonicalModelKey,
      providerKind: codeRoute.providerKind,
      vendor: codeRoute.vendor,
    };
  }

  try {
    const routed = routeGatewayModel(key);
    return {
      canonicalModelKey: key,
      providerKind: routed.providerKind,
      vendor: "",
    };
  } catch {
    return null;
  }
}

export async function listActiveRoutes(): Promise<
  Array<{
    route: {
      id: string;
      canonicalModelKey: string;
      vendor: string;
      modelKey: string;
      providerKind: GatewayProviderKind;
    };
    catalog: {
      canonicalKey: string;
      displayName: string;
      role: CanvasModelRole | null;
      requestKind: string | null;
      mediaKind: ModelMediaKind | null;
      appTags: string[];
      gatewayPublished: boolean;
    };
  }>
> {
  const routes = await prisma.gatewayModelRoute.findMany({
    where: { active: true, catalog: { active: true, gatewayPublished: true } },
    include: {
      catalog: {
        select: {
          canonicalKey: true,
          displayName: true,
          role: true,
          requestKind: true,
          mediaKind: true,
          appTags: true,
          gatewayPublished: true,
        },
      },
    },
    orderBy: [{ catalog: { mediaKind: "asc" } }, { sortOrder: "asc" }],
  });
  return routes.map((r) => ({
    route: {
      id: r.id,
      canonicalModelKey: r.canonicalModelKey,
      vendor: r.vendor,
      modelKey: r.modelKey,
      providerKind: r.providerKind,
    },
    catalog: {
      canonicalKey: r.catalog.canonicalKey,
      displayName: r.catalog.displayName,
      role: r.catalog.role,
      requestKind: r.catalog.requestKind,
      mediaKind: r.catalog.mediaKind,
      appTags: r.catalog.appTags,
      gatewayPublished: r.catalog.gatewayPublished,
    },
  }));
}

export async function listModelsForApp(input: ListModelsForAppInput): Promise<RegistryModelRow[]> {
  const appTag = input.appTag.trim().toLowerCase();
  const routes = await listActiveRoutes();

  const offerings =
    input.persona === "PLATFORM_CREDIT"
      ? await prisma.appModelOffering.findMany({
          where: { status: "ACTIVE", activeModelKey: { not: null } },
        })
      : [];

  const offeringByCanonical = new Map(offerings.map((o) => [o.canonicalModelKey, o]));

  const publishedPrices =
    input.persona === "PLATFORM_CREDIT"
      ? await prisma.modelCreditPrice.findMany({
          where: { active: true },
          select: { canonicalModelKey: true, creditsPerUnit: true },
        })
      : [];
  const priceByCanonical = new Map(publishedPrices.map((p) => [p.canonicalModelKey, p]));

  // BYOK: 展示所有凭证匹配的 route（按 modelKey 去重，同 canonical 多厂商可出现多条）
  if (input.persona === "BYOK") {
    const seenKeys = new Set<string>();
    const out: RegistryModelRow[] = [];
    for (const { route, catalog } of routes) {
      if (!catalog.appTags.some((t) => t.toLowerCase() === appTag)) continue;
      if (input.role && catalog.role !== input.role) continue;
      if (!isGatewayProviderBound(input.boundKinds, route.providerKind)) continue;
      if (seenKeys.has(route.modelKey)) continue;
      seenKeys.add(route.modelKey);

      const def = canonicalByKey(catalog.canonicalKey);
      out.push({
        canonicalModelKey: catalog.canonicalKey,
        modelKey: route.modelKey,
        displayName: catalog.displayName,
        description: def?.description ?? "",
        role: catalog.role ?? "LLM",
        requestKind: catalog.requestKind ?? "CHAT",
        mediaKind: catalog.mediaKind,
        mediaKindLabel: catalog.mediaKind ? PLATFORM_MEDIA_KIND_LABEL[catalog.mediaKind] : null,
        providerKind: route.providerKind,
        vendor: route.vendor,
        credentialBound: true,
        creditsPerUnit: null,
        platformOffering: false,
      });
    }
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName, "zh"));
  }

  const rows: RegistryModelRow[] = [];

  for (const { route, catalog } of routes) {
    if (!catalog.appTags.some((t) => t.toLowerCase() === appTag)) continue;
    if (input.role && catalog.role !== input.role) continue;

    const def = canonicalByKey(catalog.canonicalKey);
    const description = def?.description ?? "";

    const offering = offeringByCanonical.get(catalog.canonicalKey);
    if (!offering?.activeModelKey) continue;
    const priceRow = priceByCanonical.get(catalog.canonicalKey);
    if (!priceRow) continue;
    rows.push({
      canonicalModelKey: catalog.canonicalKey,
      modelKey: offering.activeModelKey,
      displayName: offering.displayName,
      description,
      role: catalog.role ?? offering.role,
      requestKind: offering.requestKind,
      mediaKind: catalog.mediaKind,
      mediaKindLabel: catalog.mediaKind ? PLATFORM_MEDIA_KIND_LABEL[catalog.mediaKind] : null,
      providerKind: offering.activeProviderKind ?? route.providerKind,
      vendor: offering.activeVendor ?? route.vendor,
      credentialBound: true,
      creditsPerUnit: offering.publishedCreditsPerUnit ?? priceRow.creditsPerUnit,
      platformOffering: true,
    });
  }

  return dedupeByCanonical(rows);
}

/** Gateway 控制台全量目录（按 provider 分组）。 */
export async function buildGatewayModelCatalogFromDb(boundKinds: GatewayProviderKind[]) {
  const routes = await listActiveRoutes();
  type GroupModel = {
    modelKey: string;
    displayName: string;
    requestKind: string;
    role: string;
    description: string | null;
    canonicalModelKey: string;
    credentialBound: boolean;
  };

  const byProvider = new Map<GatewayProviderKind, GroupModel[]>();

  for (const { route, catalog } of routes) {
    const list = byProvider.get(route.providerKind) ?? [];
    list.push({
      modelKey: route.modelKey,
      displayName: catalog.displayName,
      requestKind: catalog.requestKind ?? "OTHER",
      role: catalog.role ?? "LLM",
      description: canonicalByKey(catalog.canonicalKey)?.description ?? null,
      canonicalModelKey: catalog.canonicalKey,
      credentialBound: isGatewayProviderBound(boundKinds, route.providerKind),
    });
    byProvider.set(route.providerKind, list);
  }

  const PROVIDER_LABEL: Record<GatewayProviderKind, string> = {
    KIE: "KIE",
    DEEPSEEK: "DeepSeek",
    BAILIAN: "通义百炼",
    DASHSCOPE: "DashScope",
    HUNYUAN: "腾讯混元",
    VOLCENGINE: "火山方舟",
    MINIMAX: "MiniMax",
    WORLDLABS: "World Labs",
  };

  type CatalogModel = Omit<GroupModel, "canonicalModelKey">;

  const groups: Array<{
    providerKind: GatewayProviderKind;
    label: string;
    credentialBound: boolean;
    models: CatalogModel[];
  }> = [...byProvider.entries()].map(([providerKind, models]) => ({
    providerKind,
    label: PROVIDER_LABEL[providerKind] ?? providerKind,
    credentialBound: isGatewayProviderBound(boundKinds, providerKind),
    models: dedupeByCanonical(
      models.map((m) => ({ ...m, canonicalModelKey: m.canonicalModelKey })),
    ).map(({ canonicalModelKey: _c, ...m }) => m),
  }));

  const isText = (m: CatalogModel) => m.requestKind === "CHAT" || m.role === "LLM";
  const isImage = (m: CatalogModel) => m.requestKind === "IMAGE" || m.role === "IMAGE";
  const isVideo = (m: CatalogModel) => m.requestKind === "VIDEO" || m.role === "VIDEO";
  const isFunc = (m: CatalogModel) =>
    m.requestKind === "TTS" ||
    m.requestKind === "MUSIC" ||
    m.requestKind === "TRYON" ||
    m.requestKind === "OTHER";

  const filterTabs = (pred: (m: CatalogModel) => boolean) =>
    groups
      .map((g) => ({ ...g, models: g.models.filter(pred) }))
      .filter((g) => g.models.length > 0);

  const flatModels = groups.flatMap((g) => g.models);

  return {
    groups,
    totalCount: flatModels.length,
    boundKinds,
    tabs: {
      text: filterTabs(isText),
      image: filterTabs(isImage),
      video: filterTabs(isVideo),
      function: filterTabs(isFunc),
    },
  };
}
