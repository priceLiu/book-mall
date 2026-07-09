/**
 * Gateway Models Market · 目录与展示层
 */
import type { ModelMediaKind } from "@prisma/client";

import marketPresentation from "@/config/gateway-market-presentation.json";
import { listGatewayCredentials } from "@/lib/gateway/credential-service";
import {
  gatewayRouteDisplayName,
  marketTaskTagsForModel,
  type MarketTaskTag,
} from "@/lib/gateway/gateway-model-capabilities";
import {
  dedupeByModelKey,
  listActiveRoutes,
  type RegistryModelRow,
} from "@/lib/gateway/model-registry";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { PLATFORM_MEDIA_KIND_LABEL, canonicalByKey } from "@/lib/platform-model/canonical-registry";
import { showcaseCoverUrlFor } from "@/lib/gateway/market-showcase-covers";
import { prisma } from "@/lib/prisma";

export type { MarketTaskTag } from "@/lib/gateway/gateway-model-capabilities";

export type MarketModelCard = {
  canonicalKey: string;
  displayName: string;
  description: string;
  vendor: string;
  providerLabel: string;
  providerKind: string;
  mediaKind: ModelMediaKind | null;
  mediaKindLabel: string | null;
  requestKind: string;
  role: string;
  activeModelKey: string;
  taskTags: string[];
  coverUrl: string;
  creditsPerUnit: number | null;
  platformOffering: boolean;
  runnable: boolean;
  readme: string;
};

type PresentationFile = {
  featuredCanonicalKeys?: string[];
  defaults?: { coverUrl?: string; heroUrl?: string };
  models?: Record<
    string,
    {
      coverUrl?: string;
      heroUrl?: string;
      providerLabel?: string;
      taskTags?: string[];
      readme?: string;
    }
  >;
};

const PRESENTATION = marketPresentation as PresentationFile;

const VENDOR_LABEL: Record<string, string> = {
  kie: "KIE",
  aliyun: "Alibaba",
  volcengine: "ByteDance",
  deepseek: "DeepSeek",
  tencent: "Tencent",
};

/** 不对用户展示的第三方路由/聚合平台（可展示厂商名） */
const HIDDEN_PLATFORM_VENDORS = new Set(["kie"]);

const HIDDEN_PLATFORM_LABELS = new Set([
  "kie",
  "bailian",
  "dashscope",
  "volcengine gateway",
]);

export { marketTaskTagsForModel } from "@/lib/gateway/gateway-model-capabilities";

function resolveOfferingCredits(
  canonicalModelKey: string,
  priceMap: Map<string, number>,
  publishedCreditsPerUnit: unknown,
): number | null {
  const direct = priceMap.get(canonicalModelKey);
  if (direct != null) return direct;
  if (canonicalModelKey === "lib-nano-pro") {
    const tier = priceMap.get("lib-nano-pro-2k");
    if (tier != null) return tier;
  }
  if (publishedCreditsPerUnit != null) {
    const n = Number(publishedCreditsPerUnit);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function presentationFor(canonicalKey: string) {
  return PRESENTATION.models?.[canonicalKey] ?? {};
}

export function coverUrlFor(canonicalKey: string): string {
  const p = presentationFor(canonicalKey);
  return p.coverUrl ?? PRESENTATION.defaults?.coverUrl ?? "";
}

export function heroUrlFor(canonicalKey: string): string {
  const p = presentationFor(canonicalKey);
  return p.heroUrl ?? p.coverUrl ?? PRESENTATION.defaults?.heroUrl ?? coverUrlFor(canonicalKey);
}

export function readmeFor(canonicalKey: string, fallback: string): string {
  return presentationFor(canonicalKey).readme ?? fallback;
}

export function providerLabelFor(canonicalKey: string, vendor: string): string {
  return (
    presentationFor(canonicalKey).providerLabel ??
    VENDOR_LABEL[vendor.toLowerCase()] ??
    vendor
  );
}

/** 首页走马灯：仅展示厂商名，隐藏 KIE 等第三方路由平台。 */
export function showcaseVendorLabelFor(
  canonicalKey: string,
  routeVendor: string,
): string | null {
  const fromPresentation = presentationFor(canonicalKey).providerLabel?.trim();
  if (fromPresentation && !HIDDEN_PLATFORM_LABELS.has(fromPresentation.toLowerCase())) {
    return fromPresentation;
  }

  const vendor = routeVendor.trim().toLowerCase();
  if (!HIDDEN_PLATFORM_VENDORS.has(vendor)) {
    const label = VENDOR_LABEL[vendor];
    if (label) return label;
  }

  const def = canonicalByKey(canonicalKey);
  const primary = def?.primaryVendor?.trim().toLowerCase();
  if (primary && !HIDDEN_PLATFORM_VENDORS.has(primary)) {
    const label = VENDOR_LABEL[primary];
    if (label) return label;
  }

  return null;
}

/** 首页走马灯：去掉名称末尾的 (KIE) 等第三方路由平台标注，保留模型名本身。 */
export function showcaseDisplayNameFor(displayName: string): string {
  const trimmed = displayName.trim();
  const stripped = trimmed
    .replace(/\s*[\(（]\s*KIE\s*[\)）]\s*$/i, "")
    .trim();
  return stripped || trimmed;
}

export async function listMarketModelsForGatewayUser(input: {
  gatewayUserId: string;
  bookUserId: string | null;
  billingPersona: "PLATFORM_CREDIT" | "BYOK" | null;
  q?: string;
  provider?: string;
  task?: MarketTaskTag;
  page?: number;
  pageSize?: number;
}): Promise<{
  models: MarketModelCard[];
  featured: MarketModelCard[];
  providers: string[];
  tasks: MarketTaskTag[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const credentials = await listGatewayCredentials(input.gatewayUserId);
  const boundKinds = [...new Set(credentials.map((c) => c.providerKind))];

  const rows: RegistryModelRow[] = [];

  if (input.billingPersona === "BYOK") {
    const routes = await listActiveRoutes();
    const seen = new Set<string>();
    for (const { route, catalog } of routes) {
      const dedupeKey = `${route.providerKind}:${route.modelKey}`;
      if (seen.has(dedupeKey)) continue;
      if (!isGatewayProviderBound(boundKinds, route.providerKind)) continue;
      seen.add(dedupeKey);
      const def = canonicalByKey(catalog.canonicalKey);
      rows.push({
        canonicalModelKey: catalog.canonicalKey,
        modelKey: route.modelKey,
        displayName: gatewayRouteDisplayName(
          { displayName: catalog.displayName, canonicalKey: catalog.canonicalKey },
          route.modelKey,
        ),
        description: def?.description ?? "",
        role: catalog.role ?? "LLM",
        requestKind: catalog.requestKind ?? "OTHER",
        mediaKind: catalog.mediaKind,
        mediaKindLabel: catalog.mediaKind
          ? PLATFORM_MEDIA_KIND_LABEL[catalog.mediaKind]
          : null,
        providerKind: route.providerKind,
        vendor: route.vendor,
        credentialBound: true,
        creditsPerUnit: null,
        platformOffering: false,
      });
    }
  } else {
    const offerings = await prisma.appModelOffering.findMany({
      where: { status: "ACTIVE", activeModelKey: { not: null } },
    });
    const prices = await prisma.modelCreditPrice.findMany({
      where: { active: true },
      select: { canonicalModelKey: true, creditsPerUnit: true },
    });
    const priceMap = new Map(prices.map((p) => [p.canonicalModelKey, p.creditsPerUnit]));

    const routes = await listActiveRoutes();
    const catalogByKey = new Map(routes.map((r) => [r.catalog.canonicalKey, r.catalog]));

    for (const o of offerings) {
      const catalog = catalogByKey.get(o.canonicalModelKey);
      const price = resolveOfferingCredits(
        o.canonicalModelKey,
        priceMap,
        o.publishedCreditsPerUnit,
      );
      if (!price || !o.activeModelKey) continue;
      const def = canonicalByKey(o.canonicalModelKey);
      rows.push({
        canonicalModelKey: o.canonicalModelKey,
        modelKey: o.activeModelKey,
        displayName: o.displayName,
        description: def?.description ?? "",
        role: o.role,
        requestKind: o.requestKind,
        mediaKind: catalog?.mediaKind ?? null,
        mediaKindLabel: catalog?.mediaKind
          ? PLATFORM_MEDIA_KIND_LABEL[catalog.mediaKind]
          : null,
        providerKind: o.activeProviderKind ?? "KIE",
        vendor: o.activeVendor ?? "kie",
        credentialBound: isGatewayProviderBound(
          boundKinds,
          o.activeProviderKind ?? "KIE",
        ),
        creditsPerUnit: o.publishedCreditsPerUnit ?? price,
        platformOffering: true,
      });
    }
  }

  const deduped = dedupeByModelKey(
    rows.map((r) => ({ ...r, modelKey: r.modelKey })),
  );
  const cards: MarketModelCard[] = deduped.map((r) => {
    const taskTags = marketTaskTagsForModel({
      canonicalKey: r.canonicalModelKey,
      mediaKind: r.mediaKind,
      requestKind: r.requestKind,
      role: r.role,
      modelKey: r.modelKey,
    }).map((t) => t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    return {
      canonicalKey: r.canonicalModelKey,
      displayName: r.displayName,
      description: r.description,
      vendor: r.vendor,
      providerLabel: providerLabelFor(r.canonicalModelKey, r.vendor),
      providerKind: r.providerKind,
      mediaKind: r.mediaKind,
      mediaKindLabel: r.mediaKindLabel,
      requestKind: r.requestKind,
      role: r.role,
      activeModelKey: r.modelKey,
      taskTags,
      coverUrl: coverUrlFor(r.canonicalModelKey),
      creditsPerUnit: r.creditsPerUnit,
      platformOffering: r.platformOffering,
      runnable: r.credentialBound || input.billingPersona === "PLATFORM_CREDIT",
      readme: readmeFor(r.canonicalModelKey, r.description),
    };
  });

  const q = input.q?.trim().toLowerCase();
  const provider = input.provider?.trim().toLowerCase();
  const task = input.task;

  const filtered = cards.filter((m) => {
    if (provider && provider !== "all") {
      const pl = m.providerLabel.toLowerCase();
      const vk = m.vendor.toLowerCase();
      const pk = m.providerKind.toLowerCase();
      if (!pl.includes(provider) && !vk.includes(provider) && !pk.includes(provider)) {
        return false;
      }
    }
    if (task) {
      const normalizedTags = marketTaskTagsForModel({
        canonicalKey: m.canonicalKey,
        mediaKind: m.mediaKind,
        requestKind: m.requestKind,
        role: m.role,
        modelKey: m.activeModelKey,
      });
      if (!normalizedTags.includes(task)) return false;
    }
    if (!q) return true;
    const hay = [
      m.canonicalKey,
      m.displayName,
      m.description,
      m.activeModelKey,
      m.providerLabel,
      ...m.taskTags,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const featuredKeys = PRESENTATION.featuredCanonicalKeys ?? [];
  const featured = featuredKeys
    .map((k) => filtered.find((m) => m.canonicalKey === k))
    .filter((m): m is MarketModelCard => Boolean(m));

  const providers = [
    ...new Set(filtered.map((m) => m.providerLabel)),
  ].sort((a, b) => a.localeCompare(b));

  const tasks: MarketTaskTag[] = [
    "text-to-image",
    "image-to-image",
    "image-to-video",
    "video-to-video",
    "motion-control",
    "video-upscale",
    "text-to-music",
    "text-to-speech",
    "chat",
  ];

  const total = filtered.length;
  const pageSize = input.pageSize != null ? Math.min(100, Math.max(1, input.pageSize)) : total || 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, input.page ?? 1), totalPages);
  const start = (page - 1) * pageSize;
  const models =
    input.pageSize != null ? filtered.slice(start, start + pageSize) : filtered;

  return { models, featured, providers, tasks, total, page, pageSize, totalPages };
}

export async function getMarketModelDetail(
  canonicalKey: string,
  gatewayUserId: string,
  billingPersona: "PLATFORM_CREDIT" | "BYOK" | null,
): Promise<MarketModelCard | null> {
  const list = await listMarketModelsForGatewayUser({
    gatewayUserId,
    bookUserId: null,
    billingPersona,
  });
  return list.models.find((m) => m.canonicalKey === canonicalKey) ?? null;
}

export function featuredHeroSlides(): Array<{ canonicalKey: string; heroUrl: string }> {
  return (PRESENTATION.featuredCanonicalKeys ?? []).map((k) => ({
    canonicalKey: k,
    heroUrl: heroUrlFor(k),
  }));
}

export type MarketShowcaseItem = {
  canonicalKey: string;
  displayName: string;
  description: string;
  vendorLabel: string | null;
  role: string;
  creditsPerUnit: number | null;
  coverUrl: string;
};

/** 首页模型走马灯：公开读取 ACTIVE 平台代付上架模型，无需 Gateway 登录态。 */
export async function listPublicMarketShowcaseModels(
  limit = 16,
): Promise<MarketShowcaseItem[]> {
  const offerings = await prisma.appModelOffering.findMany({
    where: { status: "ACTIVE", activeModelKey: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });
  const prices = await prisma.modelCreditPrice.findMany({
    where: { active: true },
    select: { canonicalModelKey: true, creditsPerUnit: true },
  });
  const priceMap = new Map(prices.map((p) => [p.canonicalModelKey, p.creditsPerUnit]));

  const items: MarketShowcaseItem[] = [];
  for (const o of offerings) {
    const price = resolveOfferingCredits(
      o.canonicalModelKey,
      priceMap,
      o.publishedCreditsPerUnit,
    );
    if (!price || !o.activeModelKey) continue;
    const def = canonicalByKey(o.canonicalModelKey);
    items.push({
      canonicalKey: o.canonicalModelKey,
      displayName: showcaseDisplayNameFor(o.displayName),
      description: def?.description ?? "",
      vendorLabel: showcaseVendorLabelFor(
        o.canonicalModelKey,
        o.activeVendor ?? "kie",
      ),
      role: o.role,
      creditsPerUnit: o.publishedCreditsPerUnit ?? price,
      coverUrl: showcaseCoverUrlFor(o.canonicalModelKey),
    });
  }

  const featuredKeys = PRESENTATION.featuredCanonicalKeys ?? [];
  const featured = featuredKeys
    .map((k) => items.find((m) => m.canonicalKey === k))
    .filter((m): m is MarketShowcaseItem => Boolean(m));
  const rest = items.filter((m) => !featuredKeys.includes(m.canonicalKey));
  return [...featured, ...rest].slice(0, limit);
}
