"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Copy, ExternalLink, Layers, RotateCcw, Sparkles } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  EcomImagePreviewHost,
  mapPreviewItemsFromEntries,
  useEcomImagePreview,
} from "@/components/media";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import { StoryboardDeliverableReviewDialog } from "@/components/storyboard/storyboard-deliverable-review-dialog";
import { StoryboardLibraryDeliverablePanel } from "@/components/storyboard/storyboard-library-deliverable-panel";
import { WorkflowShareLinkDialog } from "@/components/storyboard/workflow-share-link-dialog";
import { EcomWechatShareIcon } from "@/components/ui/ecom-wechat-share-icon";
import { EcomPublishDialog } from "@/components/publish/ecom-publish-dialog";
import {
  deleteAsset,
  isAssetPinnedInAiSpace,
  pinAssetToAiSpace,
  type EcomAsset,
} from "@/lib/ecom-api";
import { reuseProductDesignProject } from "@/lib/ecom-product-design-api";
import { reuseHandCraftProject } from "@/lib/ecom-hand-craft-api";
import { reuseMediaDecomposeProject } from "@/lib/ecom-media-decompose-api";
import { reuseModelShotProject } from "@/lib/ecom-model-shot-api";
import {
  listLibrarySections,
  type EcomLibraryAssetGroup,
  type EcomLibraryHandCraftBundle,
  type EcomLibraryMediaDecomposeBundle,
  type EcomLibraryModelShotBundle,
  type EcomLibraryProductDesignBundle,
  type EcomLibrarySection,
  type EcomLibrarySeedVideoBundle,
  type EcomLibraryStoryboardBundle,
} from "@/lib/ecom-library-api";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { isStoryboardImageUrl, isStoryboardVideoUrl } from "@/lib/storyboard-media";
import { reuseSeedVideoProject } from "@/lib/ecom-seed-video-api";
import {
  buildWorkflowTabEntries,
  countWorkflowTabEntries,
  type LibraryWorkflowEntry,
} from "@/lib/ecom-library-workflow-entries";
import { reuseStoryboardProject, fetchStoryboardLibraryDeliverable } from "@/lib/ecom-storyboard-api";
import type { EcomProjectModule } from "@/lib/product-design-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

const STORYBOARD_STORAGE_KEY = "ecom-storyboard-active-project";
const SEED_VIDEO_STORAGE_KEY = "ecom-seed-video-active-project";
const MEDIA_DECOMPOSE_STORAGE_KEY = "ecom-media-decompose-active-project";
const MODEL_SHOT_STORAGE_KEY = "ecom-model-shot-active-project";
const HAND_CRAFT_STORAGE_KEY = "ecom-hand-craft-active-project";

const DOMAIN_ORDER = ["电商", "视频", "品牌"] as const;

type LibraryTab = "all" | "ecom" | "video" | "brand" | "workflows";

const LIBRARY_TABS: Array<{ id: LibraryTab; label: string; hint?: string }> = [
  { id: "all", label: "全部" },
  { id: "ecom", label: "电商" },
  { id: "video", label: "视频" },
  { id: "brand", label: "品牌" },
  {
    id: "workflows",
    label: "工作流",
    hint: "保存后可一键复用",
  },
];

function domainForTab(tab: LibraryTab): string | null {
  if (tab === "ecom") return "电商";
  if (tab === "video") return "视频";
  if (tab === "brand") return "品牌";
  return null;
}

function LibraryTabBar({
  active,
  onChange,
  counts,
}: {
  active: LibraryTab;
  onChange: (tab: LibraryTab) => void;
  counts: Record<LibraryTab, number>;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-[#e8e8ed] bg-white/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap gap-2">
        {LIBRARY_TABS.map((tab) => {
          const selected = active === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-sm"
                  : "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {count > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    selected ? "bg-white/20 text-white" : "bg-[#f5f5f7] text-[#6e6e73]"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {active === "workflows" ? (
        <p className="mt-2 text-[11px] text-[#6e6e73]">
          已保存的工作流可「复制打开」换参考图再生成。进行中的项目请至
          <Link href="/workflows/drafts" className="mx-1 text-[#0071e3] hover:underline">
            我的工作流 · 暂存
          </Link>
          继续编辑。
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[#6e6e73]">
          先点项目名展开，再查看该项目的成图、视频或交付内容。
        </p>
      )}
    </div>
  );
}

function productDesignStorageKey(module: string): string {
  return `ecom-product-design-active-project:${module === "detail-page" ? "detail-page" : "main-image"}`;
}

function productDesignStudioPath(module: string): string {
  return module === "detail-page" ? "/ecom/detail-page-creation" : "/ecom/product-creation";
}

function LibraryBreadcrumb({
  domain,
  moduleTitle,
  projectName,
}: {
  domain: string;
  moduleTitle: string;
  projectName: string;
}) {
  return (
    <p className="mb-2 text-[11px] text-[#86868b]">
      <span className="text-[#6e6e73]">{domain}</span>
      <span className="mx-1.5 text-[#d2d2d7]">/</span>
      <span>{moduleTitle}</span>
      <span className="mx-1.5 text-[#d2d2d7]">/</span>
      <span className="font-medium text-[#1d1d1f]">{projectName}</span>
    </p>
  );
}

type LibraryProjectEntry =
  | {
      kind: "assets";
      key: string;
      projectName: string;
      projectId: string | null;
      thumbnailUrl: string | null;
      meta: string;
      sortKey: string;
      group: EcomLibraryAssetGroup;
    }
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
    };

function thumbnailFromAssetGroup(group: EcomLibraryAssetGroup): string | null {
  for (const asset of group.assets) {
    if (asset.kind !== "video") {
      const candidate = asset.thumbnailUrl ?? asset.ossUrl;
      if (candidate?.trim()) return candidate.trim();
    }
  }
  for (const asset of group.assets) {
    if (asset.thumbnailUrl?.trim()) return asset.thumbnailUrl.trim();
  }
  return group.assets[0]?.ossUrl?.trim() ?? null;
}

function libraryThumbIsVideo(url: string | null | undefined, hinted = false): boolean {
  const u = url?.trim() ?? "";
  if (u && isStoryboardImageUrl(u)) return false;
  if (u && isStoryboardVideoUrl(u)) return true;
  return hinted;
}

function buildSectionProjectEntries(section: EcomLibrarySection): LibraryProjectEntry[] {
  const entries: LibraryProjectEntry[] = [];
  const groups =
    section.assetGroups.length > 0
      ? section.assetGroups
      : section.assets.length > 0
        ? [{ projectId: null, projectName: "未命名项目", assets: section.assets }]
        : [];

  for (const group of groups) {
    const imageCount = group.assets.filter((a) => a.kind !== "video").length;
    const videoCount = group.assets.filter((a) => a.kind === "video").length;
    const parts: string[] = [];
    if (imageCount > 0) parts.push(`${imageCount} 张图`);
    if (videoCount > 0) parts.push(`${videoCount} 个视频`);
    entries.push({
      kind: "assets",
      key: `assets:${section.moduleId}:${group.projectId ?? group.projectName}`,
      projectName: group.projectName,
      projectId: group.projectId,
      thumbnailUrl: thumbnailFromAssetGroup(group),
      meta: parts.join(" · ") || `${group.assets.length} 条媒体`,
      sortKey: group.assets[0]?.createdAt ?? "",
      group,
    });
  }

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
      meta: `${bundle.panelCount} 镜 · ${bundle.hasVideo ? "含视频" : "仅分镜"}`,
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

  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return entries;
}

function LibraryProjectThumb({
  thumbnailUrl,
  alt,
  isVideo = false,
}: {
  thumbnailUrl: string | null;
  alt: string;
  isVideo?: boolean;
}) {
  const url = thumbnailUrl?.trim() ?? "";
  const treatAsVideo = libraryThumbIsVideo(url, isVideo);

  if (url) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
        {treatAsVideo ? (
          <EcomVideoThumb src={url} className="absolute inset-0 size-full" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={buildEcomOssThumbUrl(url)}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {treatAsVideo ? (
          <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
            视频
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
      <Layers className="h-5 w-5 text-[#86868b] opacity-50" />
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const { doubleConfirm, alert } = useDialogs();
  const [sections, setSections] = useState<EcomLibrarySection[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalBundles, setTotalBundles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [reviewSnapshot, setReviewSnapshot] =
    useState<StoryboardDeliverableSnapshot | null>(null);
  const [reuseBusy, setReuseBusy] = useState<string | null>(null);
  const [pinnedAssetIds, setPinnedAssetIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<LibraryTab>("all");
  const [shareStoryboard, setShareStoryboard] = useState<{
    projectId: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    setLoadError(null);
    listLibrarySections()
      .then((data) => {
        setSections(data.sections);
        setTotalAssets(data.totalAssets);
        setTotalBundles(data.totalBundles);
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<LibraryTab, number> = {
      all: totalAssets + totalBundles,
      ecom: 0,
      video: 0,
      brand: 0,
      workflows: 0,
    };
    counts.workflows = countWorkflowTabEntries(sections);
    for (const section of sections) {
      const mediaCount = section.assets.length;
      if (section.domainLabel === "电商") counts.ecom += mediaCount;
      if (section.domainLabel === "视频") counts.video += mediaCount;
      if (section.domainLabel === "品牌") counts.brand += mediaCount;
    }
    return counts;
  }, [sections, totalAssets, totalBundles]);

  const filteredSectionsByDomain = useMemo(() => {
    if (activeTab === "workflows") return [];
    const domainFilter = domainForTab(activeTab);
    const map = new Map<string, EcomLibrarySection[]>();
    for (const section of sections) {
      if (domainFilter && section.domainLabel !== domainFilter) continue;
      const list = map.get(section.domainLabel) ?? [];
      list.push(section);
      map.set(section.domainLabel, list);
    }
    return DOMAIN_ORDER.filter((d) => (map.get(d)?.length ?? 0) > 0)
      .map((d) => ({
        domain: d,
        sections: map
          .get(d)!
          .filter((section) => buildSectionProjectEntries(section).length > 0),
      }))
      .filter((x) => x.sections.length > 0);
  }, [sections, activeTab]);

  const libraryImagePreviewItems = useMemo(
    () =>
      mapPreviewItemsFromEntries(
        filteredSectionsByDomain.flatMap(({ sections: domainSections }) =>
          domainSections.flatMap((section) =>
            section.assets
              .filter((asset) => asset.kind === "image")
              .map((asset) => ({
                url: asset.ossUrl,
                title: asset.title ?? section.title,
                thumbUrl: asset.thumbnailUrl,
              })),
          ),
        ),
      ),
    [filteredSectionsByDomain],
  );
  const {
    preview: libraryImagePreview,
    openPreview: openLibraryImagePreview,
    closePreview: closeLibraryImagePreview,
  } = useEcomImagePreview(libraryImagePreviewItems);

  const workflowSectionsByDomain = useMemo(() => {
    const map = new Map<string, Array<{ section: EcomLibrarySection; entries: LibraryWorkflowEntry[] }>>();
    for (const domain of DOMAIN_ORDER) {
      for (const section of sections.filter((s) => s.domainLabel === domain)) {
        const entries = buildWorkflowTabEntries(section);
        if (entries.length === 0) continue;
        const list = map.get(domain) ?? [];
        list.push({ section, entries });
        map.set(domain, list);
      }
    }
    return DOMAIN_ORDER.filter((d) => (map.get(d)?.length ?? 0) > 0).map((domain) => ({
      domain,
      sections: map.get(domain)!,
    }));
  }, [sections]);

  async function onPinAsset(a: EcomAsset) {
    try {
      await pinAssetToAiSpace(a.id);
      setPinnedAssetIds((prev) => new Set(prev).add(a.id));
      await alert({
        title: "已展示到 AI 空间",
        message: "可在「个人中心 → 我的 AI 空间」查看与布置。空间只保存指向，不复制文件。",
      });
    } catch (e) {
      await alert({
        title: "展示失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function onDeleteAsset(a: EcomAsset) {
    const pinned = await isAssetPinnedInAiSpace(a.id);
    if (
      !(await doubleConfirm({
        title: "删除资产",
        message: `确定删除「${a.title ?? "未命名"}」？`,
        secondTitle: "不可恢复",
        secondMessage: pinned
          ? "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。该作品已展示在「我的 AI 空间」，个人空间展示将一并移除。"
          : "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteAsset(a.id);
      setPinnedAssetIds((prev) => {
        if (!prev.has(a.id)) return prev;
        const next = new Set(prev);
        next.delete(a.id);
        return next;
      });
      setSections((prev) =>
        prev
          .map((section) => {
            const assets = section.assets.filter((x) => x.id !== a.id);
            const assetGroups = section.assetGroups
              .map((g) => ({
                ...g,
                assets: g.assets.filter((x) => x.id !== a.id),
              }))
              .filter((g) => g.assets.length > 0);
            return { ...section, assets, assetGroups };
          })
          .filter(
            (s) =>
              s.assets.length > 0 ||
              s.storyboardBundles.length > 0 ||
              s.productDesignBundles.length > 0 ||
              s.seedVideoBundles.length > 0 ||
              s.handCraftBundles.length > 0 ||
              s.mediaDecomposeBundles.length > 0,
          ),
      );
      setTotalAssets((n) => Math.max(0, n - 1));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function onOpenSeedVideoProject(projectId: string) {
    setReuseBusy(`sv:${projectId}`);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SEED_VIDEO_STORAGE_KEY, projectId);
      }
      router.push("/ecom/seed-video");
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReuseSeedVideoBundle(bundle: EcomLibrarySeedVideoBundle) {
    const key = `sv:${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseSeedVideoProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SEED_VIDEO_STORAGE_KEY, project.id);
      }
      router.push("/ecom/seed-video");
    } catch (e) {
      await alert({
        title: "复用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReuseMediaDecomposeBundle(bundle: EcomLibraryMediaDecomposeBundle) {
    const key = `md:${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseMediaDecomposeProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(MEDIA_DECOMPOSE_STORAGE_KEY, project.id);
      }
      router.push("/ecom/media-decompose");
    } catch (e) {
      await alert({
        title: "复用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReuseModelShotBundle(bundle: EcomLibraryModelShotBundle) {
    const key = `ms:${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseModelShotProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(MODEL_SHOT_STORAGE_KEY, project.id);
      }
      router.push("/ecom/model-shot");
    } catch (e) {
      await alert({
        title: "复用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReviewStoryboardBundle(bundle: EcomLibraryStoryboardBundle) {
    try {
      const snapshot = await fetchStoryboardLibraryDeliverable(bundle.projectId, {
        savedAt: bundle.savedAt,
        title: bundle.title,
      });
      setReviewSnapshot(snapshot);
    } catch (e) {
      await alert({
        title: "交付包加载失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function onOpenStoryboardProject(projectId: string) {
    setReuseBusy(`sb-open:${projectId}`);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORYBOARD_STORAGE_KEY, projectId);
      }
      router.push("/ecom/storyboard/micro-drama");
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReuseStoryboardBundle(bundle: EcomLibraryStoryboardBundle) {
    const key = `sb-copy:${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseStoryboardProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORYBOARD_STORAGE_KEY, project.id);
      }
      router.push("/ecom/storyboard/micro-drama");
    } catch (e) {
      await alert({
        title: "复制打开失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReuseHandCraftBundle(bundle: EcomLibraryHandCraftBundle) {
    const key = `hc:${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseHandCraftProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(HAND_CRAFT_STORAGE_KEY, project.id);
      }
      router.push("/ecom/hand-craft");
    } catch (e) {
      await alert({
        title: "复用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  async function onReuseProductDesignBundle(bundle: EcomLibraryProductDesignBundle) {
    const key = `pd:${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseProductDesignProject(bundle.projectId, bundle.savedAt);
      const targetModule = (project.module === "detail-page" ? "detail-page" : "main-image") as EcomProjectModule;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(productDesignStorageKey(targetModule), project.id);
      }
      router.push(productDesignStudioPath(targetModule));
    } catch (e) {
      await alert({
        title: "复用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  const empty =
    !loading &&
    (activeTab === "workflows"
      ? workflowSectionsByDomain.length === 0
      : filteredSectionsByDomain.length === 0);

  return (
    <>
      <EcomWorkspaceLayout fullWidth>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-[#e8e8ed] bg-white px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-[#1d1d1f]">我的资产</h1>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  {loading
                    ? "加载中…"
                    : `共 ${totalAssets} 条媒体 · ${totalBundles} 套工作流/交付包`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EcomPublishDialog
                  content="从电商工具箱发起的示例发布：请在资产详情中选择具体文案后使用。"
                  triggerLabel="一键发布（示例）"
                />
                <Link
                  href="/workflows/drafts"
                  className="text-xs text-[#0071e3] hover:underline"
                >
                  我的工作流 →
                </Link>
              </div>
            </div>
            <Link
              href="/ecom/shoot-catalog"
              className="mt-4 flex items-center gap-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-3 transition hover:border-[#0071e3]/30 hover:bg-[#f0f6ff]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0071e3] shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[#1d1d1f]">
                  姿势 · 场景 · 道具库
                </span>
                <span className="mt-0.5 block text-xs text-[#6e6e73]">
                  管理服装模特图用的姿势、场景与道具；系统推荐只读，可自建「我的」条目
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[#86868b]" />
            </Link>
          </header>

          <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {!loading ? (
            <LibraryTabBar active={activeTab} onChange={setActiveTab} counts={tabCounts} />
          ) : null}
          {loading ? (
            <EcomMediaSkeletonGrid
              count={10}
              gridClass={ECOM_LIBRARY_MEDIA_GRID_CLASS}
            />
          ) : loadError ? (
            <p className="mt-6 text-sm text-red-600">{loadError}</p>
          ) : empty ? (
            <p className="mt-6 text-sm text-[#6e6e73]">
              {activeTab === "workflows"
                ? "暂无已保存工作流。请在拆图拆视频 / 手伴创作 / 主图创作 / 种草视频 / 微剧故事版等工作台点「保存」后再来此处一键复用。"
                : "该分类暂无资产，去各模块生成后会出现在对应 Tab。"}
            </p>
          ) : activeTab === "workflows" ? (
            <div className="mt-6 space-y-10">
              {workflowSectionsByDomain.map(({ domain, sections: domainSections }) => (
                <div key={domain} className="space-y-8">
                  <h2 className="text-base font-semibold text-[#1d1d1f]">{domain}</h2>
                  {domainSections.map(({ section, entries }) => (
                    <LibrarySectionBlock
                      key={section.moduleId}
                      section={section}
                      projectEntries={entries}
                      reuseBusy={reuseBusy}
                      onDeleteAsset={onDeleteAsset}
                      onPinAsset={onPinAsset}
                      pinnedAssetIds={pinnedAssetIds}
                      onPreviewImage={(src, title) =>
                        openLibraryImagePreview(src, title ?? "资产")
                      }
                      onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                      onReviewStoryboardBundle={onReviewStoryboardBundle}
                      onReuseStoryboardBundle={onReuseStoryboardBundle}
                      onOpenStoryboardProject={onOpenStoryboardProject}
                      onShareStoryboardProject={(projectId, title) =>
                        setShareStoryboard({ projectId, title })
                      }
                      onReuseProductDesignBundle={onReuseProductDesignBundle}
                      onReuseSeedVideoBundle={onReuseSeedVideoBundle}
                      onReuseHandCraftBundle={onReuseHandCraftBundle}
                      onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
                      onReuseModelShotBundle={onReuseModelShotBundle}
                      onOpenSeedVideoProject={onOpenSeedVideoProject}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-10">
              {filteredSectionsByDomain.map(({ domain, sections: domainSections }) => (
                <div key={domain} className="space-y-8">
                  <h2 className="text-base font-semibold text-[#1d1d1f]">{domain}</h2>
                  {domainSections.map((section) => {
                    const projectEntries = buildSectionProjectEntries(section);
                    if (projectEntries.length === 0) return null;
                    return (
                      <LibrarySectionBlock
                        key={section.moduleId}
                        section={section}
                        projectEntries={projectEntries}
                        reuseBusy={reuseBusy}
                        onDeleteAsset={onDeleteAsset}
                        onPinAsset={onPinAsset}
                        pinnedAssetIds={pinnedAssetIds}
                        onPreviewImage={(src, title) =>
                    openLibraryImagePreview(src, title ?? "资产")
                  }
                        onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                        onReviewStoryboardBundle={onReviewStoryboardBundle}
                        onReuseStoryboardBundle={onReuseStoryboardBundle}
                        onOpenStoryboardProject={onOpenStoryboardProject}
                        onShareStoryboardProject={(projectId, title) =>
                          setShareStoryboard({ projectId, title })
                        }
                        onReuseProductDesignBundle={onReuseProductDesignBundle}
                        onReuseSeedVideoBundle={onReuseSeedVideoBundle}
                        onReuseHandCraftBundle={onReuseHandCraftBundle}
                        onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
                      onReuseModelShotBundle={onReuseModelShotBundle}
                        onOpenSeedVideoProject={onOpenSeedVideoProject}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </EcomWorkspaceLayout>

      <EcomImagePreviewHost
        preview={libraryImagePreview}
        galleryItems={libraryImagePreviewItems}
        onClose={closeLibraryImagePreview}
      />

      {previewVideo ? (
        <EcomVideoPreviewDialog
          src={previewVideo.src}
          title={previewVideo.title}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
        />
      ) : null}

      {reviewSnapshot ? (
        <StoryboardDeliverableReviewDialog
          open
          snapshot={reviewSnapshot}
          onOpenChange={(open) => {
            if (!open) setReviewSnapshot(null);
          }}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
        />
      ) : null}

      {shareStoryboard ? (
        <WorkflowShareLinkDialog
          projectId={shareStoryboard.projectId}
          projectTitle={shareStoryboard.title}
          open
          onClose={() => setShareStoryboard(null)}
        />
      ) : null}
    </>
  );
}

function LibrarySectionBlock({
  section,
  projectEntries,
  reuseBusy,
  onDeleteAsset,
  onPinAsset,
  pinnedAssetIds,
  onPreviewImage,
  onPreviewVideo,
  onReviewStoryboardBundle,
  onReuseStoryboardBundle,
  onOpenStoryboardProject,
  onShareStoryboardProject,
  onReuseProductDesignBundle,
  onReuseSeedVideoBundle,
  onReuseHandCraftBundle,
  onReuseMediaDecomposeBundle,
  onReuseModelShotBundle,
  onOpenSeedVideoProject,
}: {
  section: EcomLibrarySection;
  projectEntries: Array<LibraryProjectEntry | LibraryWorkflowEntry>;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onOpenStoryboardProject: (projectId: string) => void;
  onShareStoryboardProject: (projectId: string, title: string) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
  onReuseHandCraftBundle: (bundle: EcomLibraryHandCraftBundle) => void;
  onReuseMediaDecomposeBundle: (bundle: EcomLibraryMediaDecomposeBundle) => void;
  onReuseModelShotBundle: (bundle: EcomLibraryModelShotBundle) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (projectEntries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[#1d1d1f]">{section.title}</h3>
      <ul className="space-y-2">
        {projectEntries.map((entry) => (
          <LibraryProjectListItem
            key={entry.key}
            entry={entry}
            section={section}
            expanded={expandedKey === entry.key}
            onToggle={() =>
              setExpandedKey((prev) => (prev === entry.key ? null : entry.key))
            }
            reuseBusy={reuseBusy}
            onDeleteAsset={onDeleteAsset}
            onPinAsset={onPinAsset}
            pinnedAssetIds={pinnedAssetIds}
            onPreviewImage={onPreviewImage}
            onPreviewVideo={onPreviewVideo}
            onReviewStoryboardBundle={onReviewStoryboardBundle}
            onReuseStoryboardBundle={onReuseStoryboardBundle}
            onOpenStoryboardProject={onOpenStoryboardProject}
            onShareStoryboardProject={onShareStoryboardProject}
            onReuseProductDesignBundle={onReuseProductDesignBundle}
            onReuseSeedVideoBundle={onReuseSeedVideoBundle}
            onReuseHandCraftBundle={onReuseHandCraftBundle}
            onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
            onReuseModelShotBundle={onReuseModelShotBundle}
            onOpenSeedVideoProject={onOpenSeedVideoProject}
          />
        ))}
      </ul>
    </section>
  );
}

function LibraryProjectListItem({
  entry,
  section,
  expanded,
  onToggle,
  reuseBusy,
  onDeleteAsset,
  onPinAsset,
  pinnedAssetIds,
  onPreviewImage,
  onPreviewVideo,
  onReviewStoryboardBundle,
  onReuseStoryboardBundle,
  onOpenStoryboardProject,
  onShareStoryboardProject,
  onReuseProductDesignBundle,
  onReuseSeedVideoBundle,
  onReuseHandCraftBundle,
  onReuseMediaDecomposeBundle,
  onReuseModelShotBundle,
  onOpenSeedVideoProject,
}: {
  entry: LibraryProjectEntry | LibraryWorkflowEntry;
  section: EcomLibrarySection;
  expanded: boolean;
  onToggle: () => void;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onOpenStoryboardProject: (projectId: string) => void;
  onShareStoryboardProject: (projectId: string, title: string) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
  onReuseHandCraftBundle: (bundle: EcomLibraryHandCraftBundle) => void;
  onReuseMediaDecomposeBundle: (bundle: EcomLibraryMediaDecomposeBundle) => void;
  onReuseModelShotBundle: (bundle: EcomLibraryModelShotBundle) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  const isVideoThumb = libraryThumbIsVideo(
    entry.thumbnailUrl,
    entry.kind === "seed-video"
      ? entry.bundle.hasVideo
      : entry.kind === "storyboard"
        ? entry.bundle.hasVideo
        : entry.kind === "storyboard-draft"
          ? entry.hasVideo
        : entry.kind === "media-decompose"
          ? entry.bundle.hasVideo
          : entry.kind === "assets"
            ? entry.group.assets.length > 0 &&
              entry.group.assets.every((a) => a.kind === "video")
            : false,
  );

  const quickOpenStoryboard =
    entry.kind === "storyboard-draft"
      ? {
          projectId: entry.projectId,
          busy: reuseBusy === `sb-open:${entry.projectId}`,
        }
      : entry.kind === "storyboard"
        ? {
            projectId: entry.bundle.projectId,
            busy: reuseBusy === `sb-open:${entry.bundle.projectId}`,
          }
        : null;

  return (
    <li className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#f5f5f7]"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <LibraryProjectThumb
          thumbnailUrl={entry.thumbnailUrl}
          alt={entry.projectName}
          isVideo={isVideoThumb}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#1d1d1f]">{entry.projectName}</p>
          <p className="truncate text-[11px] text-[#6e6e73]">{entry.meta}</p>
        </div>
        {quickOpenStoryboard ? (
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[#e8e8ed] bg-white px-2.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            disabled={quickOpenStoryboard.busy}
            onClick={(e) => {
              e.stopPropagation();
              void onOpenStoryboardProject(quickOpenStoryboard.projectId);
            }}
          >
            <ExternalLink className="h-3 w-3" />
            {quickOpenStoryboard.busy ? "打开中…" : "打开"}
          </button>
        ) : null}
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#86868b]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[#86868b]" />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-[#e8e8ed] bg-[#fafafa] px-3 py-3">
          <LibraryBreadcrumb
            domain={section.domainLabel}
            moduleTitle={section.title}
            projectName={entry.projectName}
          />
          <LibraryProjectExpandedContent
            entry={entry}
            section={section}
            reuseBusy={reuseBusy}
            onDeleteAsset={onDeleteAsset}
            onPinAsset={onPinAsset}
            pinnedAssetIds={pinnedAssetIds}
            onPreviewImage={onPreviewImage}
            onPreviewVideo={onPreviewVideo}
            onReviewStoryboardBundle={onReviewStoryboardBundle}
            onReuseStoryboardBundle={onReuseStoryboardBundle}
            onOpenStoryboardProject={onOpenStoryboardProject}
            onShareStoryboardProject={onShareStoryboardProject}
            onReuseProductDesignBundle={onReuseProductDesignBundle}
            onReuseSeedVideoBundle={onReuseSeedVideoBundle}
            onReuseHandCraftBundle={onReuseHandCraftBundle}
            onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
            onReuseModelShotBundle={onReuseModelShotBundle}
            onOpenSeedVideoProject={onOpenSeedVideoProject}
          />
        </div>
      ) : null}
    </li>
  );
}

function LibraryProjectExpandedContent({
  entry,
  section,
  reuseBusy,
  onDeleteAsset,
  onPinAsset,
  pinnedAssetIds,
  onPreviewImage,
  onPreviewVideo,
  onReviewStoryboardBundle,
  onReuseStoryboardBundle,
  onOpenStoryboardProject,
  onShareStoryboardProject,
  onReuseProductDesignBundle,
  onReuseSeedVideoBundle,
  onReuseHandCraftBundle,
  onReuseMediaDecomposeBundle,
  onReuseModelShotBundle,
  onOpenSeedVideoProject,
}: {
  entry: LibraryProjectEntry | LibraryWorkflowEntry;
  section: EcomLibrarySection;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onOpenStoryboardProject: (projectId: string) => void;
  onShareStoryboardProject: (projectId: string, title: string) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
  onReuseHandCraftBundle: (bundle: EcomLibraryHandCraftBundle) => void;
  onReuseMediaDecomposeBundle: (bundle: EcomLibraryMediaDecomposeBundle) => void;
  onReuseModelShotBundle: (bundle: EcomLibraryModelShotBundle) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  if (entry.kind === "assets") {
    const canContinue =
      section.moduleId === "seed-video" &&
      entry.projectId &&
      entry.projectId.trim().length > 0;
    const continueBusy = reuseBusy === `sv:${entry.projectId}`;

    return (
      <div className="space-y-3">
        {canContinue ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] shadow-sm hover:bg-[#f5f5f7] disabled:opacity-50"
              disabled={continueBusy}
              onClick={() => onOpenSeedVideoProject(entry.projectId!)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              继续编辑
            </button>
          </div>
        ) : null}
        <ul className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
          {entry.group.assets.map((a) => {
            const isVideo = a.kind === "video";
            return (
              <li key={a.id}>
                <EcomMediaLibraryTile
                  kind={isVideo ? "video" : "image"}
                  src={a.ossUrl}
                  thumbnailSrc={a.thumbnailUrl}
                  alt={a.title ?? ""}
                  onPreview={() =>
                    isVideo
                      ? onPreviewVideo(a.ossUrl, a.title ?? undefined)
                      : onPreviewImage(a.thumbnailUrl ?? a.ossUrl, a.title ?? undefined)
                  }
                  onDownload={() =>
                    void downloadMediaUrl(
                      a.ossUrl,
                      mediaDownloadFilename(a.title, a.kind, a.ossUrl),
                    )
                  }
                  onDelete={() => void onDeleteAsset(a)}
                  onPinToAiSpace={() => void onPinAsset(a)}
                  pinnedToAiSpace={pinnedAssetIds.has(a.id)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const thumb = entry.thumbnailUrl;
  const title = entry.projectName;

  if (entry.kind === "product-design") {
    const pdBundle = entry.bundle;
    const busy = reuseBusy === `pd:${pdBundle.projectId}:${pdBundle.savedAt}`;
    return (
      <div className="space-y-3">
        {thumb ? (
          <div className="max-w-[140px]">
            <EcomMediaLibraryTile
              kind="image"
              src={thumb}
              alt={title}
              onPreview={() => onPreviewImage(thumb, title)}
              onDownload={() =>
                void downloadMediaUrl(
                  thumb,
                  mediaDownloadFilename(title, "image", thumb),
                )
              }
            />
          </div>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
          disabled={busy}
          onClick={() => onReuseProductDesignBundle(pdBundle)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {busy ? "复用中…" : "一键复用"}
        </button>
      </div>
    );
  }

  if (entry.kind === "hand-craft") {
    const hcBundle = entry.bundle;
    const busy = reuseBusy === `hc:${hcBundle.projectId}:${hcBundle.savedAt}`;
    return (
      <div className="space-y-3">
        {thumb ? (
          <div className="max-w-[140px]">
            <EcomMediaLibraryTile
              kind="image"
              src={thumb}
              alt={title}
              onPreview={() => onPreviewImage(thumb, title)}
              onDownload={() =>
                void downloadMediaUrl(
                  thumb,
                  mediaDownloadFilename(title, "image", thumb),
                )
              }
            />
          </div>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
          disabled={busy}
          onClick={() => onReuseHandCraftBundle(hcBundle)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {busy ? "复用中…" : "一键复用"}
        </button>
      </div>
    );
  }

  if (entry.kind === "storyboard-draft") {
    const openBusy = reuseBusy === `sb-open:${entry.projectId}`;
    return (
      <div className="space-y-3">
        <p className="text-xs text-[#6e6e73]">
          该项目已有成图/成片，但尚未点「保存工作流」。可直接打开继续编辑，或在工作室顶栏保存后再一键复用。
        </p>
        <StoryboardLibraryDeliverablePanel
          projectId={entry.projectId}
          title={title}
          onPreviewVideo={onPreviewVideo}
          onPreviewImage={onPreviewImage}
        />
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
          disabled={openBusy}
          onClick={() => onOpenStoryboardProject(entry.projectId)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {openBusy ? "打开中…" : "打开项目"}
        </button>
      </div>
    );
  }

  if (entry.kind === "storyboard") {
    const sbBundle = entry.bundle;
    const copyBusy = reuseBusy === `sb-copy:${sbBundle.projectId}:${sbBundle.savedAt}`;
    const openBusy = reuseBusy === `sb-open:${sbBundle.projectId}`;
    return (
      <div className="space-y-3">
        <StoryboardLibraryDeliverablePanel
          projectId={sbBundle.projectId}
          title={title}
          initialSnapshot={sbBundle.snapshot}
          savedAt={sbBundle.savedAt}
          bundleTitle={sbBundle.title}
          onPreviewVideo={onPreviewVideo}
          onPreviewImage={onPreviewImage}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
            disabled={openBusy}
            onClick={() => onOpenStoryboardProject(sbBundle.projectId)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {openBusy ? "打开中…" : "打开项目"}
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            disabled={copyBusy}
            onClick={() => onReuseStoryboardBundle(sbBundle)}
          >
            <Copy className="h-3.5 w-3.5" />
            {copyBusy ? "复制中…" : "复制打开"}
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
            onClick={() => onReviewStoryboardBundle(sbBundle)}
          >
            <Layers className="h-3.5 w-3.5" />
            查看交付包
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
            onClick={() => onShareStoryboardProject(sbBundle.projectId, title)}
          >
            <EcomWechatShareIcon className="h-3.5 w-3.5" />
            分享工作流
          </button>
        </div>
      </div>
    );
  }

  if (entry.kind === "seed-video") {
    const svBundle = entry.bundle;
    const busy = reuseBusy === `sv:${svBundle.projectId}:${svBundle.savedAt}`;
    const videoUrl = svBundle.snapshot.finalVideoUrl?.trim();
    const previewSrc = videoUrl || thumb;
    const previewIsVideo = Boolean(videoUrl) || libraryThumbIsVideo(thumb);
    return (
      <div className="space-y-3">
        {previewSrc ? (
          <div className="max-w-[140px]">
            <EcomMediaLibraryTile
              kind={previewIsVideo ? "video" : "image"}
              src={previewSrc}
              alt={title}
              onPreview={() =>
                previewIsVideo
                  ? onPreviewVideo(previewSrc, title)
                  : onPreviewImage(buildEcomOssThumbUrl(previewSrc), title)
              }
              onDownload={() =>
                void downloadMediaUrl(
                  previewSrc,
                  mediaDownloadFilename(title, previewIsVideo ? "video" : "image", previewSrc),
                )
              }
            />
          </div>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
          disabled={busy}
          onClick={() => onReuseSeedVideoBundle(svBundle)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {busy ? "复用中…" : "一键复用"}
        </button>
      </div>
    );
  }

  if (entry.kind === "media-decompose") {
    const mdBundle = entry.bundle;
    const busy = reuseBusy === `md:${mdBundle.projectId}:${mdBundle.savedAt}`;
    const previewSrc = thumb;
    const previewIsVideo = libraryThumbIsVideo(thumb, mdBundle.hasVideo);
    return (
      <div className="space-y-3">
      {previewSrc ? (
        <div className="max-w-[140px]">
          <EcomMediaLibraryTile
            kind={previewIsVideo ? "video" : "image"}
            src={previewSrc}
            alt={title}
            onPreview={() =>
              previewIsVideo
                ? onPreviewVideo(previewSrc, title)
                : onPreviewImage(buildEcomOssThumbUrl(previewSrc), title)
            }
            onDownload={() =>
              void downloadMediaUrl(
                previewSrc,
                mediaDownloadFilename(title, previewIsVideo ? "video" : "image", previewSrc),
              )
            }
          />
        </div>
      ) : null}
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
        disabled={busy}
        onClick={() => onReuseMediaDecomposeBundle(mdBundle)}
      >
          <RotateCcw className="h-3.5 w-3.5" />
          {busy ? "复用中…" : "一键复用"}
        </button>
      </div>
    );
  }

  if (entry.kind === "model-shot") {
    const msBundle = entry.bundle;
    const busy = reuseBusy === `ms:${msBundle.projectId}:${msBundle.savedAt}`;
    const previewSrc = thumb;
    return (
      <div className="space-y-3">
        {previewSrc ? (
          <div className="max-w-[140px]">
            <EcomMediaLibraryTile
              kind="image"
              src={previewSrc}
              alt={title}
              onPreview={() => onPreviewImage(buildEcomOssThumbUrl(previewSrc), title)}
              onDownload={() =>
                void downloadMediaUrl(
                  previewSrc,
                  mediaDownloadFilename(title, "image", previewSrc),
                )
              }
            />
          </div>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
          disabled={busy}
          onClick={() => onReuseModelShotBundle(msBundle)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {busy ? "复用中…" : "一键复用"}
        </button>
      </div>
    );
  }

  return null;
}
