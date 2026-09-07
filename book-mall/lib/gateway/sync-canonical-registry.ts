import type { PricingBillingKind } from "@prisma/client";

import {
  GATEWAY_CANONICAL_REGISTRY,
  PLATFORM_MEDIA_DEFAULTS,
} from "@/lib/platform-model/canonical-registry";
import { invalidateGatewayModelListCache } from "@/lib/gateway/model-list-cache";
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

async function upsertSingleCanonicalDef(
  def: (typeof GATEWAY_CANONICAL_REGISTRY)[number],
): Promise<void> {
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

function buildValidRouteKeys(): Set<string> {
  const validRouteKeys = new Set<string>();
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    for (const r of def.routes) {
      validRouteKeys.add(`${def.canonicalModelKey}\0${r.vendor}\0${r.modelKey}`);
    }
  }
  return validRouteKeys;
}

async function deactivateStaleGatewayRoutes(): Promise<void> {
  const validRouteKeys = buildValidRouteKeys();
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
}

async function syncMissingCanonicalKeys(missingKeys: string[]): Promise<void> {
  const missingSet = new Set(missingKeys);
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    if (!missingSet.has(def.canonicalModelKey)) continue;
    await upsertSingleCanonicalDef(def);
  }
  invalidateGatewayModelListCache();
}

/** 将 GATEWAY_CANONICAL_REGISTRY 全量 upsert 到 ModelCatalog + GatewayModelRoute。 */
export async function syncGatewayCanonicalRegistryToDb(): Promise<{
  canonicalCount: number;
  mediaDefaultCount: number;
}> {
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    await upsertSingleCanonicalDef(def);
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

  await deactivateStaleGatewayRoutes();

  // 落库完成后再失效：否则并发读会把同步前的行重新写回缓存
  invalidateGatewayModelListCache();

  return {
    canonicalCount: GATEWAY_CANONICAL_REGISTRY.length,
    mediaDefaultCount: Object.keys(PLATFORM_MEDIA_DEFAULTS).length,
  };
}

/** 图片编辑模型 · 画布 / 电商货架（skipDuplicates，不覆盖管理员下架） */
const IMAGE_EDIT_SHELF_CANONICALS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "qwen-image-3.0-pro",
  "wan2.7-image-pro",
  "wan2.6-image",
  "google-nano-banana-i2i",
] as const;

const IMAGE_EDIT_SHELF_SCOPES: Array<{ appTag: string; sceneKey: string }> = [
  { appTag: "canvas", sceneKey: "" },
  { appTag: "canvas", sceneKey: "pro2-image" },
  { appTag: "canvas", sceneKey: "sbv1-image" },
  { appTag: "story", sceneKey: "" },
  { appTag: "ecom", sceneKey: "" },
  { appTag: "ecom", sceneKey: "ecom-storyboard-image" },
  { appTag: "quick-replica", sceneKey: "" },
];

async function ensureImageEditModelShelves(): Promise<void> {
  if (imageEditShelvesEnsured) return;
  const existing = await prisma.appModelShelf.findMany({
    where: {
      appTag: "canvas",
      sceneKey: "",
      canonicalModelKey: { in: [...IMAGE_EDIT_SHELF_CANONICALS] },
    },
    select: { canonicalModelKey: true },
  });
  const have = new Set(existing.map((r) => r.canonicalModelKey));
  const missing = IMAGE_EDIT_SHELF_CANONICALS.filter((k) => !have.has(k));
  if (missing.length === 0) {
    imageEditShelvesEnsured = true;
    return;
  }

  await prisma.appModelShelf.createMany({
    data: missing.flatMap((canonicalModelKey) =>
      IMAGE_EDIT_SHELF_SCOPES.map((scope) => ({
        appTag: scope.appTag,
        sceneKey: scope.sceneKey,
        canonicalModelKey,
        status: "ACTIVE" as const,
        sortOrder: 0,
      })),
    ),
    skipDuplicates: true,
  });
  invalidateGatewayModelListCache();
  imageEditShelvesEnsured = true;
}

let syncInFlight: Promise<void> | null = null;
let nextSyncAllowedAt = 0;
let imageEditShelvesEnsured = false;
let wan30VideoShelvesEnsured = false;
let qwen38MaxShelvesEnsured = false;

const WAN30_VIDEO_SHELF_SCOPES: Array<{ appTag: string; sceneKey: string }> = [
  { appTag: "canvas", sceneKey: "" },
  { appTag: "canvas", sceneKey: "pro2-video" },
  { appTag: "canvas", sceneKey: "sbv1-video" },
  { appTag: "story", sceneKey: "" },
  { appTag: "ecom", sceneKey: "" },
  { appTag: "ecom", sceneKey: "ecom-storyboard-video" },
  { appTag: "quick-replica", sceneKey: "" },
  { appTag: "quick-replica", sceneKey: "qr-t2v" },
  { appTag: "tool", sceneKey: "" },
];

const WAN30_VIDEO_SHELF_MODEL_KEYS = ["wan3.0-video", "wan3.0-video-prime"] as const;

async function ensureWan30VideoShelves(): Promise<void> {
  if (wan30VideoShelvesEnsured) return;
  await prisma.appModelShelf.createMany({
    data: WAN30_VIDEO_SHELF_MODEL_KEYS.flatMap((canonicalModelKey) =>
      WAN30_VIDEO_SHELF_SCOPES.map((scope) => ({
        appTag: scope.appTag,
        sceneKey: scope.sceneKey,
        canonicalModelKey,
        status: "ACTIVE" as const,
        sortOrder: 0,
      })),
    ),
    skipDuplicates: true,
  });
  invalidateGatewayModelListCache();
  wan30VideoShelvesEnsured = true;
}

const QWEN38_MAX_SHELF_SCOPES: Array<{ appTag: string; sceneKey: string }> = [
  { appTag: "canvas", sceneKey: "" },
  { appTag: "canvas", sceneKey: "pro2-llm" },
  { appTag: "story", sceneKey: "" },
  { appTag: "ecom", sceneKey: "" },
  { appTag: "ecom", sceneKey: "ecom-storyboard-chat" },
  { appTag: "quick-replica", sceneKey: "" },
  { appTag: "tool", sceneKey: "" },
  { appTag: "prompt-optimizer", sceneKey: "" },
];

const QWEN38_MAX_CATALOG_NOTE =
  "千问 3.8 Max · 文本生成 / 深度思考 / 图片理解 / 长视频理解 · 1M 上下文";

async function ensureQwen38MaxShelves(): Promise<void> {
  if (qwen38MaxShelvesEnsured) return;
  await prisma.modelCatalog.updateMany({
    where: { canonicalKey: "qwen3.8-max" },
    data: {
      displayName: "Qwen3.8 Max",
      note: QWEN38_MAX_CATALOG_NOTE,
      appTags: [
        "canvas",
        "story",
        "tool",
        "ecom",
        "prompt-optimizer",
        "quick-replica",
      ],
      active: true,
      gatewayPublished: true,
    },
  });
  await prisma.appModelShelf.createMany({
    data: QWEN38_MAX_SHELF_SCOPES.map((scope) => ({
      appTag: scope.appTag,
      sceneKey: scope.sceneKey,
      canonicalModelKey: "qwen3.8-max",
      status: "ACTIVE" as const,
      sortOrder: 0,
    })),
    skipDuplicates: true,
  });
  invalidateGatewayModelListCache();
  qwen38MaxShelvesEnsured = true;
}

/** 全量 upsert 约 380 次串行往返，冷却期内不重复触发，避免打爆连接池 */
const SYNC_COOLDOWN_MS = 10 * 60 * 1000;

export type EnsureGatewayRegistrySyncOptions = {
  /** 为 true 时等待缺失 canonical 补齐（seed 脚本）；API 热路径默认 false */
  blocking?: boolean;
};

async function ensureShelfHelpers(): Promise<void> {
  await ensureImageEditModelShelves();
  await ensureWan30VideoShelves();
  await ensureQwen38MaxShelves();
}

function registryCanonicalKeys(): string[] {
  return [...new Set(GATEWAY_CANONICAL_REGISTRY.map((d) => d.canonicalModelKey))];
}

/**
 * 代码注册表有新增 canonical 时自动补齐 DB，避免 Gateway 模型管理页缺项。
 * 热路径默认非阻塞：只增量 upsert 缺失项，全量 stale 路由清理放后台。
 */
export async function ensureGatewayCanonicalRegistrySynced(
  options?: EnsureGatewayRegistrySyncOptions,
): Promise<void> {
  const blocking = options?.blocking === true;

  if (syncInFlight) {
    if (blocking) await syncInFlight;
    return;
  }
  if (Date.now() < nextSyncAllowedAt) {
    await ensureShelfHelpers();
    return;
  }

  const registryKeys = registryCanonicalKeys();
  const existing = await prisma.modelCatalog.findMany({
    where: {
      canonicalKey: { in: registryKeys },
      gatewayPublished: true,
      active: true,
    },
    select: { canonicalKey: true },
  });
  const existingSet = new Set(existing.map((row) => row.canonicalKey));
  const missingKeys = registryKeys.filter((key) => !existingSet.has(key));

  if (missingKeys.length === 0) {
    await ensureShelfHelpers();
    return;
  }

  nextSyncAllowedAt = Date.now() + SYNC_COOLDOWN_MS;
  syncInFlight = syncMissingCanonicalKeys(missingKeys)
    .then(async () => {
      await ensureShelfHelpers();
      void deactivateStaleGatewayRoutes().catch(() => {
        /* 后台清理失败不阻塞读路径 */
      });
    })
    .finally(() => {
      syncInFlight = null;
    });

  if (blocking) await syncInFlight;
}

/** API 热路径：触发增量同步但不 await */
export function scheduleGatewayCanonicalRegistrySync(): void {
  void ensureGatewayCanonicalRegistrySynced({ blocking: false });
}
