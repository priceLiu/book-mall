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
import { deleteAsset, type EcomAsset } from "@/lib/ecom-api";
import { reuseProductDesignProject } from "@/lib/ecom-product-design-api";
import {
  listLibrarySections,
  type EcomLibraryAssetGroup,
  type EcomLibraryProductDesignBundle,
  type EcomLibrarySection,
  type EcomLibraryStoryboardBundle,
} from "@/lib/ecom-library-api";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { reuseStoryboardProject } from "@/lib/ecom-storyboard-api";
import type { EcomProjectModule } from "@/lib/product-design-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

const STORYBOARD_STORAGE_KEY = "ecom-storyboard-active-project";
const SEED_VIDEO_STORAGE_KEY = "ecom-seed-video-active-project";

const DOMAIN_ORDER = ["电商", "视频", "品牌"] as const;

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

  useEffect(() => {
    listLibrarySections()
      .then((data) => {
        setSections(data.sections);
        setTotalAssets(data.totalAssets);
        setTotalBundles(data.totalBundles);
      })
      .finally(() => setLoading(false));
  }, []);

  const sectionsByDomain = useMemo(() => {
    const map = new Map<string, EcomLibrarySection[]>();
    for (const section of sections) {
      const domain = section.domainLabel;
      const list = map.get(domain) ?? [];
      list.push(section);
      map.set(domain, list);
    }
    return DOMAIN_ORDER.filter((d) => (map.get(d)?.length ?? 0) > 0).map((d) => ({
      domain: d,
      sections: map.get(d)!,
    }));
  }, [sections]);

  async function onDeleteAsset(a: EcomAsset) {
    if (
      !(await doubleConfirm({
        title: "删除资产",
        message: `确定删除「${a.title ?? "未命名"}」？`,
        secondTitle: "不可恢复",
        secondMessage:
          "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteAsset(a.id);
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
              s.productDesignBundles.length > 0,
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
      const module = (project.module === "detail-page" ? "detail-page" : "main-image") as EcomProjectModule;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(productDesignStorageKey(module), project.id);
      }
      router.push(productDesignStudioPath(module));
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

  const empty = !loading && sections.length === 0;

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
          {loading ? (
            <EcomMediaSkeletonGrid
              count={10}
              gridClass={ECOM_LIBRARY_MEDIA_GRID_CLASS}
            />
          ) : empty ? (
            <p className="text-sm text-[#6e6e73]">
              暂无资产，去各模块生成后会按分类与项目名出现在这里。
            </p>
          ) : (
            <div className="space-y-10">
              {sectionsByDomain.map(({ domain, sections: domainSections }) => (
                <div key={domain} className="space-y-8">
                  <h2 className="text-base font-semibold text-[#1d1d1f]">{domain}</h2>
                  {domainSections.map((section) => (
                    <LibrarySectionBlock
                      key={section.moduleId}
                      section={section}
                      reuseBusy={reuseBusy}
                      onDeleteAsset={onDeleteAsset}
                      onPreviewImage={(src, title) => setPreviewImage({ src, title })}
                      onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                      onReviewStoryboardBundle={(snap) => setReviewSnapshot(snap)}
                      onReuseStoryboardBundle={onReuseStoryboardBundle}
                      onReuseProductDesignBundle={onReuseProductDesignBundle}
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
  reuseBusy,
  onDeleteAsset,
  onPreviewImage,
  onPreviewVideo,
  onReviewStoryboardBundle,
  onReuseStoryboardBundle,
  onReuseProductDesignBundle,
  onOpenSeedVideoProject,
}: {
  section: EcomLibrarySection;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewStoryboardBundle: (snap: StoryboardDeliverableSnapshot) => void;
  onReuseStoryboardBundle: (bundle: EcomLibraryStoryboardBundle) => void;
  onReuseProductDesignBundle: (bundle: EcomLibraryProductDesignBundle) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  const groups =
    section.assetGroups.length > 0
      ? section.assetGroups
      : section.assets.length > 0
        ? [{ projectId: null, projectName: "未命名项目", assets: section.assets }]
        : [];

  if (groups.length === 0 && section.productDesignBundles.length === 0 && section.storyboardBundles.length === 0) {
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
          onPreviewImage={onPreviewImage}
          onPreviewVideo={onPreviewVideo}
          onOpenSeedVideoProject={onOpenSeedVideoProject}
        />
      ))}

      {section.productDesignBundles.length > 0 || section.storyboardBundles.length > 0 ? (
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
        </div>
      ) : null}
    </section>
  );
}

function AssetProjectGroup({
  domain,
  moduleTitle,
  moduleId,
  group,
  reuseBusy,
  onDeleteAsset,
  onPreviewImage,
  onPreviewVideo,
  onOpenSeedVideoProject,
}: {
  domain: string;
  moduleTitle: string;
  moduleId: string;
  group: EcomLibraryAssetGroup;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPreviewImage: (src: string, title?: string) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onOpenSeedVideoProject: (projectId: string) => void;
}) {
  const canContinue =
    moduleId === "seed-video" && group.projectId && group.projectId.trim().length > 0;
  const continueBusy = reuseBusy === `sv:${group.projectId}`;

  return (
    <div>
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
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
