"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Upload, Video } from "lucide-react";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { EcomScrollLoadFooter } from "@/components/media/ecom-scroll-load-footer";
import { EcomTemplateGalleryTile } from "@/components/media/ecom-template-gallery-tile";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomTemplateGalleryImportDialog } from "@/components/template-gallery/ecom-template-gallery-import-dialog";
import { EcomTemplateImportPanel } from "@/components/template-gallery/ecom-template-import-panel";
import {
  EcomTemplateImportProvider,
  useEcomTemplateImport,
} from "@/components/template-gallery/ecom-template-import-provider";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";
import { useEcomScrollPagination } from "@/lib/use-ecom-scroll-pagination";
import {
  listEcomTemplateGalleryEntriesStatic,
  mergeTemplateGalleryEntries,
} from "@/lib/ecom-template-gallery/catalog";
import {
  fetchEcomTemplateGalleryCatalog,
  fetchEcomTemplateGalleryCategorySummary,
} from "@/lib/ecom-template-gallery-api";
import {
  loadEcomTemplateGalleryViewState,
  saveEcomTemplateGalleryViewState,
} from "@/lib/ecom-template-gallery/view-persistence";
import { useEcomTemplateImportAccess } from "@/lib/ecom-tools-admin.client";
import {
  ECOM_TEMPLATE_CATEGORY_META,
  isTemplateCategoryAvailable,
  summaryRowFor,
  templateGalleryHasMediaKind,
  type EcomTemplateCategory,
  type EcomTemplateCategorySummaryRow,
  type EcomTemplateMediaKind,
  type EcomTemplateGalleryEntry,
} from "@/lib/ecom-template-gallery/types";

const GRID_CLASS = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";

type MediaFilter = "all" | EcomTemplateMediaKind;

function filterTemplates(
  templates: EcomTemplateGalleryEntry[],
  category: EcomTemplateCategory,
  media: MediaFilter,
): EcomTemplateGalleryEntry[] {
  return templates.filter((t) => {
    if (t.category !== category) return false;
    if (media !== "all" && t.mediaKind !== media) return false;
    return true;
  });
}

function TemplateGalleryPageInner() {
  const savedViewRef = useRef({
    category: "accessories" as EcomTemplateCategory,
    media: "image" as MediaFilter,
    scrollTop: 0,
  });
  const scrollRestoredRef = useRef(false);

  const { canImport, loading: importAccessLoading } = useEcomTemplateImportAccess();
  const { setOnEntryUploaded } = useEcomTemplateImport();
  const [allTemplates, setAllTemplates] = useState<EcomTemplateGalleryEntry[]>(
    () => listEcomTemplateGalleryEntriesStatic(),
  );
  const [summary, setSummary] = useState<EcomTemplateCategorySummaryRow[]>([]);
  /** 概览来自数据库时才可据以判定「该分类为空」 */
  const [catalogAuthoritative, setCatalogAuthoritative] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const loadedCategoriesRef = useRef<Set<EcomTemplateCategory>>(new Set());
  const [category, setCategory] = useState<EcomTemplateCategory>("accessories");
  const [media, setMedia] = useState<MediaFilter>("image");
  const [importOpen, setImportOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    thumbSrc?: string;
    title?: string;
  } | null>(null);
  const [videoPreview, setVideoPreview] = useState<{
    src: string;
    title?: string;
    poster?: string;
  } | null>(null);

  /** 只拉当前分类；已拉过的分类不重复请求 */
  const loadCategory = useCallback(
    async (target: EcomTemplateCategory, force = false) => {
      if (!force && loadedCategoriesRef.current.has(target)) return;
      setLoadingCategory(true);
      try {
        const { catalog, source } =
          await fetchEcomTemplateGalleryCatalog(target);
        setAllTemplates((prev) =>
          mergeTemplateGalleryEntries(prev, catalog.templates ?? []),
        );
        if (source === "remote") loadedCategoriesRef.current.add(target);
      } catch {
        /* 保留已有列表 */
      } finally {
        setLoadingCategory(false);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const saved = loadEcomTemplateGalleryViewState();
    savedViewRef.current = saved;
    setCategory(saved.category);
    setMedia(saved.media);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await fetchEcomTemplateGalleryCategorySummary();
      if (cancelled || !loaded) return;
      setSummary(loaded.categories);
      setCatalogAuthoritative(loaded.source === "remote");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadCategory(category);
  }, [category, loadCategory]);

  useEffect(() => {
    setOnEntryUploaded((entry) => {
      setAllTemplates((prev) => mergeTemplateGalleryEntries(prev, [entry]));
    });
    return () => setOnEntryUploaded(undefined);
  }, [setOnEntryUploaded]);

  useEffect(() => {
    saveEcomTemplateGalleryViewState({ category, media });
  }, [category, media]);

  /** 概览与已加载条目取并集：概览负责未加载的分类，已加载条目让新导入立刻生效 */
  const categoryHasEntries = useCallback(
    (target: EcomTemplateCategory) =>
      (summaryRowFor(summary, target)?.total ?? 0) > 0 ||
      isTemplateCategoryAvailable(target, allTemplates),
    [summary, allTemplates],
  );

  const categoryAvailable = categoryHasEntries(category) || !catalogAuthoritative;
  const currentSummary = summaryRowFor(summary, category);
  const hasVideos =
    (currentSummary?.video ?? 0) > 0 ||
    templateGalleryHasMediaKind(allTemplates, category, "video");
  const hasImages =
    (currentSummary?.image ?? 0) > 0 ||
    templateGalleryHasMediaKind(allTemplates, category, "image");

  const mediaOptions: Array<{
    value: MediaFilter;
    label: string;
    icon: typeof ImageIcon;
    enabled: boolean;
  }> = useMemo(
    () => [
      { value: "all", label: "全部", icon: ImageIcon, enabled: categoryAvailable },
      {
        value: "image",
        label: "图片",
        icon: ImageIcon,
        enabled: categoryAvailable && hasImages,
      },
      {
        value: "video",
        label: "视频",
        icon: Video,
        enabled: categoryAvailable && hasVideos,
      },
    ],
    [categoryAvailable, hasImages, hasVideos],
  );

  useEffect(() => {
    if (!categoryAvailable) return;
    const opt = mediaOptions.find((o) => o.value === media);
    if (opt && !opt.enabled) {
      const fallback = mediaOptions.find((o) => o.enabled);
      if (fallback) setMedia(fallback.value);
    }
  }, [media, mediaOptions, categoryAvailable]);

  const templates = useMemo(
    () => (categoryAvailable ? filterTemplates(allTemplates, category, media) : []),
    [allTemplates, category, media, categoryAvailable],
  );

  const {
    scrollRef,
    sentinelRef,
    visibleCount,
    hasMore,
    loadingMore,
    pageSize,
  } = useEcomScrollPagination({
    total: templates.length,
    resetKey: `${category}:${media}`,
  });

  const visibleTemplates = useMemo(
    () => templates.slice(0, visibleCount),
    [templates, visibleCount],
  );

  // 刷新后恢复滚动位置（仅一次）
  useEffect(() => {
    scrollRestoredRef.current = false;
  }, [category, media]);

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root || scrollRestoredRef.current || templates.length === 0) return;

    const savedTop = savedViewRef.current.scrollTop;
    if (savedTop <= 0) {
      scrollRestoredRef.current = true;
      return;
    }

    root.scrollTop = savedTop;
    scrollRestoredRef.current = true;
  }, [templates.length, scrollRef, category, media]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    // window.setTimeout 返回 number；勿用 ReturnType<typeof setTimeout>（会取到 @types/node 的 Timeout）
    let timer: number | undefined;
    const onScroll = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveEcomTemplateGalleryViewState({ scrollTop: root.scrollTop });
      }, 120);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [scrollRef, category, media]);

  const loaded = visibleTemplates.length;
  const categoryMeta = ECOM_TEMPLATE_CATEGORY_META.find((c) => c.id === category);

  return (
    <>
      <EcomWorkspaceLayout fullWidth>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[#e8e8ed] px-4 py-4 sm:px-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-[#1d1d1f]">模板区</h1>
                  <p className="mt-1 text-xs text-[#6e6e73]">
                    案例库模板参考，按品类浏览；更多品类数据持续补充中。
                  </p>
                </div>
                {canImport ? (
                  <EcomButtonSecondary
                    type="button"
                    className="max-w-none shrink-0 border-[#0071e3] text-[#0071e3]"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    导入 HTML
                  </EcomButtonSecondary>
                ) : importAccessLoading ? (
                  <span className="text-xs text-[#86868b]">…</span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {ECOM_TEMPLATE_CATEGORY_META.map((cat) => {
                  // 权威概览未到手前不能断言分类为空，否则新导入的分类会被误标「敬请期待」
                  const available =
                    categoryHasEntries(cat.id) || !catalogAuthoritative;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={!available}
                      title={
                        available ? cat.label : `${cat.label}（敬请期待）`
                      }
                      onClick={() => {
                        if (!available) return;
                        setCategory(cat.id);
                        saveEcomTemplateGalleryViewState({
                          category: cat.id,
                          scrollTop: 0,
                        });
                        savedViewRef.current.scrollTop = 0;
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        category === cat.id && available
                          ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                          : available
                            ? "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                            : "cursor-not-allowed border-[#e8e8ed] bg-[#f5f5f7] text-[#86868b]",
                      )}
                    >
                      {cat.label}
                      {!available ? (
                        <span className="ml-1 text-[10px] opacity-70">敬请期待</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {mediaOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!opt.enabled}
                    onClick={() => {
                      if (!opt.enabled) return;
                      setMedia(opt.value);
                      saveEcomTemplateGalleryViewState({
                        media: opt.value,
                        scrollTop: 0,
                      });
                      savedViewRef.current.scrollTop = 0;
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition",
                      media === opt.value && opt.enabled
                        ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                        : opt.enabled
                          ? "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                          : "cursor-not-allowed border-[#e8e8ed] bg-[#f5f5f7] text-[#86868b]",
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-[#6e6e73]">
                {!categoryAvailable
                  ? `${categoryMeta?.label ?? ""} 案例筹备中，敬请期待。`
                  : templates.length === 0
                    ? loadingCategory
                      ? "清单加载中…"
                      : "暂无案例。"
                    : hasMore
                      ? loadingMore
                        ? `正在加载… ${loaded} / ${templates.length} 个案例`
                        : `已加载 ${loaded} / ${templates.length} 个案例（滚动加载更多）`
                      : `共 ${templates.length} 个案例`}
              </p>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6"
          >
            {!categoryAvailable ? (
              <p className="text-sm text-[#6e6e73]">
                「{categoryMeta?.label}」模板筹备中，后续会在此展示。
              </p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-[#6e6e73]">
                目录为空。
                {canImport ? " 点击右上角「导入 HTML」从页面源码批量上传。" : null}
              </p>
            ) : (
              <>
                <ul className={GRID_CLASS}>
                  {visibleTemplates.map((entry) => (
                    <li key={entry.id}>
                      <EcomTemplateGalleryTile
                        entry={entry}
                        onPreview={() => {
                          if (entry.mediaKind === "video") {
                            setVideoPreview({
                              src: entry.ossUrl,
                              title: entry.title,
                              poster: entry.thumbUrl || undefined,
                            });
                          } else {
                            setImagePreview({
                              src: entry.ossUrl,
                              thumbSrc: entry.thumbUrl,
                              title: entry.title,
                            });
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
                <EcomScrollLoadFooter
                  sentinelRef={sentinelRef}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  gridClass={GRID_CLASS}
                  skeletonAspect="3/4"
                  skeletonCount={Math.min(pageSize, templates.length - loaded)}
                />
              </>
            )}
          </div>
        </div>
      </EcomWorkspaceLayout>

      {canImport ? (
        <EcomTemplateGalleryImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          existingTemplates={allTemplates}
        />
      ) : null}

      <EcomTemplateImportPanel />

      {imagePreview ? (
        <EcomImagePreviewDialog
          src={imagePreview.src}
          thumbSrc={imagePreview.thumbSrc}
          title="模板预览"
          borderless
          open
          onOpenChange={(open) => {
            if (!open) setImagePreview(null);
          }}
        />
      ) : null}

      {videoPreview ? (
        <EcomVideoPreviewDialog
          src={videoPreview.src}
          title={videoPreview.title}
          poster={videoPreview.poster}
          open
          onOpenChange={(open) => {
            if (!open) setVideoPreview(null);
          }}
        />
      ) : null}
    </>
  );
}

export default function TemplateGalleryPage() {
  return (
    <EcomTemplateImportProvider>
      <TemplateGalleryPageInner />
    </EcomTemplateImportProvider>
  );
}
