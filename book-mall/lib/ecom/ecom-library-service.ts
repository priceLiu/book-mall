import { prisma } from "@/lib/prisma";
import {
  ECOM_STORYBOARD_MODULE,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import type { ProductDesignWorkflowSnapshot } from "@/lib/ecom/ecom-product-design-snapshot";
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

export type EcomLibrarySection = {
  moduleId: string;
  title: string;
  kind: "image" | "video" | "brand";
  domainLabel: string;
  assets: EcomLibraryAssetItem[];
  assetGroups: EcomLibraryAssetGroup[];
  storyboardBundles: EcomLibraryStoryboardBundle[];
  productDesignBundles: EcomLibraryProductDesignBundle[];
};

const IMAGE_MODULE_IDS = ["main-image", "detail-page", "hand-craft", "model-shot"] as const;
const VIDEO_MODULE_IDS = [
  "storyboard-micro-drama",
  "seed-video",
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
  await backfillEcomAssetProjectNamesForUser(userId);

  const [assets, storyboardRows, productDesignRows] = await Promise.all([
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
  ]);

  const projectNameLookup = buildProjectNameLookup(productDesignRows, storyboardRows);

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
    for (const snap of collectSnapshotsFromMeta(row.id, meta)) {
      bundles.push(snapshotToBundle(row.id, snap, markdown));
    }
  }
  bundles.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

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
    const sectionProductDesignBundles = productDesignBundlesByModule.get(moduleId) ?? [];
    if (
      sectionAssets.length === 0 &&
      sectionBundles.length === 0 &&
      sectionProductDesignBundles.length === 0
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
