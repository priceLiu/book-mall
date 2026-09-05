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
import {
  getCachedActiveRoutes,
  getCachedModelsForApp,
  setCachedActiveRoutes,
  setCachedModelsForApp,
} from "@/lib/gateway/model-list-cache";
import {
  getShelfMetaForCanonical,
  isCanonicalVisibleOnShelf,
  loadShelfIndexForApp,
} from "@/lib/platform-model/app-model-shelf";
import { resolveSourceLabel } from "@/lib/gateway/model-source-label";
import { ensureGatewayCanonicalRegistrySynced } from "@/lib/gateway/sync-canonical-registry";
import {
  gatewayRouteDisplayName,
  marketTaskTagsForModel,
  shouldShowRouteInGatewayCatalog,
  taskTagsToCapabilities,
} from "@/lib/gateway/gateway-model-capabilities";
import { WORLDLABS_MARBLE_MODELS } from "@/lib/gateway/worldlabs-marble-models";
import { TOPAZ_VIDEO_MODELS } from "@/lib/gateway/topaz-models";
import {
  ELEVENLABS_SFX_MODELS,
  ELEVENLABS_STS_MODELS,
  ELEVENLABS_MUSIC_MODELS,
} from "@/lib/gateway/elevenlabs-models";

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
  sourceLabel: string;
  sortOrder: number;
};

export type ListModelsForAppInput = {
  appTag: string;
  role?: CanvasModelRole;
  /** 应用内场景（如 pro2-video、qr-t2v）；空则仅按 app 全局 shelf 过滤 */
  sceneKey?: string | null;
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

/** Gateway 控制台：按 modelKey 去重，保留各厂商路由独立展示。 */
export function dedupeByModelKey<T extends { modelKey: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.modelKey)) continue;
    seen.add(r.modelKey);
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

export async function listActiveRoutesUncached(): Promise<
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
      sourceLabel: string | null;
    };
  }>
> {
  await ensureGatewayCanonicalRegistrySynced();
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
          sourceLabel: true,
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
      sourceLabel: r.catalog.sourceLabel,
    },
  }));
}

export async function listActiveRoutes(): Promise<
  Awaited<ReturnType<typeof listActiveRoutesUncached>>
> {
  const cached = getCachedActiveRoutes();
  if (cached) return cached;
  const routes = await listActiveRoutesUncached();
  setCachedActiveRoutes(routes);
  return routes;
}

export async function listModelsForApp(input: ListModelsForAppInput): Promise<RegistryModelRow[]> {
  const cached = getCachedModelsForApp(input);
  if (cached) return cached;

  await ensureGatewayCanonicalRegistrySynced();
  const appTag = input.appTag.trim().toLowerCase();
  const shelfCtx = { appTag, sceneKey: input.sceneKey };
  const shelfByScene = await loadShelfIndexForApp(appTag);
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

  function appendRow(
    out: RegistryModelRow[],
    params: {
      canonicalModelKey: string;
      modelKey: string;
      displayName: string;
      description: string;
      role: CanvasModelRole;
      requestKind: string;
      mediaKind: ModelMediaKind | null;
      providerKind: GatewayProviderKind;
      vendor: string;
      catalogSourceLabel: string | null;
      creditsPerUnit: number | null;
      platformOffering: boolean;
    },
  ): void {
    if (!isCanonicalVisibleOnShelf(shelfByScene, params.canonicalModelKey, shelfCtx)) return;
    const shelfMeta = getShelfMetaForCanonical(shelfByScene, params.canonicalModelKey, shelfCtx);
    const displayName = shelfMeta?.displayNameOverride?.trim() || params.displayName;
    const sourceLabel = resolveSourceLabel({
      canonicalModelKey: params.canonicalModelKey,
      providerKind: params.providerKind,
      vendor: params.vendor,
      catalogSourceLabel: params.catalogSourceLabel,
      shelfSourceLabelOverride: shelfMeta?.sourceLabelOverride,
    });
    out.push({
      canonicalModelKey: params.canonicalModelKey,
      modelKey: params.modelKey,
      displayName,
      description: params.description,
      role: params.role,
      requestKind: params.requestKind,
      mediaKind: params.mediaKind,
      mediaKindLabel: params.mediaKind ? PLATFORM_MEDIA_KIND_LABEL[params.mediaKind] : null,
      providerKind: params.providerKind,
      vendor: params.vendor,
      credentialBound: true,
      creditsPerUnit: params.creditsPerUnit,
      platformOffering: params.platformOffering,
      sourceLabel,
      sortOrder: shelfMeta?.sortOrder ?? 0,
    });
  }

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
      appendRow(out, {
        canonicalModelKey: catalog.canonicalKey,
        modelKey: route.modelKey,
        displayName: gatewayRouteDisplayName(
          { displayName: catalog.displayName, canonicalKey: catalog.canonicalKey },
          route.modelKey,
        ),
        description: def?.description ?? "",
        role: catalog.role ?? "LLM",
        requestKind: catalog.requestKind ?? "CHAT",
        mediaKind: catalog.mediaKind,
        providerKind: route.providerKind,
        vendor: route.vendor,
        catalogSourceLabel: catalog.sourceLabel,
        creditsPerUnit: null,
        platformOffering: false,
      });
    }
    const outSorted = sortRegistryRows(out);
    setCachedModelsForApp(input, outSorted);
    return outSorted;
  }

  const rows: RegistryModelRow[] = [];

  for (const { route, catalog } of routes) {
    // listActiveRoutes 已过滤 catalog.active + gatewayPublished
    if (!catalog.gatewayPublished) continue;
    if (!catalog.appTags.some((t) => t.toLowerCase() === appTag)) continue;
    if (input.role && catalog.role !== input.role) continue;

    const priceRow = priceByCanonical.get(catalog.canonicalKey);
    if (!priceRow) continue;

    const offering = offeringByCanonical.get(catalog.canonicalKey);
    if (offering && offering.status !== "ACTIVE") continue;

    const def = canonicalByKey(catalog.canonicalKey);
    const description = def?.description ?? "";

    appendRow(rows, {
      canonicalModelKey: catalog.canonicalKey,
      modelKey: route.modelKey,
      displayName: gatewayRouteDisplayName(
        { displayName: catalog.displayName, canonicalKey: catalog.canonicalKey },
        route.modelKey,
      ),
      description,
      role: catalog.role ?? offering?.role ?? "LLM",
      requestKind: catalog.requestKind ?? offering?.requestKind ?? "OTHER",
      mediaKind: catalog.mediaKind,
      providerKind: route.providerKind,
      vendor: route.vendor,
      catalogSourceLabel: catalog.sourceLabel,
      creditsPerUnit: offering?.publishedCreditsPerUnit ?? priceRow.creditsPerUnit,
      platformOffering: true,
    });
  }

  const result = sortRegistryRows(dedupeByModelKey(rows));
  setCachedModelsForApp(input, result);
  return result;
}

function sortRegistryRows(rows: RegistryModelRow[]): RegistryModelRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.displayName.localeCompare(b.displayName, "zh");
  });
}

/** Gateway 控制台全量目录（按 provider 分组）。 */
export async function buildGatewayModelCatalogFromDb(boundKinds: GatewayProviderKind[]) {
  await ensureGatewayCanonicalRegistrySynced();
  const routes = await listActiveRoutes();
  type GroupModel = {
    modelKey: string;
    displayName: string;
    requestKind: string;
    role: string;
    description: string | null;
    canonicalModelKey: string;
    credentialBound: boolean;
    capabilities: string[];
  };

  const byProvider = new Map<GatewayProviderKind, GroupModel[]>();

  for (const { route, catalog } of routes) {
    if (!shouldShowRouteInGatewayCatalog(route.modelKey)) continue;
    const taskTags = marketTaskTagsForModel({
      canonicalKey: catalog.canonicalKey,
      mediaKind: catalog.mediaKind,
      requestKind: catalog.requestKind ?? "OTHER",
      role: catalog.role ?? "LLM",
      modelKey: route.modelKey,
    });
    const list = byProvider.get(route.providerKind) ?? [];
    list.push({
      modelKey: route.modelKey,
      displayName: gatewayRouteDisplayName(
        { displayName: catalog.displayName, canonicalKey: catalog.canonicalKey },
        route.modelKey,
      ),
      requestKind: catalog.requestKind ?? "OTHER",
      role: catalog.role ?? "LLM",
      description: canonicalByKey(catalog.canonicalKey)?.description ?? null,
      canonicalModelKey: catalog.canonicalKey,
      credentialBound: isGatewayProviderBound(boundKinds, route.providerKind),
      capabilities: taskTagsToCapabilities(taskTags),
    });
    byProvider.set(route.providerKind, list);
  }

  // World Labs 目前常见为平台侧已登记能力，不一定先在 DB route 出现；
  // 这里补一份 Function Models 分组，确保 Gateway 模型管理里可见并可绑定凭证。
  if (!byProvider.has("WORLDLABS")) {
    byProvider.set(
      "WORLDLABS",
      WORLDLABS_MARBLE_MODELS.map((m) => ({
        modelKey: m.modelKey,
        displayName: m.displayName,
        requestKind: "OTHER",
        role: "OTHER",
        description: m.description,
        canonicalModelKey: m.modelKey,
        credentialBound: isGatewayProviderBound(boundKinds, "WORLDLABS"),
        capabilities: [],
      })),
    );
  }

  if (!byProvider.has("ELEVENLABS")) {
    byProvider.set(
      "ELEVENLABS",
      [
        ...ELEVENLABS_STS_MODELS.map((m) => ({
          modelKey: m.modelKey,
          displayName: m.label,
          requestKind: "TTS" as const,
          role: "LLM" as const,
          description: m.subtitle,
          canonicalModelKey: m.modelKey,
          credentialBound: isGatewayProviderBound(boundKinds, "ELEVENLABS"),
          capabilities: taskTagsToCapabilities(["text-to-speech"]),
        })),
        ...ELEVENLABS_SFX_MODELS.map((m) => ({
          modelKey: m.modelKey,
          displayName: m.label,
          requestKind: "OTHER" as const,
          role: "LLM" as const,
          description: m.subtitle,
          canonicalModelKey: m.modelKey,
          credentialBound: isGatewayProviderBound(boundKinds, "ELEVENLABS"),
          capabilities: [],
        })),
        ...ELEVENLABS_MUSIC_MODELS.map((m) => ({
          modelKey: m.modelKey,
          displayName: m.label,
          requestKind: "MUSIC" as const,
          role: "LLM" as const,
          description: m.subtitle,
          canonicalModelKey: m.modelKey,
          credentialBound: isGatewayProviderBound(boundKinds, "ELEVENLABS"),
          capabilities: taskTagsToCapabilities(["text-to-music"]),
        })),
      ],
    );
  }

  if (!byProvider.has("TOPAZ")) {
    byProvider.set(
      "TOPAZ",
      TOPAZ_VIDEO_MODELS.map((m) => ({
        modelKey: m.modelKey,
        displayName: m.displayName,
        requestKind: "VIDEO" as const,
        role: "VIDEO" as const,
        description: m.description,
        canonicalModelKey: m.modelKey,
        credentialBound: isGatewayProviderBound(boundKinds, "TOPAZ"),
        capabilities: ["video-upscale"],
      })),
    );
  }

  const PROVIDER_LABEL: Record<GatewayProviderKind, string> = {
    KIE: "KIE",
    DEEPSEEK: "DeepSeek",
    MOONSHOT: "Kimi / Moonshot",
    BAILIAN: "通义百炼",
    DASHSCOPE: "DashScope",
    HUNYUAN: "腾讯混元",
    VOLCENGINE: "火山方舟",
    MINIMAX: "MiniMax",
    WORLDLABS: "World Labs",
    ELEVENLABS: "ElevenLabs",
    TOPAZ: "Topaz Labs",
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
    models: dedupeByModelKey(
      models.map((m) => ({ ...m, canonicalModelKey: m.canonicalModelKey })),
    )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh"))
      .map(({ canonicalModelKey: _c, ...m }) => m),
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
      all: groups,
      text: filterTabs(isText),
      image: filterTabs(isImage),
      video: filterTabs(isVideo),
      function: filterTabs(isFunc),
    },
  };
}
