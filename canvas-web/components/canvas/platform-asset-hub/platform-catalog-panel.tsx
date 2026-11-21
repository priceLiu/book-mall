"use client";

import { CanvasListGridSkeleton } from "@/components/canvas/canvas-list-skeleton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { globalAssetCatalogCopyPromptText } from "@/docker-shared/global-asset-library/catalog-media-url";
import { GALD_PAGE_SIZE } from "@/docker-shared/global-asset-library/theme";
import type {
  GlobalAssetCatalogFacets,
  GlobalAssetCatalogKind,
  GlobalAssetCatalogMediaFilter,
  GlobalAssetLibraryApiClient,
  GlobalAssetPickItem,
} from "@/docker-shared/global-asset-library/types";
import {
  platformCatalogPickNav,
  platformCatalogSaveTypeLabel,
  platformHubModelCatalogNav,
} from "@/docker-shared/global-asset-library/platform-catalog-save-types";
import { cn } from "@/lib/utils";

import { PlatformCatalogImageTile } from "./platform-catalog-image-tile";
import { platformCatalogPromptFirst, platformCatalogPreviewUrl } from "./platform-catalog-item-utils";
import { PlatformCatalogPromptCard } from "./platform-catalog-prompt-card";

export type PlatformCatalogPanelNav = "hub-model" | "fixed-kind" | "catalog-pick";

const GENDER_FILTER_KINDS = new Set<GlobalAssetCatalogKind>([
  "full-body",
  "avatar",
  "garment",
  "pose",
]);

export type PlatformCatalogPanelProps = {
  api: GlobalAssetLibraryApiClient;
  /** hub-model：模特·素材三级；fixed-kind：单 catalog 二级 Tab */
  catalogNav?: PlatformCatalogPanelNav;
  fixedKind?: GlobalAssetCatalogKind;
  /** 平台官方 catalog；false 时拉个人/团队条目（我的共用） */
  platformOnly?: boolean;
  previewLightboxZIndex?: number;
  maxSelect?: number;
  onPick?: (items: GlobalAssetPickItem[]) => void | Promise<void>;
  onCancel?: () => void;
  onPreview?: (item: GlobalAssetPickItem) => void;
  onInsert?: (item: GlobalAssetPickItem) => void;
};

export function PlatformCatalogPanel({
  api,
  catalogNav = "hub-model",
  fixedKind = "scene",
  platformOnly = true,
  previewLightboxZIndex: _previewLightboxZIndex = 2100,
  maxSelect = 9,
  onPick,
  onCancel,
  onPreview,
  onInsert,
}: PlatformCatalogPanelProps) {
  const { alert } = useDialogs();
  const pickMode = Boolean(onPick);
  const navItems = useMemo(() => {
    if (catalogNav === "fixed-kind") return [];
    if (catalogNav === "catalog-pick") return platformCatalogPickNav();
    return platformHubModelCatalogNav();
  }, [catalogNav]);
  const hubKindIds = useMemo(
    () => (catalogNav === "hub-model" ? navItems.map((n) => n.id) : []),
    [catalogNav, navItems],
  );
  const lockedKind =
    catalogNav === "fixed-kind"
      ? fixedKind
      : catalogNav === "catalog-pick"
        ? "reference"
        : "pose";
  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>(lockedKind);
  const [gender, setGender] = useState("all");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [allItems, setAllItems] = useState<GlobalAssetPickItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [listTotal, setListTotal] = useState<number | null>(null);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [poseMediaFilter, setPoseMediaFilter] =
    useState<GlobalAssetCatalogMediaFilter>("all");
  const [poseCategory, setPoseCategory] = useState("all");
  const [poseFacets, setPoseFacets] = useState<GlobalAssetCatalogFacets | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);
  const countsGenRef = useRef(0);
  const allItemsLenRef = useRef(0);
  allItemsLenRef.current = allItems.length;

  useEffect(() => {
    if (catalogNav === "fixed-kind") {
      setCatalogKind(fixedKind);
      return;
    }
    setCatalogKind(catalogNav === "catalog-pick" ? "reference" : "pose");
  }, [catalogNav, fixedKind]);

  useEffect(() => {
    const t = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [keywordInput]);

  const poseFiltersActive = catalogKind === "pose";

  const fetchHubCounts = useCallback(async () => {
    if (hubKindIds.length === 0) return;
    const gen = ++countsGenRef.current;
    try {
      const page = await api.fetchCatalog({
        kind: catalogKind,
        gender: gender === "all" ? null : gender,
        keyword,
        limit: 0,
        countsKinds: hubKindIds,
        platformOnly,
        projectId: undefined,
        mediaFilter: poseFiltersActive ? poseMediaFilter : "all",
        poseCategory:
          poseFiltersActive && poseCategory !== "all" ? poseCategory : null,
      });
      if (gen !== countsGenRef.current) return;
      setCounts((c) => ({ ...c, ...(page.counts ?? {}) }));
    } catch {
      // 条数预取失败不阻塞列表
    }
  }, [
    api,
    catalogKind,
    gender,
    hubKindIds,
    keyword,
    platformOnly,
    poseCategory,
    poseFiltersActive,
    poseMediaFilter,
  ]);

  useEffect(() => {
    void fetchHubCounts();
  }, [fetchHubCounts]);

  const fetchCatalog = useCallback(
    async (append?: boolean) => {
      const isAppend = append === true;
      const gen = ++fetchGenRef.current;
      if (!isAppend) {
        setLoading(true);
        setError(null);
        setAllItems([]);
        setListTotal(null);
        setHasMoreRemote(false);
        if (poseFiltersActive) setPoseFacets(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const page = await api.fetchCatalog({
          kind: catalogKind,
          gender: gender === "all" ? null : gender,
          keyword,
          limit: GALD_PAGE_SIZE,
          offset: isAppend ? allItemsLenRef.current : 0,
          platformOnly,
          projectId: undefined,
          mediaFilter: poseFiltersActive ? poseMediaFilter : "all",
          poseCategory:
            poseFiltersActive && poseCategory !== "all" ? poseCategory : null,
        });
        if (gen !== fetchGenRef.current) return;
        setAllItems((prev) => (isAppend ? [...prev, ...page.items] : page.items));
        setCounts((c) => ({ ...c, ...(page.counts ?? {}) }));
        setListTotal(page.total ?? null);
        setHasMoreRemote(page.hasMore === true);
        if (poseFiltersActive && page.facets) setPoseFacets(page.facets);
      } catch (e) {
        if (gen !== fetchGenRef.current) return;
        if (!isAppend) {
          setError(e instanceof Error ? e.message : "加载失败");
          setAllItems([]);
        }
      } finally {
        if (gen === fetchGenRef.current) {
          if (isAppend) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [
      api,
      catalogKind,
      gender,
      keyword,
      platformOnly,
      poseCategory,
      poseFiltersActive,
      poseMediaFilter,
    ],
  );

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const { promptItems, imageItems } = useMemo(() => {
    const prompt: GlobalAssetPickItem[] = [];
    const image: GlobalAssetPickItem[] = [];
    for (const item of allItems) {
      if (platformCatalogPromptFirst(item)) prompt.push(item);
      else image.push(item);
    }
    return { promptItems: prompt, imageItems: image };
  }, [allItems]);

  const hasMore = hasMoreRemote;

  useEffect(() => {
    const root = scrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void fetchCatalog(true);
        }
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchCatalog]);

  const selectedItems = useMemo(
    () =>
      selected
        .map((id) => allItems.find((i) => i.id === id))
        .filter(Boolean) as GlobalAssetPickItem[],
    [selected, allItems],
  );

  function toggle(id: string) {
    if (!pickMode) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelect) return prev;
      return [...prev, id];
    });
  }

  async function confirmPick() {
    if (!onPick || selectedItems.length === 0) return;
    setConfirming(true);
    try {
      await onPick(selectedItems);
    } finally {
      setConfirming(false);
    }
  }

  const copyPrompt = useCallback(
    async (item: GlobalAssetPickItem) => {
      const text = globalAssetCatalogCopyPromptText(item);
      try {
        await navigator.clipboard.writeText(text);
        await alert({
          variant: "success",
          title: "已复制提示词",
          message: `「${item.title}」已写入剪贴板。`,
        });
      } catch {
        await alert({
          variant: "error",
          title: "复制失败",
          message: "请手动选中卡片内文案复制。",
        });
      }
    },
    [alert],
  );

  const handlePreview = useCallback(
    (item: GlobalAssetPickItem) => {
      const url = platformCatalogPreviewUrl(item);
      if (!url) return;
      onPreview?.(item);
    },
    [onPreview],
  );

  const handleInsert = useCallback(
    (item: GlobalAssetPickItem) => {
      if (platformCatalogPromptFirst(item)) return;
      onInsert?.(item);
    },
    [onInsert],
  );

  function renderItem(item: GlobalAssetPickItem, layout: "prompt" | "image") {
    const active = selected.includes(item.id);
    const selectIndex = active ? selected.indexOf(item.id) + 1 : undefined;
    const common = {
      item,
      active,
      selectIndex,
      pickMode,
      onSelect: () => toggle(item.id),
      onCopyPrompt: () => void copyPrompt(item),
    };

    if (layout === "prompt") {
      return <PlatformCatalogPromptCard {...common} />;
    }
    return (
      <PlatformCatalogImageTile
        {...common}
        onPreview={() => handlePreview(item)}
        onInsert={() => handleInsert(item)}
      />
    );
  }

  const scopeLabel = platformOnly ? "平台官方" : "我的共用";
  const intro =
    catalogNav === "fixed-kind"
      ? `${scopeLabel} · ${platformCatalogSaveTypeLabel(fixedKind)}`
      : catalogNav === "catalog-pick"
        ? `${scopeLabel} catalog · 类型与「保存平台资产库」一致`
        : `${scopeLabel}模特与素材 · 姿势 / 头像 / 全身（服装见同级「服装」）`;

  const totalLabel = listTotal ?? allItems.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-[11px] text-white/45">{intro}</p>

      <div className="flex flex-wrap items-center gap-2">
        {navItems.map((nav) => {
          const active = catalogKind === nav.id;
          const count = counts[nav.id];
          return (
            <button
              key={nav.id}
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-white/55 hover:bg-white/5 hover:text-white/85",
              )}
              onClick={() => {
                setCatalogKind(nav.id);
                setSelected([]);
              }}
            >
              {nav.label}
              {typeof count === "number" ? (
                <span className="ml-1 text-[10px] tabular-nums opacity-70">{count}</span>
              ) : hubKindIds.length > 0 ? (
                <span className="ml-1 text-[10px] opacity-40">…</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {poseFiltersActive ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
            value={poseMediaFilter}
            onChange={(e) => {
              setPoseMediaFilter(e.target.value as GlobalAssetCatalogMediaFilter);
              setSelected([]);
            }}
            aria-label="姿势内容类型"
          >
            <option value="all">
              全部类型
              {poseFacets?.poseMedia
                ? `（${poseFacets.poseMedia.all}）`
                : typeof counts.pose === "number"
                  ? `（${counts.pose}）`
                  : ""}
            </option>
            <option value="prompt">
              仅提示词
              {poseFacets?.poseMedia ? `（${poseFacets.poseMedia.prompt}）` : ""}
            </option>
            <option value="image">
              有参考图
              {poseFacets?.poseMedia ? `（${poseFacets.poseMedia.image}）` : ""}
            </option>
          </select>
          <select
            className="min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
            value={poseCategory}
            onChange={(e) => {
              setPoseCategory(e.target.value);
              setSelected([]);
            }}
            aria-label="姿势分类"
          >
            <option value="all">全部分类</option>
            {(poseFacets?.poseCategories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}（{c.count}）
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          placeholder="搜索…"
          className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
        />
        {GENDER_FILTER_KINDS.has(catalogKind) ? (
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="all">全部性别</option>
            <option value="female">女</option>
            <option value="male">男</option>
          </select>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3"
      >
        {loading ? (
          <CanvasListGridSkeleton
            cards={12}
            gridClassName="columns-2 gap-3 sm:columns-3 md:columns-4 xl:columns-5 [column-fill:_balance]"
            className="[&>div]:mb-3 [&>div]:break-inside-avoid"
          />
        ) : error ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
              onClick={() => void fetchCatalog()}
            >
              重试
            </button>
          </div>
        ) : allItems.length === 0 ? (
          <p className="flex min-h-[240px] items-center justify-center text-center text-sm text-white/45">
            {keyword ? "无匹配素材" : platformOnly ? "暂无平台素材" : "暂无我的共用素材"}
          </p>
        ) : (
          <>
            {promptItems.length > 0 ? (
              <ul className="mb-3 grid auto-rows-min grid-cols-1 gap-2 sm:grid-cols-2">
                {promptItems.map((item) => (
                  <li key={`prompt-${item.catalogKind ?? "cat"}-${item.id}`}>
                    {renderItem(item, "prompt")}
                  </li>
                ))}
              </ul>
            ) : null}
            {imageItems.length > 0 ? (
              <ul className="columns-2 gap-3 sm:columns-3 md:columns-4 xl:columns-5 [column-fill:_balance]">
                {imageItems.map((item) => (
                  <li
                    key={`img-${item.catalogKind ?? "cat"}-${item.id}`}
                    className="mb-3 break-inside-avoid"
                  >
                    {renderItem(item, "image")}
                  </li>
                ))}
              </ul>
            ) : null}
            {hasMore ? (
              <div ref={loadMoreRef} className="py-3 text-center text-[10px] text-white/40">
                {loadingMore ? "加载中…" : "向下滚动加载更多"}
              </div>
            ) : (
              <p className="py-2 text-center text-[10px] text-white/40">共 {totalLabel} 项</p>
            )}
          </>
        )}
      </div>

      {pickMode ? (
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 pt-3">
          <p className="text-xs text-white/45">
            已选 {selected.length}/{maxSelect}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
              disabled={confirming || selectedItems.length === 0}
              onClick={() => void confirmPick()}
            >
              {confirming ? "处理中…" : "确认选用"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}