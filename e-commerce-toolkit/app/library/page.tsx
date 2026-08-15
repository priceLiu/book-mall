"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, RotateCcw } from "lucide-react";

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
import { StoryboardDeliverableReviewDialog } from "@/components/storyboard/storyboard-deliverable-review-dialog";
import { EcomPublishDialog } from "@/components/publish/ecom-publish-dialog";
import {
  deleteAsset,
  isAssetPinnedInAiSpace,
  pinAssetToAiSpace,
  type EcomAsset,
} from "@/lib/ecom-api";
import { reuseProductDesignProject } from "@/lib/ecom-product-design-api";
import {
  listLibrarySections,
  type EcomLibraryAssetGroup,
  type EcomLibraryProductDesignBundle,
  type EcomLibrarySection,
  type EcomLibrarySeedVideoBundle,
  type EcomLibraryStoryboardBundle,
} from "@/lib/ecom-library-api";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { reuseSeedVideoProject } from "@/lib/ecom-seed-video-api";
import { reuseStoryboardProject } from "@/lib/ecom-storyboard-api";
import type { EcomProjectModule } from "@/lib/product-design-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

const STORYBOARD_STORAGE_KEY = "ecom-storyboard-active-project";
const SEED_VIDEO_STORAGE_KEY = "ecom-seed-video-active-project";

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
      ) : null}
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
        section.seedVideoBundles.length;
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
    return DOMAIN_ORDER.filter((d) => (map.get(d)?.length ?? 0) > 0).map((d) => ({
      domain: d,
      sections: map.get(d)!,
    }));
  }, [sections, activeTab]);

  const workflowBundles = useMemo(() => {
    const items: Array<{
      key: string;
      section: EcomLibrarySection;
      kind: "product-design" | "storyboard" | "seed-video";
      bundle:
        | EcomLibraryProductDesignBundle
        | EcomLibraryStoryboardBundle
        | EcomLibrarySeedVideoBundle;
    }> = [];
    for (const section of sections) {
      for (const bundle of section.productDesignBundles) {
        items.push({
          key: `pd-${bundle.projectId}-${bundle.savedAt}`,
          section,
          kind: "product-design",
          bundle,
        });
      }
      for (const bundle of section.storyboardBundles) {
        items.push({
          key: `sb-${bundle.projectId}-${bundle.savedAt}`,
          section,
          kind: "storyboard",
          bundle,
        });
      }
      for (const bundle of section.seedVideoBundles) {
        items.push({
          key: `sv-${bundle.projectId}-${bundle.savedAt}`,
          section,
          kind: "seed-video",
          bundle,
        });
      }
    }
    items.sort((a, b) => b.bundle.savedAt.localeCompare(a.bundle.savedAt));
    return items;
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
              s.seedVideoBundles.length > 0,
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
      ? workflowBundles.length === 0
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
                ? "暂无已保存工作流。请在种草视频 / 主图创作 / 微剧故事版等工作台点「保存」后再来此处一键复用。"
                : "该分类暂无资产，去各模块生成后会出现在对应 Tab。"}
            </p>
          ) : activeTab === "workflows" ? (
            <div className="mt-6 space-y-4">
              {workflowBundles.map(({ key, section, kind, bundle }) => (
                <WorkflowBundleCard
                  key={key}
                  section={section}
                  kind={kind}
                  bundle={bundle}
                  reuseBusy={reuseBusy}
                  onPreviewImage={(src, title) => setPreviewImage({ src, title })}
                  onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                  onReviewStoryboardBundle={(snap) => setReviewSnapshot(snap)}
                  onReuseProductDesignBundle={onReuseProductDesignBundle}
                  onReuseStoryboardBundle={onReuseStoryboardBundle}
                  onReuseSeedVideoBundle={onReuseSeedVideoBundle}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-10">
              {filteredSectionsByDomain.map(({ domain, sections: domainSections }) => (
                <div key={domain} className="space-y-8">
                  <h2 className="text-base font-semibold text-[#1d1d1f]">{domain}</h2>
                  {domainSections.map((section) => (
                    <LibrarySectionBlock
                      key={section.moduleId}
                      section={section}
                      flatAssets
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
                      onOpenSeedVideoProject={onOpenSeedVideoProject}
                    />
                  ))}
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
  flatAssets = false,
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
  onOpenSeedVideoProject,
}: {
  section: EcomLibrarySection;
  flatAssets?: boolean;
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
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  const groups = flatAssets
    ? section.assets.length > 0
      ? [{ projectId: null, projectName: section.title, assets: section.assets }]
      : []
    : section.assetGroups.length > 0
      ? section.assetGroups
      : section.assets.length > 0
        ? [{ projectId: null, projectName: "未命名项目", assets: section.assets }]
        : [];

  if (
    groups.length === 0 &&
    section.productDesignBundles.length === 0 &&
    section.storyboardBundles.length === 0 &&
    section.seedVideoBundles.length === 0
  ) {
    return null;
  }

  return (
    <section className="space-y-6">
      <h3 className="text-sm font-semibold text-[#1d1d1f]">{section.title}</h3>

      {groups.map((group) => (
        <AssetProjectGroup
          key={`${section.moduleId}-${group.projectName}`}
          domain={section.domainLabel}
          moduleTitle={section.title}
          moduleId={section.moduleId}
          group={group}
          reuseBusy={reuseBusy}
          onDeleteAsset={onDeleteAsset}
          onPinAsset={onPinAsset}
          pinnedAssetIds={pinnedAssetIds}
          onPreviewImage={onPreviewImage}
          onPreviewVideo={onPreviewVideo}
          onOpenSeedVideoProject={onOpenSeedVideoProject}
          hideProjectHeader={flatAssets}
        />
      ))}

      {!flatAssets &&
      (section.productDesignBundles.length > 0 ||
      section.storyboardBundles.length > 0 ||
      section.seedVideoBundles.length > 0) ? (
        <div className="space-y-4">
          {section.productDesignBundles.map((bundle) => {
            const busy = reuseBusy === `pd:${bundle.projectId}:${bundle.savedAt}`;
            return (
              <div key={`pd-${bundle.projectId}-${bundle.savedAt}`}>
                <LibraryBreadcrumb
                  domain={section.domainLabel}
                  moduleTitle={section.title}
                  projectName={bundle.title}
                />
                <div className="flex flex-wrap items-start gap-3">
                  {bundle.thumbnailUrl ? (
                    <div className="w-[calc(20%-0.4rem)] min-w-[72px] max-w-[140px] flex-1">
                      <EcomMediaLibraryTile
                        kind="image"
                        src={bundle.thumbnailUrl}
                        alt={bundle.title}
                        onPreview={() => onPreviewImage(bundle.thumbnailUrl!, bundle.title)}
                        onDownload={() =>
                          void downloadMediaUrl(
                            bundle.thumbnailUrl!,
                            mediaDownloadFilename(bundle.title, "image", bundle.thumbnailUrl!),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square w-20 items-center justify-center rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
                      <Layers className="h-6 w-6 text-[#86868b] opacity-50" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e8ed] bg-white text-[#1d1d1f] shadow-sm hover:bg-[#f5f5f7] disabled:opacity-50"
                    aria-label="一键复用"
                    title="一键复用"
                    disabled={busy}
                    onClick={() => onReuseProductDesignBundle(bundle)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {section.storyboardBundles.map((bundle) => {
            const busy = reuseBusy === `${bundle.projectId}:${bundle.savedAt}`;
            return (
              <div key={`sb-${bundle.projectId}-${bundle.savedAt}`}>
                <LibraryBreadcrumb
                  domain={section.domainLabel}
                  moduleTitle={section.title}
                  projectName={bundle.title}
                />
                <div className="flex flex-wrap items-start gap-3">
                  {bundle.thumbnailUrl ? (
                    <div className="w-[calc(20%-0.4rem)] min-w-[72px] max-w-[140px] flex-1">
                      <EcomMediaLibraryTile
                        kind="image"
                        src={bundle.thumbnailUrl}
                        alt={bundle.title}
                        onPreview={() => onPreviewImage(bundle.thumbnailUrl!, bundle.title)}
                        onDownload={() =>
                          void downloadMediaUrl(
                            bundle.thumbnailUrl!,
                            mediaDownloadFilename(bundle.title, "image", bundle.thumbnailUrl!),
                          )
                        }
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e8ed] bg-white text-[#1d1d1f] shadow-sm hover:bg-[#f5f5f7]"
                    aria-label="查看交付包"
                    title="查看"
                    onClick={() => onReviewStoryboardBundle(bundle.snapshot)}
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e8ed] bg-[#1d1d1f] text-white shadow-sm hover:bg-black disabled:opacity-50"
                    aria-label="一键复用"
                    title="一键复用"
                    disabled={busy}
                    onClick={() => onReuseStoryboardBundle(bundle)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {section.seedVideoBundles.map((bundle) => {
            const busy = reuseBusy === `sv:${bundle.projectId}:${bundle.savedAt}`;
            const previewUrl = bundle.snapshot.finalVideoUrl?.trim() || bundle.thumbnailUrl;
            return (
              <div key={`sv-${bundle.projectId}-${bundle.savedAt}`}>
                <LibraryBreadcrumb
                  domain={section.domainLabel}
                  moduleTitle={section.title}
                  projectName={bundle.title}
                />
                <div className="flex flex-wrap items-start gap-3">
                  {previewUrl ? (
                    <div className="w-[calc(20%-0.4rem)] min-w-[72px] max-w-[140px] flex-1">
                      <EcomMediaLibraryTile
                        kind={bundle.hasVideo ? "video" : "image"}
                        src={previewUrl}
                        alt={bundle.title}
                        onPreview={() =>
                          bundle.hasVideo
                            ? onPreviewVideo(previewUrl, bundle.title)
                            : onPreviewImage(previewUrl, bundle.title)
                        }
                        onDownload={() =>
                          void downloadMediaUrl(
                            previewUrl,
                            mediaDownloadFilename(
                              bundle.title,
                              bundle.hasVideo ? "video" : "image",
                              previewUrl,
                            ),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square w-20 items-center justify-center rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
                      <Layers className="h-6 w-6 text-[#86868b] opacity-50" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e8ed] bg-[#1d1d1f] text-white shadow-sm hover:bg-black disabled:opacity-50"
                    aria-label="一键复用"
                    title="一键复用"
                    disabled={busy}
                    onClick={() => onReuseSeedVideoBundle(bundle)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function WorkflowBundleCard({
  section,
  kind,
  bundle,
  reuseBusy,
  onPreviewImage,
  onPreviewVideo,
  onReviewStoryboardBundle,
  onReuseProductDesignBundle,
  onReuseStoryboardBundle,
  onReuseSeedVideoBundle,
}: {
  section: EcomLibrarySection;
  kind: "product-design" | "storyboard" | "seed-video";
  bundle:
    | EcomLibraryProductDesignBundle
    | EcomLibraryStoryboardBundle
    | EcomLibrarySeedVideoBundle;
  reuseBusy: string | null;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (snap: StoryboardDeliverableSnapshot) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseSeedVideoBundle: (bundle: EcomLibrarySeedVideoBundle) => void;
}) {
  const title = bundle.title;
  const thumb =
    bundle.thumbnailUrl?.trim() ||
    ("snapshot" in bundle && "finalVideoUrl" in bundle.snapshot
      ? bundle.snapshot.finalVideoUrl?.trim()
      : undefined);

  let busyKey = "";
  let onReuse: () => void = () => {};
  let kindLabel = "";
  let meta = "";

  if (kind === "product-design") {
    const b = bundle as EcomLibraryProductDesignBundle;
    busyKey = `pd:${b.projectId}:${b.savedAt}`;
    onReuse = () => onReuseProductDesignBundle(b);
    kindLabel = b.module === "detail-page" ? "详情页" : "主图";
    meta = `${b.slotCount} 个槽位 · ${b.hasGeneratedImages ? "含成图" : "仅文案/计划"}`;
  } else if (kind === "storyboard") {
    const b = bundle as EcomLibraryStoryboardBundle;
    busyKey = `${b.projectId}:${b.savedAt}`;
    onReuse = () => onReuseStoryboardBundle(b);
    kindLabel = "微剧故事版";
    meta = `${b.panelCount} 镜 · ${b.hasVideo ? "含视频" : "仅分镜"}`;
  } else {
    const b = bundle as EcomLibrarySeedVideoBundle;
    busyKey = `sv:${b.projectId}:${b.savedAt}`;
    onReuse = () => onReuseSeedVideoBundle(b);
    kindLabel = b.productionMode === "direct" ? "方案① 直接成片" : "方案② 精细成片";
    meta = `${b.shotCount > 0 ? `${b.shotCount} 镜 · ` : ""}${b.hasVideo ? "含成片" : "脚本/Prompt"}`;
  }

  const busy = reuseBusy === busyKey;
  const previewIsVideo =
    kind === "seed-video"
      ? (bundle as EcomLibrarySeedVideoBundle).hasVideo
      : kind === "storyboard"
        ? (bundle as EcomLibraryStoryboardBundle).hasVideo
        : false;

  return (
    <div className="rounded-2xl border border-[#e8e8ed] bg-white p-4 shadow-sm">
      <LibraryBreadcrumb domain={section.domainLabel} moduleTitle={section.title} projectName={title} />
      <div className="flex flex-wrap items-start gap-4">
        {thumb ? (
          <div className="w-[calc(20%-0.4rem)] min-w-[88px] max-w-[160px] flex-1">
            <EcomMediaLibraryTile
              kind={previewIsVideo ? "video" : "image"}
              src={thumb}
              alt={title}
              onPreview={() =>
                previewIsVideo
                  ? onPreviewVideo(thumb, title)
                  : onPreviewImage(thumb, title)
              }
              onDownload={() =>
                void downloadMediaUrl(
                  thumb,
                  mediaDownloadFilename(title, previewIsVideo ? "video" : "image", thumb),
                )
              }
            />
          </div>
        ) : (
          <div className="flex aspect-square w-24 items-center justify-center rounded-xl border border-[#e8e8ed] bg-[#f5f5f7]">
            <Layers className="h-7 w-7 text-[#86868b] opacity-50" />
          </div>
        )}
        <div className="min-w-[180px] flex-1 space-y-2">
          <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
          <p className="text-[11px] text-[#6e6e73]">
            {kindLabel}
            {meta ? ` · ${meta}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {kind === "storyboard" ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                onClick={() =>
                  onReviewStoryboardBundle((bundle as EcomLibraryStoryboardBundle).snapshot)
                }
              >
                <Layers className="h-3.5 w-3.5" />
                查看交付包
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-[#1d1d1f] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
              disabled={busy}
              onClick={onReuse}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {busy ? "复用中…" : "一键复用"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetProjectGroup({
  domain,
  moduleTitle,
  moduleId,
  group,
  reuseBusy,
  onDeleteAsset,
  onPinAsset,
  pinnedAssetIds,
  onPreviewImage,
  onPreviewVideo,
  onOpenSeedVideoProject,
  hideProjectHeader = false,
}: {
  domain: string;
  moduleTitle: string;
  moduleId: string;
  group: EcomLibraryAssetGroup;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPinAsset: (a: EcomAsset) => void;
  pinnedAssetIds: Set<string>;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
  hideProjectHeader?: boolean;
}) {
  const canContinue =
    moduleId === "seed-video" && group.projectId && group.projectId.trim().length > 0;
  const continueBusy = reuseBusy === `sv:${group.projectId}`;

  return (
    <div>
      {!hideProjectHeader ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <LibraryBreadcrumb
            domain={domain}
            moduleTitle={moduleTitle}
            projectName={group.projectName}
          />
          {canContinue ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] shadow-sm hover:bg-[#f5f5f7] disabled:opacity-50"
              disabled={continueBusy}
              onClick={() => onOpenSeedVideoProject(group.projectId!)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              继续编辑
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
        {group.assets.map((a) => {
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
