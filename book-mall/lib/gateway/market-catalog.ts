/**
 * Gateway Models Market · 目录与展示层
 */
import type { ModelMediaKind } from "@prisma/client";

import marketPresentation from "@/config/gateway-market-presentation.json";
import { listGatewayCredentials } from "@/lib/gateway/credential-service";
import {
  dedupeByCanonical,
  listActiveRoutes,
  type RegistryModelRow,
} from "@/lib/gateway/model-registry";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { PLATFORM_MEDIA_KIND_LABEL, canonicalByKey } from "@/lib/platform-model/canonical-registry";
import { prisma } from "@/lib/prisma";

export type MarketTaskTag =
  | "text-to-image"
  | "image-to-image"
  | "image-to-video"
  | "video-to-video"
  | "motion-control"
  | "video-upscale"
  | "chat";

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

export function marketTaskTagsForModel(input: {
  canonicalKey: string;
  mediaKind: ModelMediaKind | null;
  requestKind: string;
  role: string;
  modelKey: string;
}): MarketTaskTag[] {
  const preset = PRESENTATION.models?.[input.canonicalKey]?.taskTags;
  if (preset?.length) {
    return preset.map(normalizeTaskTag).filter(Boolean) as MarketTaskTag[];
  }
  const k = input.modelKey.toLowerCase();
  if (input.requestKind === "CHAT" || input.role === "LLM") return ["chat"];
  if (k.includes("motion-control")) return ["motion-control"];
  if (k.includes("topaz") || k.includes("upscale")) return ["video-upscale"];
  if (input.mediaKind === "VIDEO_TO_VIDEO" || k.includes("video-to-video")) {
    return ["video-to-video"];
  }
  if (input.mediaKind === "IMAGE_TO_VIDEO" || k.includes("i2v") || k.includes("image-to-video")) {
    return ["image-to-video"];
  }
  if (input.mediaKind === "TEXT_TO_IMAGE") {
    const tags: MarketTaskTag[] = ["text-to-image"];
    if (
      k.includes("gpt-image") ||
      k.includes("flux") ||
      k.includes("seedream") ||
      k.includes("nano")
    ) {
      tags.push("image-to-image");
    }
    return tags;
  }
  return [];
}

function normalizeTaskTag(raw: string): MarketTaskTag | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "-");
  const map: Record<string, MarketTaskTag> = {
    "text-to-image": "text-to-image",
    "image-to-image": "image-to-image",
    "image-to-video": "image-to-video",
    "video-to-video": "video-to-video",
    "motion-control": "motion-control",
    "video-upscale": "video-upscale",
    chat: "chat",
  };
  return map[s] ?? null;
}

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
      if (seen.has(catalog.canonicalKey)) continue;
      if (!isGatewayProviderBound(boundKinds, route.providerKind)) continue;
      seen.add(catalog.canonicalKey);
      const def = canonicalByKey(catalog.canonicalKey);
      rows.push({
        canonicalModelKey: catalog.canonicalKey,
        modelKey: route.modelKey,
        displayName: catalog.displayName,
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

  const deduped = dedupeByCanonical(rows);
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
