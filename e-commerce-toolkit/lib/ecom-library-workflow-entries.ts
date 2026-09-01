import type {
  EcomLibraryHandCraftBundle,
  EcomLibraryMediaDecomposeBundle,
  EcomLibraryModelShotBundle,
  EcomLibraryProductDesignBundle,
  EcomLibrarySection,
  EcomLibrarySeedVideoBundle,
  EcomLibraryStoryboardBundle,
} from "@/lib/ecom-library-api";

export type LibraryWorkflowEntry =
  | {
      kind: "product-design";
      key: string;
      projectName: string;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      bundle: EcomLibraryProductDesignBundle;
    }
  | {
      kind: "hand-craft";
      key: string;
      projectName: string;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      bundle: EcomLibraryHandCraftBundle;
    }
  | {
      kind: "storyboard";
      key: string;
      projectName: string;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      bundle: EcomLibraryStoryboardBundle;
    }
  | {
      kind: "storyboard-draft";
      key: string;
      projectName: string;
      projectId: string;
      thumbnailUrl: string | null;
      hasVideo: boolean;
      meta: string;
      sortKey: string;
    }
  | {
      kind: "seed-video";
      key: string;
      projectName: string;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      bundle: EcomLibrarySeedVideoBundle;
    }
  | {
      kind: "media-decompose";
      key: string;
      projectName: string;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      bundle: EcomLibraryMediaDecomposeBundle;
    }
  | {
      kind: "model-shot";
      key: string;
      projectName: string;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      bundle: EcomLibraryModelShotBundle;
    };

function bundleEntriesFromSection(section: EcomLibrarySection): LibraryWorkflowEntry[] {
  const entries: LibraryWorkflowEntry[] = [];

  for (const bundle of section.productDesignBundles) {
    entries.push({
      kind: "product-design",
      key: `pd:${bundle.projectId}:${bundle.savedAt}`,
      projectName: bundle.title,
      thumbnailUrl: bundle.thumbnailUrl,
      meta: `${bundle.module === "detail-page" ? "详情页" : "主图"} · ${bundle.slotCount} 个槽位 · ${bundle.hasGeneratedImages ? "含成图" : "仅文案/计划"}`,
      sortKey: bundle.savedAt,
      bundle,
    });
  }
  for (const bundle of section.handCraftBundles) {
    entries.push({
      kind: "hand-craft",
      key: `hc:${bundle.projectId}:${bundle.savedAt}`,
      projectName: bundle.title,
      thumbnailUrl: bundle.thumbnailUrl,
      meta: `${bundle.stepCount} 步 · ${bundle.imageCount} 张成图${bundle.hasSketch ? " · 含线稿" : ""}`,
      sortKey: bundle.savedAt,
      bundle,
    });
  }
  for (const bundle of section.storyboardBundles) {
    entries.push({
      kind: "storyboard",
      key: `sb:${bundle.projectId}:${bundle.savedAt}`,
      projectName: bundle.title,
      thumbnailUrl: bundle.thumbnailUrl,
      meta: `${bundle.panelCount} 镜 · ${bundle.hasVideo ? "含视频" : "仅分镜"} · 已保存工作流`,
      sortKey: bundle.savedAt,
      bundle,
    });
  }
  for (const bundle of section.seedVideoBundles) {
    entries.push({
      kind: "seed-video",
      key: `sv:${bundle.projectId}:${bundle.savedAt}`,
      projectName: bundle.title,
      thumbnailUrl: bundle.thumbnailUrl,
      meta: `${bundle.shotCount > 0 ? `${bundle.shotCount} 镜 · ` : ""}${bundle.productionMode === "direct" ? "方案①" : bundle.productionMode === "fine" ? "方案②" : "种草视频"} · ${bundle.hasVideo ? "含成片" : "脚本/Prompt"}`,
      sortKey: bundle.savedAt,
      bundle,
    });
  }
  for (const bundle of section.mediaDecomposeBundles) {
    entries.push({
      kind: "media-decompose",
      key: `md:${bundle.projectId}:${bundle.savedAt}`,
      projectName: bundle.title,
      thumbnailUrl: bundle.thumbnailUrl,
      meta: `${bundle.mediaKind === "video" ? "视频拆解" : bundle.mediaKind === "image" ? "图片拆解" : "拆图拆视频"} · ${bundle.hasReplica ? `${bundle.shotCount} 镜 · ` : ""}${bundle.hasVideo ? "含成片" : "拆解结果"}`,
      sortKey: bundle.savedAt,
      bundle,
    });
  }
  for (const bundle of section.modelShotBundles) {
    entries.push({
      kind: "model-shot",
      key: `ms:${bundle.projectId}:${bundle.savedAt}`,
      projectName: bundle.title,
      thumbnailUrl: bundle.thumbnailUrl,
      meta: `${bundle.poseCount} 个姿势 · ${bundle.imageCount > 0 ? `${bundle.imageCount} 张成图` : "仅方案"} · 已保存工作流`,
      sortKey: bundle.savedAt,
      bundle,
    });
  }

  return entries;
}

/** 工作流 Tab：已保存 bundle（进行中项目见「我的工作流 · 暂存」） */
export function buildWorkflowTabEntries(section: EcomLibrarySection): LibraryWorkflowEntry[] {
  const entries = bundleEntriesFromSection(section);
  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return entries;
}

export function countWorkflowTabEntries(sections: EcomLibrarySection[]): number {
  return sections.reduce((n, section) => n + buildWorkflowTabEntries(section).length, 0);
}
