"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ImageIcon, Upload, Video } from "lucide-react";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  EcomImagePreviewHost,
  mapPreviewItemsFromEntries,
  useEcomImagePreview,
} from "@/components/media";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { EcomScrollLoadFooter } from "@/components/media/ecom-scroll-load-footer";
import { EcomTemplateGalleryTile } from "@/components/media/ecom-template-gallery-tile";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomTemplateGalleryImportDialog } from "@/components/template-gallery/ecom-template-gallery-import-dialog";
import { EcomTemplateImportPanel } from "@/components/template-gallery/ecom-template-import-panel";
import {
  EcomTemplateImportProvider,
  useEcomTemplateImport,
} from "@/components/template-gallery/ecom-template-import-provider";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
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
import { shuffleByIdForDisplay } from "@/lib/ecom-random-order";
import {
  loadEcomTemplateGalleryViewState,
  saveEcomTemplateGalleryViewState,
} from "@/lib/ecom-template-gallery/view-persistence";
import { useEcomTemplateImportAccess } from "@/lib/ecom-tools-admin.client";
import {
  ECOM_TEMPLATE_CATEGORY_META,
  ECOM_TEMPLATE_MORE_CATEGORIES,
  ECOM_TEMPLATE_PRIMARY_CATEGORIES,
  isTemplateCategoryAvailable,
  summaryRowFor,
  templateGalleryHasMediaKind,
  type EcomTemplateCategory,
  type EcomTemplateCategoryMeta,
  type EcomTemplateCategorySummaryRow,
  type EcomTemplateMediaKind,
  type EcomTemplateGalleryEntry,
} from "@/lib/ecom-template-gallery/types";

const GRID_CLASS = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
/** 首屏骨架数量：约铺满一屏（6 列 × 3 行） */
const FIRST_SCREEN_SKELETON_COUNT = 18;

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
  /** 0 = 未洗牌，与服务端渲染顺序一致，避免水合不一致 */
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const categoryRowRef = useRef<HTMLDivElement>(null);
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

  /** 每次进页面 / 点分类都换一批展示顺序，避免总是先看到同样的头几屏 */
  const reshuffle = useCallback(() => {
    setShuffleSeed(Math.floor(Math.random() * 0xffffffff) + 1);
  }, []);

  useLayoutEffect(() => {
    const saved = loadEcomTemplateGalleryViewState();
    savedViewRef.current = saved;
    setCategory(saved.category);
    setMedia(saved.media);
  }, []);

  useEffect(() => {
    reshuffle();
  }, [reshuffle]);

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
    () =>
      categoryAvailable
        ? shuffleByIdForDisplay(
            filterTemplates(allTemplates, category, media),
            shuffleSeed,
          )
        : [],
    [allTemplates, category, media, categoryAvailable, shuffleSeed],
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
    // 重新洗牌后必须回到首屏，否则会停在新顺序的中间
    resetKey: `${category}:${media}:${shuffleSeed}`,
  });

  const visibleTemplates = useMemo(
    () => templates.slice(0, visibleCount),
    [templates, visibleCount],
  );

  const templateImagePreviewItems = useMemo(
    () =>
      mapPreviewItemsFromEntries(
        visibleTemplates
          .filter((t) => t.mediaKind === "image")
          .map((t) => ({
            url: t.ossUrl,
            title: t.title,
            thumbUrl: t.thumbUrl,
          })),
      ),
    [visibleTemplates],
  );
  const {
    preview: imagePreviewState,
    openPreview: openTemplateImagePreview,
    closePreview: closeTemplateImagePreview,
  } = useEcomImagePreview(templateImagePreviewItems);

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

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!categoryRowRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const loaded = visibleTemplates.length;
  const categoryMeta = ECOM_TEMPLATE_CATEGORY_META.find((c) => c.id === category);
  const activeMoreCategory = ECOM_TEMPLATE_MORE_CATEGORIES.find(
    (c) => c.id === category,
  );

  const selectCategory = (next: EcomTemplateCategory) => {
    setCategory(next);
    setMoreOpen(false);
    reshuffle();
    saveEcomTemplateGalleryViewState({ category: next, scrollTop: 0 });
    savedViewRef.current.scrollTop = 0;
  };

  const renderCategoryChip = (cat: EcomTemplateCategoryMeta) => {
    // 权威概览未到手前不能断言分类为空，否则新导入的分类会被误标「敬请期待」
    const available = categoryHasEntries(cat.id) || !catalogAuthoritative;
    return (
      <button
        key={cat.id}
        type="button"
        disabled={!available}
        title={available ? cat.label : `${cat.label}（敬请期待）`}
        onClick={() => {
          if (!available) return;
          selectCategory(cat.id);
        }}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
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
  };

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
                  <EcomIconToolbar>
                    <EcomIconToolbarGroup label="管理">
                      <EcomIconButton
                        label="导入 HTML"
                        icon={Upload}
                        variant="accent"
                        onClick={() => setImportOpen(true)}
                      />
                    </EcomIconToolbarGroup>
                  </EcomIconToolbar>
                ) : importAccessLoading ? (
                  <span className="text-xs text-[#86868b]">…</span>
                ) : null}
              </div>

              {/* 分类占左侧，媒体筛选靠右，共用一行 */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div
                  ref={categoryRowRef}
                  className="relative flex flex-wrap items-center gap-2"
                >
                  {ECOM_TEMPLATE_PRIMARY_CATEGORIES.map(renderCategoryChip)}

                  {/* 选中项在「更多」里时提到行内，否则用户看不出当前选的是哪个 */}
                  {activeMoreCategory
                    ? renderCategoryChip(activeMoreCategory)
                    : null}

                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      moreOpen
                        ? "border-[#1d1d1f] bg-[#f5f5f7] text-[#1d1d1f]"
                        : "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]",
                    )}
                  >
                    更多
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        moreOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {moreOpen ? (
                    // 贴分类行左缘展开而非贴按钮：按钮位置随换行漂移，贴它会在窄屏溢出右边界
                    <div className="absolute left-0 top-full z-30 mt-2 max-h-[50vh] w-[min(92vw,520px)] overflow-y-auto rounded-xl border border-[#e8e8ed] bg-white p-3 shadow-lg">
                      <div className="flex flex-wrap gap-2">
                        {ECOM_TEMPLATE_MORE_CATEGORIES.map(renderCategoryChip)}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
              loadingCategory ? (
                // 清单要几秒才回来，先铺一屏骨架；确实为空时才落到下面的提示
                <EcomMediaSkeletonGrid
                  count={FIRST_SCREEN_SKELETON_COUNT}
                  gridClass={GRID_CLASS}
                  aspect="3/4"
                />
              ) : (
                <p className="text-sm text-[#6e6e73]">
                  暂无案例。
                  {canImport
                    ? " 点击右上角「导入 HTML」从页面源码批量上传。"
                    : null}
                </p>
              )
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
                            openTemplateImagePreview(
                              entry.ossUrl,
                              entry.title,
                              templateImagePreviewItems,
                            );
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

      <EcomImagePreviewHost
        preview={imagePreviewState}
        galleryItems={templateImagePreviewItems}
        onClose={closeTemplateImagePreview}
      />

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
