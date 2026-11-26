/**
 * Gateway Models Market · 目录与展示层
 */
import { Prisma, type GatewayProviderKind, type ModelMediaKind } from "@prisma/client";

import marketPresentation from "@/config/gateway-market-presentation.json";
import { resolveSourceLabel } from "@/lib/gateway/model-source-label";
import { listGatewayCredentials } from "@/lib/gateway/credential-service";
import {
  gatewayRouteDisplayName,
  marketTaskTagsForModel,
  type MarketTaskTag,
} from "@/lib/gateway/gateway-model-capabilities";
import { listActiveRoutes } from "@/lib/gateway/model-registry";
import {
  gatewayCredentialSubstitutes,
  isGatewayProviderBound,
} from "@/lib/gateway/gateway-credential-match";
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

export function providerLabelFor(
  canonicalKey: string,
  vendor: string,
  opts?: {
    catalogSourceLabel?: string | null;
    providerKind?: import("@prisma/client").GatewayProviderKind;
  },
): string {
  return resolveSourceLabel({
    canonicalModelKey: canonicalKey,
    vendor,
    providerKind: opts?.providerKind ?? "KIE",
    catalogSourceLabel: opts?.catalogSourceLabel,
  });
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

const MARKET_TASKS: MarketTaskTag[] = [
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

const MEDIA_KIND_VALUES = new Set<ModelMediaKind>([
  "TEXT_TO_IMAGE",
  "IMAGE_TO_VIDEO",
  "VIDEO_TO_VIDEO",
  "TEXT_LLM",
]);

type MarketRouteRow = {
  canonicalKey: string;
  modelKey: string;
  vendor: string;
  providerKind: string;
  displayName: string;
  role: string | null;
  requestKind: string | null;
  mediaKind: string | null;
  sourceLabel: string | null;
};

function sqlAnd(parts: Prisma.Sql[]): Prisma.Sql {
  if (parts.length === 0) return Prisma.sql`TRUE`;
  return parts.slice(1).reduce((acc, part) => Prisma.sql`${acc} AND ${part}`, parts[0]!);
}

function likeContains(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function presentationKeysForTask(task: MarketTaskTag): { matched: string[]; any: string[] } {
  const matched: string[] = [];
  const any: string[] = [];
  for (const [key, meta] of Object.entries(PRESENTATION.models ?? {})) {
    const tags = (meta.taskTags ?? [])
      .map((raw) => raw.trim().toLowerCase().replace(/\s+/g, "-"))
      .map((s) => (s === "text-to-video" ? "image-to-video" : s));
    if (tags.length === 0) continue;
    any.push(key);
    if (tags.includes(task)) matched.push(key);
  }
  return { matched, any };
}

function marketTaskFilterSql(task: MarketTaskTag): Prisma.Sql {
  const key = Prisma.sql`lower(r."modelKey")`;
  const llm = Prisma.sql`(c."requestKind"::text = 'CHAT' OR c."role"::text = 'LLM')`;
  const notLlm = Prisma.sql`NOT ${llm}`;
  const notMotion = Prisma.sql`${key} NOT LIKE '%motion-control%'`;
  const notUpscale = Prisma.sql`${key} NOT LIKE '%topaz%' AND ${key} NOT LIKE '%upscale%' AND ${key} NOT LIKE '%minimax-h3-regeneration%'`;
  const i2iOnly = Prisma.sql`(
    ${key} = 'google/nano-banana-edit'
    OR ${key} LIKE 'qwen-image-edit%'
  )`;
  const bothImage = Prisma.sql`${key} IN ('wan2.6-image', 'wan2.7-image-pro', 'google/nano-banana', '4o-image', 'nano-banana-2')`;
  const i2vNamed = Prisma.sql`(
    ${key} IN ('wan3.0-video', 'wan3.0-video-prime', 'bytedance/seedance-2', 'bytedance/seedance-2-mini', 'veo3', 'veo3.1', 'veo3_fast')
    OR (${key} LIKE '%hailuo%' AND ${key} LIKE '%image-to-video%')
    OR ${key} LIKE '%minimax-h3-t2v%'
    OR ${key} LIKE '%minimax-h3-i2v%'
    OR ${key} LIKE '%minimax-h3-fl2v%'
    OR ${key} LIKE '%minimax-h3-r2v%'
    OR ${key} LIKE '%minimax-h3-s2v%'
    OR ${key} LIKE '%kling/v2-5-turbo-image-to-video%'
    OR ${key} LIKE '%kling/v2-5-turbo-text-to-video%'
  )`;
  const openForMedia = Prisma.sql`${notLlm} AND ${notMotion} AND ${notUpscale} AND NOT ${i2iOnly} AND NOT ${bothImage} AND NOT ${i2vNamed} AND ${key} NOT LIKE '%minimax-h3-context-ir%'`;

  let heuristic: Prisma.Sql;
  switch (task) {
    case "chat":
      heuristic = Prisma.sql`(
        (${llm} AND ${key} NOT LIKE '%suno%' AND ${key} NOT LIKE 'elevenlabs/%')
        OR (${notLlm} AND ${notMotion} AND ${notUpscale} AND NOT ${i2iOnly} AND NOT ${bothImage} AND NOT ${i2vNamed} AND ${key} LIKE '%minimax-h3-context-ir%')
      )`;
      break;
    case "text-to-music":
      heuristic = Prisma.sql`${llm} AND ${key} LIKE '%suno%'`;
      break;
    case "text-to-speech":
      heuristic = Prisma.sql`${llm} AND ${key} LIKE 'elevenlabs/%'`;
      break;
    case "motion-control":
      heuristic = Prisma.sql`${notLlm} AND ${key} LIKE '%motion-control%'`;
      break;
    case "video-upscale":
      heuristic = Prisma.sql`${notLlm} AND ${notMotion} AND (${key} LIKE '%topaz%' OR ${key} LIKE '%upscale%' OR ${key} LIKE '%minimax-h3-regeneration%')`;
      break;
    case "text-to-image":
      heuristic = Prisma.sql`${notLlm} AND ${notMotion} AND ${notUpscale} AND (
        ${bothImage}
        OR (${openForMedia} AND c."mediaKind"::text = 'TEXT_TO_IMAGE')
      )`;
      break;
    case "image-to-image":
      heuristic = Prisma.sql`${notLlm} AND ${notMotion} AND ${notUpscale} AND (
        ${i2iOnly}
        OR ${bothImage}
        OR (
          ${openForMedia}
          AND c."mediaKind"::text = 'TEXT_TO_IMAGE'
          AND (
            ${key} LIKE '%gpt-image%'
            OR ${key} LIKE '%flux%'
            OR ${key} LIKE '%seedream%'
            OR ${key} LIKE '%nano%'
            OR ${key} LIKE '%4o-image%'
            OR ${key} LIKE '%edit%'
          )
        )
      )`;
      break;
    case "video-to-video":
      heuristic = Prisma.sql`${notLlm} AND ${notMotion} AND ${notUpscale} AND NOT ${i2iOnly} AND NOT ${bothImage} AND (
        ${key} IN ('bytedance/seedance-2', 'bytedance/seedance-2-mini', 'veo3', 'veo3.1', 'veo3_fast')
        OR (
          NOT ${i2vNamed}
          AND ${key} NOT LIKE '%minimax-h3-context-ir%'
          AND (c."mediaKind"::text = 'VIDEO_TO_VIDEO' OR ${key} LIKE '%video-to-video%')
        )
      )`;
      break;
    case "image-to-video":
      heuristic = Prisma.sql`${notLlm} AND ${notMotion} AND ${notUpscale} AND NOT ${i2iOnly} AND NOT ${bothImage} AND ${key} NOT LIKE '%minimax-h3-context-ir%' AND (
        ${i2vNamed}
        OR c."mediaKind"::text = 'IMAGE_TO_VIDEO'
        OR ${key} LIKE '%i2v%'
        OR ${key} LIKE '%image-to-video%'
      )`;
      break;
    default:
      heuristic = Prisma.sql`FALSE`;
  }

  const preset = presentationKeysForTask(task);
  const presetHit =
    preset.matched.length > 0
      ? Prisma.sql`r."canonicalModelKey" IN (${Prisma.join(preset.matched)})`
      : Prisma.sql`FALSE`;
  const presetSkip =
    preset.any.length > 0
      ? Prisma.sql`r."canonicalModelKey" NOT IN (${Prisma.join(preset.any)})`
      : Prisma.sql`TRUE`;
  return Prisma.sql`(${presetHit} OR (${presetSkip} AND ${heuristic}))`;
}

function marketWhere(input: {
  q?: string;
  provider?: string;
  task?: MarketTaskTag;
  canonicalKey?: string;
  boundKinds: GatewayProviderKind[] | null;
}): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`r.active = true`,
    Prisma.sql`c.active = true`,
    Prisma.sql`c."gatewayPublished" = true`,
  ];
  if (input.boundKinds) {
    parts.push(
      Prisma.sql`r."providerKind"::text IN (${Prisma.join(input.boundKinds)})`,
    );
  }
  const canonicalKey = input.canonicalKey?.trim();
  if (canonicalKey) {
    parts.push(Prisma.sql`r."canonicalModelKey" = ${canonicalKey}`);
  }
  const provider = input.provider?.trim().toLowerCase();
  if (provider && provider !== "all") {
    parts.push(Prisma.sql`(
      lower(btrim(COALESCE(c."sourceLabel", ''))) = ${provider}
      OR lower(r.vendor) = ${provider}
      OR lower(r."providerKind"::text) = ${provider}
    )`);
  }
  const q = input.q?.trim();
  if (q) {
    const like = likeContains(q);
    parts.push(Prisma.sql`(
      r."canonicalModelKey" ILIKE ${like} ESCAPE '\\'
      OR r."modelKey" ILIKE ${like} ESCAPE '\\'
      OR c."displayName" ILIKE ${like} ESCAPE '\\'
      OR COALESCE(c."sourceLabel", '') ILIKE ${like} ESCAPE '\\'
      OR r.vendor ILIKE ${like} ESCAPE '\\'
      OR COALESCE(c.note, '') ILIKE ${like} ESCAPE '\\'
    )`);
  }
  if (input.task) parts.push(marketTaskFilterSql(input.task));
  return sqlAnd(parts);
}

const MARKET_ROUTE_SELECT = Prisma.sql`
  SELECT DISTINCT ON (r."canonicalModelKey")
    r."canonicalModelKey" AS "canonicalKey",
    r."modelKey" AS "modelKey",
    r.vendor AS vendor,
    r."providerKind"::text AS "providerKind",
    c."displayName" AS "displayName",
    c."role"::text AS role,
    c."requestKind"::text AS "requestKind",
    c."mediaKind"::text AS "mediaKind",
    c."sourceLabel" AS "sourceLabel"
  FROM "GatewayModelRoute" r
  INNER JOIN "ModelCatalog" c ON c."canonicalKey" = r."canonicalModelKey"
`;

function asMediaKind(value: string | null): ModelMediaKind | null {
  if (value && MEDIA_KIND_VALUES.has(value as ModelMediaKind)) {
    return value as ModelMediaKind;
  }
  return null;
}

function cardsFromRoutes(
  rows: MarketRouteRow[],
  priceMap: Map<string, number>,
  boundKinds: GatewayProviderKind[],
  billingPersona: "PLATFORM_CREDIT" | "BYOK" | null,
): MarketModelCard[] {
  return rows.map((row) => {
    const mediaKind = asMediaKind(row.mediaKind);
    const providerKind = row.providerKind as GatewayProviderKind;
    const role = row.role ?? "LLM";
    const requestKind = row.requestKind ?? "OTHER";
    const description = canonicalByKey(row.canonicalKey)?.description ?? "";
    const displayName = gatewayRouteDisplayName(
      { displayName: row.displayName, canonicalKey: row.canonicalKey },
      row.modelKey,
    );
    const taskTags = marketTaskTagsForModel({
      canonicalKey: row.canonicalKey,
      mediaKind,
      requestKind,
      role,
      modelKey: row.modelKey,
    }).map((tag) => tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    return {
      canonicalKey: row.canonicalKey,
      displayName,
      description,
      vendor: row.vendor,
      providerLabel: providerLabelFor(row.canonicalKey, row.vendor, {
        providerKind,
        catalogSourceLabel: row.sourceLabel,
      }),
      providerKind: row.providerKind,
      mediaKind,
      mediaKindLabel: mediaKind ? PLATFORM_MEDIA_KIND_LABEL[mediaKind] : null,
      requestKind,
      role,
      activeModelKey: row.modelKey,
      taskTags,
      coverUrl: coverUrlFor(row.canonicalKey),
      creditsPerUnit: resolveOfferingCredits(row.canonicalKey, priceMap, null),
      platformOffering: billingPersona !== "BYOK",
      runnable:
        billingPersona === "PLATFORM_CREDIT" ||
        isGatewayProviderBound(boundKinds, providerKind),
      readme: readmeFor(row.canonicalKey, description),
    };
  });
}

async function pricesForKeys(keys: string[]): Promise<Map<string, number>> {
  const lookup = [...new Set(keys)];
  if (lookup.includes("lib-nano-pro")) lookup.push("lib-nano-pro-2k");
  if (lookup.length === 0) return new Map();
  const prices = await prisma.modelCreditPrice.findMany({
    where: { active: true, canonicalModelKey: { in: lookup } },
    select: { canonicalModelKey: true, creditsPerUnit: true },
    orderBy: [{ canonicalModelKey: "asc" }, { tierRaw: "asc" }],
  });
  const map = new Map<string, number>();
  for (const price of prices) {
    if (!map.has(price.canonicalModelKey)) {
      map.set(price.canonicalModelKey, Number(price.creditsPerUnit));
    }
  }
  return map;
}

function emptyMarketList(pageSize: number) {
  return {
    models: [] as MarketModelCard[],
    featured: [] as MarketModelCard[],
    providers: [] as string[],
    tasks: MARKET_TASKS,
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  };
}

/**
 * 模型市场按页读取已发布路由（ModelCatalog.gatewayPublished）。
 * 不读取 AppModelOffering：自动发布会把未入选模型标成 DEPRECATED，ACTIVE 只剩极少数。
 * 列表、计数、厂商筛选项和推荐位都带 LIMIT 或固定 key，不把全表装进内存。
 */
export async function listMarketModelsForGatewayUser(input: {
  gatewayUserId: string;
  bookUserId: string | null;
  billingPersona: "PLATFORM_CREDIT" | "BYOK" | null;
  q?: string;
  provider?: string;
  task?: MarketTaskTag;
  canonicalKey?: string;
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
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const credentials = await listGatewayCredentials(input.gatewayUserId);
  const boundKinds = [
    ...new Set(
      credentials.filter((c) => c.active).flatMap((c) => gatewayCredentialSubstitutes(c.providerKind)),
    ),
  ];
  if (input.billingPersona === "BYOK" && boundKinds.length === 0) {
    return emptyMarketList(pageSize);
  }

  const where = marketWhere({
    q: input.q,
    provider: input.provider,
    task: input.task,
    canonicalKey: input.canonicalKey,
    boundKinds: input.billingPersona === "BYOK" ? boundKinds : null,
  });
  const featuredKeys = input.canonicalKey ? [] : (PRESENTATION.featuredCanonicalKeys ?? []);

  const countRows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT r."canonicalModelKey"
      FROM "GatewayModelRoute" r
      INNER JOIN "ModelCatalog" c ON c."canonicalKey" = r."canonicalModelKey"
      WHERE ${where}
    ) picked
  `;
  const total = countRows[0]?.n ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, input.page ?? 1), totalPages);
  if (total === 0) {
    return { ...emptyMarketList(pageSize), page, totalPages };
  }

  const offset = (page - 1) * pageSize;
  const [pageRows, featuredRows, providerRows] = await Promise.all([
    prisma.$queryRaw<MarketRouteRow[]>`
      SELECT * FROM (
        ${MARKET_ROUTE_SELECT}
        WHERE ${where}
        ORDER BY r."canonicalModelKey" ASC, r."sortOrder" ASC, r."modelKey" ASC
      ) picked
      ORDER BY picked."displayName" ASC, picked."canonicalKey" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    featuredKeys.length
      ? prisma.$queryRaw<MarketRouteRow[]>`
          SELECT * FROM (
            ${MARKET_ROUTE_SELECT}
            WHERE ${where}
              AND r."canonicalModelKey" IN (${Prisma.join(featuredKeys)})
            ORDER BY r."canonicalModelKey" ASC, r."sortOrder" ASC, r."modelKey" ASC
          ) picked
        `
      : Promise.resolve([] as MarketRouteRow[]),
    input.canonicalKey
      ? Promise.resolve([] as Array<{ label: string }>)
      : prisma.$queryRaw<Array<{ label: string }>>`
          SELECT DISTINCT btrim(c."sourceLabel") AS label
          FROM "GatewayModelRoute" r
          INNER JOIN "ModelCatalog" c ON c."canonicalKey" = r."canonicalModelKey"
          WHERE ${where}
            AND NULLIF(btrim(COALESCE(c."sourceLabel", '')), '') IS NOT NULL
          ORDER BY 1
        `,
  ]);

  const priceMap = await pricesForKeys([
    ...pageRows.map((row) => row.canonicalKey),
    ...featuredRows.map((row) => row.canonicalKey),
  ]);
  const models = cardsFromRoutes(pageRows, priceMap, boundKinds, input.billingPersona);
  const featuredByKey = new Map(
    cardsFromRoutes(featuredRows, priceMap, boundKinds, input.billingPersona).map((card) => [
      card.canonicalKey,
      card,
    ]),
  );
  const featured = featuredKeys
    .map((key) => featuredByKey.get(key))
    .filter((card): card is MarketModelCard => Boolean(card));

  return {
    models,
    featured,
    providers: providerRows.map((row) => row.label).filter(Boolean),
    tasks: MARKET_TASKS,
    total,
    page,
    pageSize,
    totalPages,
  };
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
    canonicalKey,
    page: 1,
    pageSize: 1,
  });
  return list.models[0] ?? null;
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

/** 首页模型走马灯：公开读取 Gateway 已发布 catalog（与注册表一致），无需登录。 */
export async function listPublicMarketShowcaseModels(
  limit?: number,
): Promise<MarketShowcaseItem[]> {
  const routes = await listActiveRoutes();

  const offerings = await prisma.appModelOffering.findMany({
    where: { status: "ACTIVE", activeModelKey: { not: null } },
    select: {
      canonicalModelKey: true,
      displayName: true,
      role: true,
      publishedCreditsPerUnit: true,
      activeVendor: true,
    },
  });
  const offeringByKey = new Map(offerings.map((o) => [o.canonicalModelKey, o]));

  const prices = await prisma.modelCreditPrice.findMany({
    where: { active: true },
    select: { canonicalModelKey: true, creditsPerUnit: true },
  });
  const priceMap = new Map(prices.map((p) => [p.canonicalModelKey, Number(p.creditsPerUnit)]));

  const seen = new Set<string>();
  const items: MarketShowcaseItem[] = [];

  for (const { route, catalog } of routes) {
    const canonicalKey = catalog.canonicalKey;
    if (seen.has(canonicalKey)) continue;
    seen.add(canonicalKey);

    const offering = offeringByKey.get(canonicalKey);
    const credits = offering
      ? resolveOfferingCredits(
          canonicalKey,
          priceMap,
          offering.publishedCreditsPerUnit,
        )
      : (priceMap.get(canonicalKey) ?? null);

    const def = canonicalByKey(canonicalKey);
    const rawDisplayName = offering
      ? offering.displayName
      : gatewayRouteDisplayName(
          { displayName: catalog.displayName, canonicalKey },
          route.modelKey,
        );

    items.push({
      canonicalKey,
      displayName: showcaseDisplayNameFor(rawDisplayName),
      description: def?.description ?? "",
      vendorLabel: showcaseVendorLabelFor(
        canonicalKey,
        offering?.activeVendor ?? route.vendor ?? "kie",
      ),
      role: offering?.role ?? catalog.role ?? "LLM",
      creditsPerUnit:
        offering?.publishedCreditsPerUnit != null
          ? Number(offering.publishedCreditsPerUnit)
          : credits,
      coverUrl: showcaseCoverUrlFor(canonicalKey),
    });
  }

  const featuredKeys = PRESENTATION.featuredCanonicalKeys ?? [];
  const featured = featuredKeys
    .map((k) => items.find((m) => m.canonicalKey === k))
    .filter((m): m is MarketShowcaseItem => Boolean(m));
  const rest = items
    .filter((m) => !featuredKeys.includes(m.canonicalKey))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-CN"));
  const ordered = [...featured, ...rest];
  if (limit != null && limit > 0) return ordered.slice(0, limit);
  return ordered;
}
