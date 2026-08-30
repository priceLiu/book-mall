import { prisma } from "@/lib/prisma";
import {
  ECOM_STORYBOARD_MODULE,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import { mergeStoryboardDeliverableSnapshotMedia } from "@/lib/ecom/ecom-storyboard-snapshot";
import { reconcileStoryboardSheetPanelImages } from "@/lib/ecom/ecom-storyboard-sheet-reconcile";
import {
  buildStoryboardDeliverablePreviewFromWorkflow,
  collectStoryboardWorkflowSnapshotsFromMeta,
  type StoryboardWorkflowSnapshot,
} from "@/lib/ecom/ecom-storyboard-workflow-snapshot";
import type { MediaDecomposeDeliverableSnapshot } from "@/lib/ecom/ecom-media-decompose-snapshot";
import { ECOM_MEDIA_DECOMPOSE_MODULE } from "@/lib/ecom/ecom-media-decompose-types";
import type { SeedVideoDeliverableSnapshot } from "@/lib/ecom/ecom-seed-video-snapshot";
import { ECOM_SEED_VIDEO_MODULE } from "@/lib/ecom/ecom-seed-video-types";
import type { ProductDesignWorkflowSnapshot } from "@/lib/ecom/ecom-product-design-snapshot";
import type { HandCraftWorkflowSnapshot } from "@/lib/ecom/ecom-hand-craft-snapshot";
import { countHandCraftGeneratedImages } from "@/lib/ecom/ecom-hand-craft-snapshot";
import { HAND_CRAFT_STEPS } from "@/lib/ecom/ecom-hand-craft-steps";
import { ECOM_HAND_CRAFT_MODULE } from "@/lib/ecom/ecom-hand-craft-types";
import {
  ECOM_PROJECT_MODULE_DETAIL,
  ECOM_PROJECT_MODULE_MAIN,
  ECOM_PROJECT_MODULE_LEGACY,
} from "@/lib/ecom/ecom-product-design-types";
import { backfillEcomAssetProjectNamesForUser } from "@/lib/ecom/ecom-library-asset-project-backfill";
import {
  buildProjectNameLookup,
  resolveAssetProjectName,
} from "@/lib/ecom/ecom-library-project-names";

export type EcomLibraryAssetItem = {
  id: string;
  module: string;
  kind: string;
  title: string | null;
  prompt: string | null;
  ossUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  projectId?: string | null;
  projectName?: string | null;
};

export type EcomLibraryAssetGroup = {
  projectId: string | null;
  projectName: string;
  assets: EcomLibraryAssetItem[];
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

export type EcomLibraryProductDesignBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  module: string;
  platform: string;
  slotCount: number;
  hasGeneratedImages: boolean;
  hasCopy: boolean;
  thumbnailUrl: string | null;
  snapshot: ProductDesignWorkflowSnapshot;
};

export type EcomLibrarySeedVideoBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  shotCount: number;
  productionMode: "direct" | "fine" | null;
  hasScript: boolean;
  hasVideo: boolean;
  thumbnailUrl: string | null;
  snapshot: SeedVideoDeliverableSnapshot;
};

export type EcomLibraryHandCraftBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  stepCount: number;
  imageCount: number;
  hasGeneratedImages: boolean;
  hasSketch: boolean;
  thumbnailUrl: string | null;
  snapshot: HandCraftWorkflowSnapshot;
};

export type EcomLibraryMediaDecomposeBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  mediaKind: "image" | "video" | null;
  hasReplica: boolean;
  shotCount: number;
  hasVideo: boolean;
  thumbnailUrl: string | null;
  snapshot: MediaDecomposeDeliverableSnapshot;
};

export type EcomLibrarySection = {
  moduleId: string;
  title: string;
  kind: "image" | "video" | "brand";
  domainLabel: string;
  assets: EcomLibraryAssetItem[];
  assetGroups: EcomLibraryAssetGroup[];
  storyboardBundles: EcomLibraryStoryboardBundle[];
  productDesignBundles: EcomLibraryProductDesignBundle[];
  seedVideoBundles: EcomLibrarySeedVideoBundle[];
  handCraftBundles: EcomLibraryHandCraftBundle[];
  mediaDecomposeBundles: EcomLibraryMediaDecomposeBundle[];
};

const IMAGE_MODULE_IDS = ["main-image", "detail-page", "hand-craft", "model-shot"] as const;
const VIDEO_MODULE_IDS = [
  "storyboard-micro-drama",
  "seed-video",
  "media-decompose",
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
  "hand-craft": { title: "手伴创作", kind: "image" },
  "model-shot": { title: "服装模特图", kind: "image" },
  "storyboard-micro-drama": { title: "微剧故事版", kind: "video" },
  "seed-video": { title: "图片生种草视频", kind: "video" },
  "media-decompose": { title: "拆图拆视频", kind: "video" },
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

const DOMAIN_LABEL: Record<"image" | "video" | "brand", string> = {
  image: "电商",
  video: "视频",
  brand: "品牌",
};

function groupAssetsByProject(assets: EcomLibraryAssetItem[]): EcomLibraryAssetGroup[] {
  const groups = new Map<string, EcomLibraryAssetGroup>();
  for (const asset of assets) {
    const key = asset.projectName?.trim() || "未命名项目";
    const existing = groups.get(key);
    if (existing) {
      existing.assets.push(asset);
    } else {
      groups.set(key, {
        projectId: asset.projectId ?? null,
        projectName: key,
        assets: [asset],
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    const ta = a.assets[0]?.createdAt ?? "";
    const tb = b.assets[0]?.createdAt ?? "";
    return tb.localeCompare(ta);
  });
}

function moduleIdFromAssetModule(module: string): string {
  if (module === ECOM_STORYBOARD_MODULE) return "storyboard-micro-drama";
  if (module.startsWith("video-")) return module;
  if (module.startsWith("brand-")) return module.replace(/^brand-/, "");
  return module;
}

function collectProductDesignSnapshotsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): ProductDesignWorkflowSnapshot[] {
  const out: ProductDesignWorkflowSnapshot[] = [];
  const latest = meta?.workflowSnapshot as ProductDesignWorkflowSnapshot | undefined;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as ProductDesignWorkflowSnapshot[])
    : [];
  const seen = new Set<string>();
  for (const snap of [latest, ...history]) {
    if (!snap?.savedAt || !snap.design) continue;
    if (seen.has(snap.savedAt)) continue;
    seen.add(snap.savedAt);
    out.push(snap);
  }
  return out;
}

function productDesignModuleId(module: string): string | null {
  if (module === ECOM_PROJECT_MODULE_MAIN || module === ECOM_PROJECT_MODULE_LEGACY) {
    return ECOM_PROJECT_MODULE_MAIN;
  }
  if (module === ECOM_PROJECT_MODULE_DETAIL) return ECOM_PROJECT_MODULE_DETAIL;
  return null;
}

function snapshotToProductDesignBundle(
  projectId: string,
  snap: ProductDesignWorkflowSnapshot,
): EcomLibraryProductDesignBundle {
  const design = snap.design;
  const isDetail = snap.module === ECOM_PROJECT_MODULE_DETAIL;
  const slots = isDetail ? (design?.detailPages ?? []) : (design?.mainImages ?? []);
  const thumb =
    slots.find((s) => s.imageUrl?.trim())?.imageUrl?.trim() ||
    snap.references.find((r) => r.role === "product")?.ossUrl ||
    snap.references[0]?.ossUrl ||
    null;
  const hasCopy = isDetail
    ? (design?.detailPages.length ?? 0) > 0
    : (design?.mainImages.length ?? 0) > 0;
  return {
    projectId,
    savedAt: snap.savedAt,
    title: snap.title,
    module: snap.module,
    platform: snap.platform,
    slotCount: slots.length,
    hasGeneratedImages: slots.some((s) => Boolean(s.imageUrl?.trim())),
    hasCopy,
    thumbnailUrl: thumb,
    snapshot: snap,
  };
}

function collectSeedVideoSnapshotsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): SeedVideoDeliverableSnapshot[] {
  const out: SeedVideoDeliverableSnapshot[] = [];
  const latest = meta?.deliverableSnapshot as SeedVideoDeliverableSnapshot | undefined;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as SeedVideoDeliverableSnapshot[])
    : [];
  const seen = new Set<string>();
  for (const snap of [latest, ...history]) {
    if (!snap?.savedAt) continue;
    if (seen.has(snap.savedAt)) continue;
    seen.add(snap.savedAt);
    out.push(snap);
  }
  return out;
}

function collectMediaDecomposeSnapshotsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): MediaDecomposeDeliverableSnapshot[] {
  const out: MediaDecomposeDeliverableSnapshot[] = [];
  const latest = meta?.deliverableSnapshot as MediaDecomposeDeliverableSnapshot | undefined;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as MediaDecomposeDeliverableSnapshot[])
    : [];
  const seen = new Set<string>();
  for (const snap of [latest, ...history]) {
    if (!snap?.savedAt) continue;
    if (seen.has(snap.savedAt)) continue;
    seen.add(snap.savedAt);
    out.push(snap);
  }
  return out;
}

function collectHandCraftSnapshotsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): HandCraftWorkflowSnapshot[] {
  const out: HandCraftWorkflowSnapshot[] = [];
  const latest = meta?.workflowSnapshot as HandCraftWorkflowSnapshot | undefined;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as HandCraftWorkflowSnapshot[])
    : [];
  const seen = new Set<string>();
  for (const snap of [latest, ...history]) {
    if (!snap?.savedAt || !snap.plan) continue;
    if (seen.has(snap.savedAt)) continue;
    seen.add(snap.savedAt);
    out.push(snap);
  }
  return out;
}

function snapshotToHandCraftBundle(
  projectId: string,
  snap: HandCraftWorkflowSnapshot,
): EcomLibraryHandCraftBundle {
  const imageCount = countHandCraftGeneratedImages(snap.plan);
  const heroUrl = snap.meta?.workflow?.heroLockedUrl?.trim();
  let thumb = heroUrl || null;
  if (!thumb) {
    for (const step of HAND_CRAFT_STEPS) {
      const state = snap.plan.steps[step.id];
      if (!state) continue;
      if (step.kind === "compose") {
        const url = state.outputs.find((o) => o.imageUrl?.trim())?.imageUrl?.trim();
        if (url) {
          thumb = url;
          break;
        }
      } else {
        const url = state.slots.find((s) => s.imageUrl?.trim())?.imageUrl?.trim();
        if (url) {
          thumb = url;
          break;
        }
      }
    }
  }
  if (!thumb) {
    thumb = snap.references.find((r) => r.ossUrl?.trim())?.ossUrl?.trim() || null;
  }
  return {
    projectId,
    savedAt: snap.savedAt,
    title: snap.title,
    stepCount: HAND_CRAFT_STEPS.length,
    imageCount,
    hasGeneratedImages: imageCount > 0,
    hasSketch: snap.references.length > 0,
    thumbnailUrl: thumb,
    snapshot: snap,
  };
}

function isLikelyImageOssUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(u) || u.includes("image/");
}

function isLikelyVideoOssUrl(url: string): boolean {
  const u = url.trim();
  if (!/^https?:\/\//.test(u)) return false;
  if (isLikelyImageOssUrl(u)) return false;
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return true;
  if (/\/canvas\/user\//i.test(u)) return true;
  return false;
}

function pickSeedVideoSnapshotThumbnail(snap: SeedVideoDeliverableSnapshot): string | null {
  const refs = snap.references ?? [];
  const seedMaterial = refs.find((r) => r.role === "seed-material" && r.ossUrl?.trim())?.ossUrl?.trim();
  if (seedMaterial && !isLikelyVideoOssUrl(seedMaterial)) return seedMaterial;
  for (const ref of refs) {
    const u = ref.ossUrl?.trim();
    if (u && !isLikelyVideoOssUrl(u)) return u;
  }
  if (seedMaterial) return seedMaterial;
  return snap.finalVideoUrl?.trim() || refs[0]?.ossUrl?.trim() || null;
}

function snapshotToSeedVideoBundle(
  projectId: string,
  snap: SeedVideoDeliverableSnapshot,
): EcomLibrarySeedVideoBundle {
  const shotCount = snap.plan?.shots?.length ?? 0;
  const productionMode = snap.workflow?.productionMode ?? null;
  const hasScript = Boolean(
    snap.planningPrompt?.trim() ||
      snap.plan?.directVideo?.globalPrompt?.trim() ||
      (snap.plan?.scripts?.length ?? 0) >= 1 ||
      shotCount >= 1,
  );
  const thumb = pickSeedVideoSnapshotThumbnail(snap);
  return {
    projectId,
    savedAt: snap.savedAt,
    title: snap.title || "种草视频",
    shotCount,
    productionMode,
    hasScript,
    hasVideo: Boolean(snap.finalVideoUrl?.trim()),
    thumbnailUrl: thumb,
    snapshot: snap,
  };
}

function snapshotToMediaDecomposeBundle(
  projectId: string,
  snap: MediaDecomposeDeliverableSnapshot,
): EcomLibraryMediaDecomposeBundle {
  const shots = snap.replica?.shots ?? [];
  const shotCount = shots.length;
  const hasReplica = shotCount > 0;
  const hasShotVideo = shots.some((s) => Boolean(s.videoUrl?.trim()));
  const hasVideo = Boolean(snap.replica?.finalVideoUrl?.trim() || hasShotVideo);
  const mediaKind = snap.media?.kind ?? null;
  const mediaUrl = snap.media?.ossUrl?.trim() || null;
  const imageThumb =
    mediaKind === "image" && mediaUrl
      ? mediaUrl
      : mediaUrl && !isLikelyVideoOssUrl(mediaUrl)
        ? mediaUrl
        : null;
  const thumb =
    imageThumb ||
    snap.replica?.finalVideoUrl?.trim() ||
    shots.find((s) => s.videoUrl?.trim())?.videoUrl?.trim() ||
    mediaUrl ||
    null;
  return {
    projectId,
    savedAt: snap.savedAt,
    title: snap.title || "拆图拆视频",
    mediaKind,
    hasReplica,
    shotCount,
    hasVideo,
    thumbnailUrl: thumb,
    snapshot: snap,
  };
}

function snapshotToBundle(
  projectId: string,
  snap: StoryboardDeliverableSnapshot,
  deliverableMarkdown?: string,
  workflowSnapshot?: StoryboardWorkflowSnapshot,
): EcomLibraryStoryboardBundle {
  const markdown =
    snap.deliverableMarkdown?.trim() ||
    deliverableMarkdown?.trim() ||
    workflowSnapshot?.meta?.deliverableMarkdown?.trim() ||
    "";
  const thumb =
    snap.sheetPngUrl?.trim() ||
    workflowSnapshot?.sheetPngUrl?.trim() ||
    snap.references.find((r) => r.role === "product")?.ossUrl ||
    snap.sheet.panels.find((p) => p.imageUrl)?.imageUrl ||
    workflowSnapshot?.references.find((r) => r.role === "product")?.ossUrl ||
    null;
  const panelCount =
    snap.sheet.panels.length ||
    workflowSnapshot?.sheet?.panels.length ||
    0;
  const hasPanelVideo =
    snap.panelVideos.length > 0 ||
    snap.sheet.panels.some((p) => Boolean(p.videoUrl?.trim()));
  return {
    projectId,
    savedAt: snap.savedAt,
    title: workflowSnapshot?.title || snap.title || "微剧故事版",
    panelCount,
    hasScript:
      markdown.length > 80 ||
      Boolean(
        workflowSnapshot?.meta?.deliverable &&
          typeof workflowSnapshot.meta.deliverable === "object" &&
          Array.isArray(
            (workflowSnapshot.meta.deliverable as { sellpoints?: unknown[] }).sellpoints,
          ) &&
          ((workflowSnapshot.meta.deliverable as { sellpoints?: unknown[] }).sellpoints
            ?.length ?? 0) > 0,
      ),
    hasVideo: Boolean(snap.videoUrl?.trim() || hasPanelVideo),
    thumbnailUrl: thumb,
    snapshot: {
      ...snap,
      deliverableMarkdown: markdown || snap.deliverableMarkdown,
    },
  };
}

export { resolveStoryboardLibraryDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-library-deliverable";

/** 列表页轻量 enrich：每个项目只做一次资产回填，避免 N 次 getProject 拖垮接口 */
async function enrichStoryboardRowSnapshots(
  userId: string,
  projectId: string,
  snapshots: StoryboardDeliverableSnapshot[],
  meta: Record<string, unknown> | null,
): Promise<StoryboardDeliverableSnapshot[]> {
  if (snapshots.length === 0) return [];
  const deliverableLatest = meta?.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
  let merged = snapshots.map((snap) =>
    mergeStoryboardDeliverableSnapshotMedia(snap, [deliverableLatest]),
  );
  const baseSheet = merged[0]?.sheet;
  if (!baseSheet?.panels?.length) return merged;

  const reconciled = await reconcileStoryboardSheetPanelImages({
    userId,
    projectId,
    sheet: baseSheet,
    meta,
  });
  if (!reconciled.sheet) return merged;

  return merged.map((snap) =>
    mergeStoryboardDeliverableSnapshotMedia(snap, [
      { ...snap, sheet: reconciled.sheet! },
      deliverableLatest,
    ]),
  );
}

export async function listEcomLibrarySections(userId: string): Promise<EcomLibrarySection[]> {
  await backfillEcomAssetProjectNamesForUser(userId);

  const [assets, storyboardRows, productDesignRows, seedVideoRows, handCraftRows, mediaDecomposeRows] =
    await Promise.all([
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
    prisma.ecomProductDesignProject.findMany({
      where: {
        userId,
        module: {
          in: [ECOM_PROJECT_MODULE_MAIN, ECOM_PROJECT_MODULE_DETAIL, ECOM_PROJECT_MODULE_LEGACY],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, module: true, meta: true, brief: true, title: true },
    }),
    prisma.ecomSeedVideoProject.findMany({
      where: { userId, module: ECOM_SEED_VIDEO_MODULE },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, meta: true, title: true },
    }),
    prisma.ecomHandCraftProject.findMany({
      where: { userId, module: ECOM_HAND_CRAFT_MODULE },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, meta: true, title: true },
    }),
    prisma.ecomMediaDecomposeProject.findMany({
      where: { userId, module: ECOM_MEDIA_DECOMPOSE_MODULE },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, meta: true, title: true },
    }),
  ]);

  const projectNameLookup = buildProjectNameLookup(
    productDesignRows,
    storyboardRows,
    seedVideoRows,
    handCraftRows,
    mediaDecomposeRows,
  );

  const assetsByModule = new Map<string, EcomLibraryAssetItem[]>();
  for (const row of assets) {
    const moduleId = moduleIdFromAssetModule(row.module);
    const assetMeta = (row.meta as Record<string, unknown> | null) ?? null;
    const { projectId, projectName } = resolveAssetProjectName(assetMeta, projectNameLookup);
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
      projectId,
      projectName,
    });
    assetsByModule.set(moduleId, list);
  }

  const bundles: EcomLibraryStoryboardBundle[] = [];
  for (const row of storyboardRows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    const markdown =
      typeof meta?.deliverableMarkdown === "string" ? meta.deliverableMarkdown : undefined;
    const seen = new Set<string>();
    const rowItems: Array<{
      preview: StoryboardDeliverableSnapshot;
      workflowSnap?: StoryboardWorkflowSnapshot;
    }> = [];

    for (const workflowSnap of collectStoryboardWorkflowSnapshotsFromMeta(meta)) {
      seen.add(workflowSnap.savedAt);
      rowItems.push({
        preview: buildStoryboardDeliverablePreviewFromWorkflow(workflowSnap),
        workflowSnap,
      });
    }
    const latest = meta?.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
    const history = Array.isArray(meta?.deliverableSnapshotHistory)
      ? (meta!.deliverableSnapshotHistory as StoryboardDeliverableSnapshot[])
      : [];
    for (const snap of [latest, ...history]) {
      if (!snap?.savedAt || !snap.sheet?.panels?.length) continue;
      if (seen.has(snap.savedAt)) continue;
      seen.add(snap.savedAt);
      rowItems.push({ preview: snap });
    }

    const enriched = await enrichStoryboardRowSnapshots(
      userId,
      row.id,
      rowItems.map((item) => item.preview),
      meta,
    );
    for (let i = 0; i < rowItems.length; i += 1) {
      const item = rowItems[i]!;
      const snap = enriched[i] ?? item.preview;
      bundles.push(snapshotToBundle(row.id, snap, markdown, item.workflowSnap));
    }
  }
  bundles.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const seedVideoBundles: EcomLibrarySeedVideoBundle[] = [];
  for (const row of seedVideoRows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    for (const snap of collectSeedVideoSnapshotsFromMeta(meta)) {
      seedVideoBundles.push(snapshotToSeedVideoBundle(row.id, snap));
    }
  }
  seedVideoBundles.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const productDesignBundlesByModule = new Map<string, EcomLibraryProductDesignBundle[]>();
  for (const row of productDesignRows) {
    const moduleId = productDesignModuleId(row.module);
    if (!moduleId) continue;
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    for (const snap of collectProductDesignSnapshotsFromMeta(meta)) {
      const list = productDesignBundlesByModule.get(moduleId) ?? [];
      list.push(snapshotToProductDesignBundle(row.id, snap));
      productDesignBundlesByModule.set(moduleId, list);
    }
  }
  for (const list of productDesignBundlesByModule.values()) {
    list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  const handCraftBundles: EcomLibraryHandCraftBundle[] = [];
  for (const row of handCraftRows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    for (const snap of collectHandCraftSnapshotsFromMeta(meta)) {
      handCraftBundles.push(snapshotToHandCraftBundle(row.id, snap));
    }
  }
  handCraftBundles.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const mediaDecomposeBundles: EcomLibraryMediaDecomposeBundle[] = [];
  for (const row of mediaDecomposeRows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    for (const snap of collectMediaDecomposeSnapshotsFromMeta(meta)) {
      mediaDecomposeBundles.push(snapshotToMediaDecomposeBundle(row.id, snap));
    }
  }
  mediaDecomposeBundles.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

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
    const sectionAssetGroups = groupAssetsByProject(sectionAssets);
    const sectionBundles =
      moduleId === "storyboard-micro-drama" ? bundles : [];
    const sectionSeedVideoBundles = moduleId === "seed-video" ? seedVideoBundles : [];
    const sectionMediaDecomposeBundles =
      moduleId === "media-decompose" ? mediaDecomposeBundles : [];
    const sectionProductDesignBundles = productDesignBundlesByModule.get(moduleId) ?? [];
    const sectionHandCraftBundles = moduleId === "hand-craft" ? handCraftBundles : [];
    if (
      sectionAssets.length === 0 &&
      sectionBundles.length === 0 &&
      sectionSeedVideoBundles.length === 0 &&
      sectionMediaDecomposeBundles.length === 0 &&
      sectionProductDesignBundles.length === 0 &&
      sectionHandCraftBundles.length === 0
    ) {
      continue;
    }
    sections.push({
      moduleId,
      title: meta.title,
      kind: meta.kind,
      domainLabel: DOMAIN_LABEL[meta.kind],
      assets: sectionAssets,
      assetGroups: sectionAssetGroups,
      storyboardBundles: sectionBundles,
      productDesignBundles: sectionProductDesignBundles,
      seedVideoBundles: sectionSeedVideoBundles,
      handCraftBundles: sectionHandCraftBundles,
      mediaDecomposeBundles: sectionMediaDecomposeBundles,
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

export function findSeedVideoSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): SeedVideoDeliverableSnapshot | null {
  const latest = meta?.deliverableSnapshot as SeedVideoDeliverableSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as SeedVideoDeliverableSnapshot[])
    : [];
  return history.find((h) => h.savedAt === savedAt) ?? null;
}

export function findMediaDecomposeSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): MediaDecomposeDeliverableSnapshot | null {
  const latest = meta?.deliverableSnapshot as MediaDecomposeDeliverableSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.deliverableSnapshotHistory)
    ? (meta!.deliverableSnapshotHistory as MediaDecomposeDeliverableSnapshot[])
    : [];
  return history.find((h) => h.savedAt === savedAt) ?? null;
}

export function findProductDesignSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): ProductDesignWorkflowSnapshot | null {
  const latest = meta?.workflowSnapshot as ProductDesignWorkflowSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as ProductDesignWorkflowSnapshot[])
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
