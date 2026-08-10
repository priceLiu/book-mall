import { prisma } from "@/lib/prisma";
import {
  ECOM_STORYBOARD_MODULE,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";

export type EcomLibraryAssetItem = {
  id: string;
  module: string;
  kind: string;
  title: string | null;
  prompt: string | null;
  ossUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type EcomLibraryStoryboardBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  panelCount: number;
  hasScript: boolean;
  hasVideo: boolean;
  thumbnailUrl: string | null;
  snapshot: StoryboardDeliverableSnapshot;
};

export type EcomLibrarySection = {
  moduleId: string;
  title: string;
  kind: "image" | "video" | "brand";
  assets: EcomLibraryAssetItem[];
  storyboardBundles: EcomLibraryStoryboardBundle[];
};

const IMAGE_MODULE_IDS = ["main-image", "detail-page", "model-shot"] as const;
const VIDEO_MODULE_IDS = [
  "storyboard-micro-drama",
  "video-motion",
  "video-outfit",
  "video-dance-swap",
  "video-camera",
  "video-digital-human",
  "video-mirror-selfie",
  "video-hit-product",
  "video-voiceover",
] as const;
const BRAND_MODULE_IDS = ["ip", "poster", "vi", "promo", "ad"] as const;

const MODULE_TITLES: Record<string, { title: string; kind: "image" | "video" | "brand" }> = {
  "main-image": { title: "电商主图", kind: "image" },
  "detail-page": { title: "电商详情页", kind: "image" },
  "model-shot": { title: "服装模特图", kind: "image" },
  "storyboard-micro-drama": { title: "微剧故事版", kind: "video" },
  "video-motion": { title: "视频动作", kind: "video" },
  "video-outfit": { title: "穿搭视频", kind: "video" },
  "video-dance-swap": { title: "卡点跳舞换装", kind: "video" },
  "video-camera": { title: "视频运镜", kind: "video" },
  "video-digital-human": { title: "数字人", kind: "video" },
  "video-mirror-selfie": { title: "户外对镜自拍", kind: "video" },
  "video-hit-product": { title: "爆款服装带货", kind: "video" },
  "video-voiceover": { title: "电商口播带货", kind: "video" },
  ip: { title: "IP 设计", kind: "brand" },
  poster: { title: "海报制作", kind: "brand" },
  vi: { title: "品牌 VI · 表情包", kind: "brand" },
  promo: { title: "宣传片制作", kind: "brand" },
  ad: { title: "广告短片", kind: "brand" },
};

function moduleIdFromAssetModule(module: string): string {
  if (module === ECOM_STORYBOARD_MODULE) return "storyboard-micro-drama";
  if (module.startsWith("video-")) return module;
  if (module.startsWith("brand-")) return module.replace(/^brand-/, "");
  return module;
}

function collectSnapshotsFromMeta(
  projectId: string,
  meta: Record<string, unknown> | null | undefined,
): StoryboardDeliverableSnapshot[] {
  const out: StoryboardDeliverableSnapshot[] = [];
  const latest = meta?.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as StoryboardDeliverableSnapshot[])
    : [];
  const seen = new Set<string>();
  for (const snap of [latest, ...history]) {
    if (!snap?.savedAt || !snap.sheet?.panels?.length) continue;
    if (seen.has(snap.savedAt)) continue;
    seen.add(snap.savedAt);
    out.push(snap);
  }
  return out;
}

function snapshotToBundle(
  projectId: string,
  snap: StoryboardDeliverableSnapshot,
  deliverableMarkdown?: string,
): EcomLibraryStoryboardBundle {
  const markdown =
    snap.deliverableMarkdown?.trim() ||
    deliverableMarkdown?.trim() ||
    "";
  const thumb =
    snap.sheetPngUrl?.trim() ||
    snap.references.find((r) => r.role === "product")?.ossUrl ||
    snap.sheet.panels.find((p) => p.imageUrl)?.imageUrl ||
    null;
  return {
    projectId,
    savedAt: snap.savedAt,
    title: snap.title || "微剧故事版",
    panelCount: snap.sheet.panels.length,
    hasScript: markdown.length > 80,
    hasVideo: Boolean(snap.videoUrl?.trim() || snap.panelVideos.length > 0),
    thumbnailUrl: thumb,
    snapshot: {
      ...snap,
      deliverableMarkdown: markdown || snap.deliverableMarkdown,
    },
  };
}

export async function listEcomLibrarySections(userId: string): Promise<EcomLibrarySection[]> {
  const [assets, storyboardRows] = await Promise.all([
    prisma.ecomAsset.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.ecomStoryboardProject.findMany({
      where: { userId, module: ECOM_STORYBOARD_MODULE },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, meta: true },
    }),
  ]);

  const assetsByModule = new Map<string, EcomLibraryAssetItem[]>();
  for (const row of assets) {
    const moduleId = moduleIdFromAssetModule(row.module);
    const list = assetsByModule.get(moduleId) ?? [];
    list.push({
      id: row.id,
      module: row.module,
      kind: row.kind,
      title: row.title,
      prompt: row.prompt,
      ossUrl: row.ossUrl,
      thumbnailUrl: row.thumbnailUrl,
      createdAt: row.createdAt.toISOString(),
    });
    assetsByModule.set(moduleId, list);
  }

  const bundles: EcomLibraryStoryboardBundle[] = [];
  for (const row of storyboardRows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    const markdown =
      typeof meta?.deliverableMarkdown === "string" ? meta.deliverableMarkdown : undefined;
    for (const snap of collectSnapshotsFromMeta(row.id, meta)) {
      bundles.push(snapshotToBundle(row.id, snap, markdown));
    }
  }
  bundles.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const orderedIds = [
    ...IMAGE_MODULE_IDS,
    ...VIDEO_MODULE_IDS,
    ...BRAND_MODULE_IDS,
  ] as string[];

  const sections: EcomLibrarySection[] = [];
  for (const moduleId of orderedIds) {
    const meta = MODULE_TITLES[moduleId];
    if (!meta) continue;
    const sectionAssets = assetsByModule.get(moduleId) ?? [];
    const sectionBundles =
      moduleId === "storyboard-micro-drama" ? bundles : [];
    if (sectionAssets.length === 0 && sectionBundles.length === 0) continue;
    sections.push({
      moduleId,
      title: meta.title,
      kind: meta.kind,
      assets: sectionAssets,
      storyboardBundles: sectionBundles,
    });
  }

  return sections;
}

export function findStoryboardSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): StoryboardDeliverableSnapshot | null {
  const latest = meta?.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as StoryboardDeliverableSnapshot[])
    : [];
  return history.find((h) => h.savedAt === savedAt) ?? null;
}

export type StoryboardReusePayload = {
  title: string;
  references: StoryboardDeliverableSnapshot["references"];
  sheet: StoryboardSheet;
  meta: {
    deliverableMarkdown?: string;
    deliverableSnapshot?: StoryboardDeliverableSnapshot;
  };
};

export function buildStoryboardReusePayload(
  snap: StoryboardDeliverableSnapshot,
  deliverableMarkdown?: string,
): StoryboardReusePayload {
  const markdown =
    snap.deliverableMarkdown?.trim() ||
    deliverableMarkdown?.trim() ||
    "";
  return {
    title: snap.title?.trim() || "微剧故事版",
    references: snap.references,
    sheet: snap.sheet,
    meta: {
      deliverableMarkdown: markdown || undefined,
      deliverableSnapshot: snap,
    },
  };
}
