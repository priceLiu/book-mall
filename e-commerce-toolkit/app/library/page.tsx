"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Layers, RotateCcw } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomHomeAssistant } from "@/components/layout/ecom-home-assistant";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import { StoryboardDeliverableReviewDialog } from "@/components/storyboard/storyboard-deliverable-review-dialog";
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
import {
  listLibrarySections,
  type EcomLibraryAssetGroup,
  type EcomLibraryHandCraftBundle,
  type EcomLibraryMediaDecomposeBundle,
  type EcomLibraryProductDesignBundle,
  type EcomLibrarySection,
  type EcomLibrarySeedVideoBundle,
  type EcomLibraryStoryboardBundle,
} from "@/lib/ecom-library-api";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { isStoryboardImageUrl, isStoryboardVideoUrl } from "@/lib/storyboard-media";
import { reuseSeedVideoProject } from "@/lib/ecom-seed-video-api";
import { reuseStoryboardProject } from "@/lib/ecom-storyboard-api";
import type { EcomProjectModule } from "@/lib/product-design-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

const STORYBOARD_STORAGE_KEY = "ecom-storyboard-active-project";
const SEED_VIDEO_STORAGE_KEY = "ecom-seed-video-active-project";
const MEDIA_DECOMPOSE_STORAGE_KEY = "ecom-media-decompose-active-project";
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
          在工具内点「保存」后，完整 Prompt / 参考图 / 脚本会出现在此；点「一键复用」可换参考图再生成。
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

type LibraryWorkflowEntry = Exclude<LibraryProjectEntry, { kind: "assets" }>;

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
  const [previewImage, setPreviewImage] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [reviewSnapshot, setReviewSnapshot] =
    useState<StoryboardDeliverableSnapshot | null>(null);
  const [reuseBusy, setReuseBusy] = useState<string | null>(null);
  const [pinnedAssetIds, setPinnedAssetIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<LibraryTab>("all");

  useEffect(() => {
    listLibrarySections()
      .then((data) => {
        setSections(data.sections);
        setTotalAssets(data.totalAssets);
        setTotalBundles(data.totalBundles);
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
    for (const section of sections) {
      const mediaCount = section.assets.length;
      const bundleCount =
        section.storyboardBundles.length +
        section.productDesignBundles.length +
        section.seedVideoBundles.length +
        section.handCraftBundles.length +
        section.mediaDecomposeBundles.length;
      counts.workflows += bundleCount;
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

  const workflowSections = useMemo(() => {
    return DOMAIN_ORDER.flatMap((domain) =>
      sections
        .filter((s) => s.domainLabel === domain)
        .map((section) => {
          const entries = buildSectionProjectEntries(section).filter(
            (e): e is LibraryWorkflowEntry => e.kind !== "assets",
          );
          return entries.length > 0 ? { section, entries } : null;
        })
        .filter((x): x is { section: EcomLibrarySection; entries: LibraryWorkflowEntry[] } => x !== null),
    );
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

  async function onReuseStoryboardBundle(bundle: EcomLibraryStoryboardBundle) {
    const key = `${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseStoryboardProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORYBOARD_STORAGE_KEY, project.id);
      }
      router.push("/ecom/storyboard/micro-drama");
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
      ? workflowSections.length === 0
      : filteredSectionsByDomain.length === 0);

  return (
    <>
      <EcomWorkspaceLayout
        assistantHeader={
          <>
            <h1 className="text-lg font-semibold text-[#1d1d1f]">我的资产</h1>
            <div className="mt-2">
              <EcomPublishDialog
                content="从电商工具箱发起的示例发布：请在资产详情中选择具体文案后使用。"
                triggerLabel="一键发布（示例）"
              />
            </div>
            <p className="text-xs text-[#6e6e73]">
              {loading
                ? "加载中…"
                : `共 ${totalAssets} 条媒体 · ${totalBundles} 套工作流/交付包`}
            </p>
          </>
        }
        assistant={<EcomHomeAssistant variant="library" />}
      >
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {!loading ? (
            <LibraryTabBar active={activeTab} onChange={setActiveTab} counts={tabCounts} />
          ) : null}
          {loading ? (
            <EcomMediaSkeletonGrid
              count={10}
              gridClass={ECOM_LIBRARY_MEDIA_GRID_CLASS}
            />
          ) : empty ? (
            <p className="mt-6 text-sm text-[#6e6e73]">
              {activeTab === "workflows"
                ? "暂无已保存工作流。请在拆图拆视频 / 手伴创作 / 主图创作 / 种草视频 / 微剧故事版等工作台点「保存」后再来此处一键复用。"
                : "该分类暂无资产，去各模块生成后会出现在对应 Tab。"}
            </p>
          ) : activeTab === "workflows" ? (
            <div className="mt-6 space-y-10">
              {workflowSections.map(({ section, entries }) => (
                <LibrarySectionBlock
                  key={section.moduleId}
                  section={section}
                  projectEntries={entries}
                  reuseBusy={reuseBusy}
                  onDeleteAsset={onDeleteAsset}
                  onPinAsset={onPinAsset}
                  pinnedAssetIds={pinnedAssetIds}
                  onPreviewImage={(src, title) => setPreviewImage({ src, title })}
                  onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                  onReviewStoryboardBundle={(snap) => setReviewSnapshot(snap)}
                  onReuseStoryboardBundle={onReuseStoryboardBundle}
                  onReuseProductDesignBundle={onReuseProductDesignBundle}
                  onReuseSeedVideoBundle={onReuseSeedVideoBundle}
                  onReuseHandCraftBundle={onReuseHandCraftBundle}
                  onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
                  onOpenSeedVideoProject={onOpenSeedVideoProject}
                />
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
                        onPreviewImage={(src, title) => setPreviewImage({ src, title })}
                        onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                        onReviewStoryboardBundle={(snap) => setReviewSnapshot(snap)}
                        onReuseStoryboardBundle={onReuseStoryboardBundle}
                        onReuseProductDesignBundle={onReuseProductDesignBundle}
                        onReuseSeedVideoBundle={onReuseSeedVideoBundle}
                        onReuseHandCraftBundle={onReuseHandCraftBundle}
                        onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
                        onOpenSeedVideoProject={onOpenSeedVideoProject}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </EcomWorkspaceLayout>

      {previewImage ? (
        <EcomImagePreviewDialog
          src={previewImage.src}
          title={previewImage.title}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewImage(null);
          }}
        />
      ) : null}

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
  onReuseProductDesignBundle,
  onReuseSeedVideoBundle,
  onReuseHandCraftBundle,
  onReuseMediaDecomposeBundle,
  onOpenSeedVideoProject,
}: {
  section: EcomLibrarySection;
  projectEntries: LibraryProjectEntry[];
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (snap: StoryboardDeliverableSnapshot) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
  onReuseHandCraftBundle: (bundle: EcomLibraryHandCraftBundle) => void;
  onReuseMediaDecomposeBundle: (bundle: EcomLibraryMediaDecomposeBundle) => void;
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
            onReuseProductDesignBundle={onReuseProductDesignBundle}
            onReuseSeedVideoBundle={onReuseSeedVideoBundle}
            onReuseHandCraftBundle={onReuseHandCraftBundle}
            onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
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
  onReuseProductDesignBundle,
  onReuseSeedVideoBundle,
  onReuseHandCraftBundle,
  onReuseMediaDecomposeBundle,
  onOpenSeedVideoProject,
}: {
  entry: LibraryProjectEntry;
  section: EcomLibrarySection;
  expanded: boolean;
  onToggle: () => void;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (snap: StoryboardDeliverableSnapshot) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
  onReuseHandCraftBundle: (bundle: EcomLibraryHandCraftBundle) => void;
  onReuseMediaDecomposeBundle: (bundle: EcomLibraryMediaDecomposeBundle) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  const isVideoThumb = libraryThumbIsVideo(
    entry.thumbnailUrl,
    entry.kind === "seed-video"
      ? entry.bundle.hasVideo
      : entry.kind === "storyboard"
        ? entry.bundle.hasVideo
        : entry.kind === "media-decompose"
          ? entry.bundle.hasVideo
          : entry.kind === "assets"
            ? entry.group.assets.length > 0 &&
              entry.group.assets.every((a) => a.kind === "video")
            : false,
  );

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
            onReuseProductDesignBundle={onReuseProductDesignBundle}
            onReuseSeedVideoBundle={onReuseSeedVideoBundle}
            onReuseHandCraftBundle={onReuseHandCraftBundle}
            onReuseMediaDecomposeBundle={onReuseMediaDecomposeBundle}
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
  onReuseProductDesignBundle,
  onReuseSeedVideoBundle,
  onReuseHandCraftBundle,
  onReuseMediaDecomposeBundle,
  onOpenSeedVideoProject,
}: {
  entry: LibraryProjectEntry;
  section: EcomLibrarySection;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (snap: StoryboardDeliverableSnapshot) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
  onReuseHandCraftBundle: (bundle: EcomLibraryHandCraftBundle) => void;
  onReuseMediaDecomposeBundle: (bundle: EcomLibraryMediaDecomposeBundle) => void;
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

  if (entry.kind === "storyboard") {
    const sbBundle = entry.bundle;
    const busy = reuseBusy === `${sbBundle.projectId}:${sbBundle.savedAt}`;
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
            onClick={() => onReviewStoryboardBundle(sbBundle.snapshot)}
          >
            <Layers className="h-3.5 w-3.5" />
            查看交付包
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
            disabled={busy}
            onClick={() => onReuseStoryboardBundle(sbBundle)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {busy ? "复用中…" : "一键复用"}
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

  return null;
}
