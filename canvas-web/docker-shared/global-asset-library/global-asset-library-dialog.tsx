"use client";

import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SaveToCatalogDialog } from "./save-to-catalog-dialog";
import { GlobalAssetTile } from "./global-asset-tile";
import {
  GALD_BODY_CLASS,
  GALD_CLOSE_BTN_CLASS,
  GALD_DIALOG_SHELL_CLASS,
  GALD_GRID_CLASS,
  GALD_PAGE_SIZE,
  globalAssetTheme,
} from "./theme";
import type {
  GlobalAssetCatalogKind,
  GlobalAssetLibraryApiClient,
  GlobalAssetLibraryMode,
  GlobalAssetLibraryTab,
  GlobalAssetLibraryVariant,
  GlobalAssetPickItem,
  GlobalAssetSourceImage,
  OpenGlobalAssetLibraryOptions,
} from "./types";

const CATALOG_NAV: Array<{ id: GlobalAssetCatalogKind; label: string }> = [
  { id: "full-body", label: "全身模特" },
  { id: "avatar", label: "模特头像" },
  { id: "garment", label: "服装库" },
  { id: "pose", label: "姿势库" },
];

type Props = {
  open: boolean;
  variant: GlobalAssetLibraryVariant;
  api: GlobalAssetLibraryApiClient;
  options: OpenGlobalAssetLibraryOptions;
  onClose: () => void;
};

function scopeLabel(scope?: string): string {
  if (scope === "platform") return "平台";
  if (scope === "team") return "团队";
  return "我的";
}

export function GlobalAssetLibraryDialog({
  open,
  variant,
  api,
  options,
  onClose,
}: Props) {
  const theme = globalAssetTheme(variant);
  const mode: GlobalAssetLibraryMode = options.mode ?? "pick";
  const maxSelect = Math.max(1, options.maxSelect ?? 1);

  const [tab, setTab] = useState<GlobalAssetLibraryTab>(options.defaultTab ?? "catalog");
  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>(
    options.defaultCatalog ?? "garment",
  );
  const [gender, setGender] = useState<string>("all");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [allItems, setAllItems] = useState<GlobalAssetPickItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(GALD_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);
  const openInitializedRef = useRef(false);
  const allItemsLenRef = useRef(0);
  allItemsLenRef.current = allItems.length;

  const sourceImage: GlobalAssetSourceImage | undefined = options.sourceImage;
  const isSaveOnlyFlow = mode === "save" && Boolean(sourceImage?.url);
  const showPicker = open && !isSaveOnlyFlow && !saveOpen;

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const fetchCatalog = useCallback(
    async (kind: GlobalAssetCatalogKind) => {
      const gen = ++fetchGenRef.current;
      setLoading(true);
      setError(null);
      setAllItems([]);
      setVisibleCount(GALD_PAGE_SIZE);
      try {
        const page = await api.fetchCatalog({
          kind,
          gender: gender === "all" ? null : gender,
          keyword,
          limit: 240,
        });
        if (gen !== fetchGenRef.current) return;
        setAllItems(page.items);
        setCounts(page.counts ?? {});
      } catch (e) {
        if (gen !== fetchGenRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
        setAllItems([]);
      } finally {
        if (gen === fetchGenRef.current) setLoading(false);
      }
    },
    [api, gender, keyword],
  );

  const fetchWorks = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    setAllItems([]);
    setVisibleCount(GALD_PAGE_SIZE);
    try {
      const page = await api.fetchWorks({
        kind: options.media === "video" ? "video" : "image",
        keyword,
        perSource: 24,
      });
      if (gen !== fetchGenRef.current) return;
      setAllItems(page.items);
      setCounts({});
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      setError(e instanceof Error ? e.message : "加载失败");
      setAllItems([]);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [api, keyword, options.media]);

  useEffect(() => {
    if (!open) {
      openInitializedRef.current = false;
      return;
    }
    if (openInitializedRef.current) return;
    openInitializedRef.current = true;
    setTab(options.defaultTab ?? "catalog");
    const initialKind = options.defaultCatalog ?? "garment";
    setCatalogKind(initialKind);
    setSelected([]);
    setKeywordInput("");
    setKeyword("");
    if (mode === "save" && sourceImage?.url) {
      setSaveOpen(true);
    }
  }, [open, options.defaultTab, options.defaultCatalog, mode, sourceImage?.url]);

  useEffect(() => {
    if (!showPicker) return;
    if (tab === "catalog") {
      void fetchCatalog(catalogKind);
    } else {
      void fetchWorks();
    }
  }, [showPicker, tab, catalogKind, gender, keyword, fetchCatalog, fetchWorks]);

  const handleCatalogNavClick = useCallback((kind: GlobalAssetCatalogKind) => {
    if (kind === catalogKind) return;
    setCatalogKind(kind);
    setSelected([]);
  }, [catalogKind]);

  const visibleItems = useMemo(
    () => allItems.slice(0, visibleCount),
    [allItems, visibleCount],
  );

  const hasMore = visibleCount < allItems.length;

  const revealMoreItems = useCallback(() => {
    setVisibleCount((n) => {
      const total = allItemsLenRef.current;
      if (n >= total) return n;
      return Math.min(n + GALD_PAGE_SIZE, total);
    });
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          revealMoreItems();
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [allItems.length, hasMore, loading, revealMoreItems]);

  useEffect(() => {
    if (loading || !showPicker || visibleCount >= allItems.length) return;
    const root = scrollRef.current;
    if (!root) return;

    let raf = 0;
    const fillViewport = () => {
      if (visibleCount >= allItemsLenRef.current) return;
      if (root.scrollHeight <= root.clientHeight + 8) {
        revealMoreItems();
        raf = window.requestAnimationFrame(fillViewport);
      }
    };
    raf = window.requestAnimationFrame(fillViewport);
    return () => window.cancelAnimationFrame(raf);
  }, [loading, showPicker, allItems.length, visibleCount, revealMoreItems]);

  const selectedItems = useMemo(
    () => allItems.filter((i) => selected.includes(i.id)),
    [allItems, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelect) return prev;
      return [...prev, id];
    });
  }

  async function confirmPick() {
    if (selectedItems.length === 0 || !options.onPick) return;
    setConfirming(true);
    try {
      await options.onPick(selectedItems);
      onClose();
    } finally {
      setConfirming(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  const title = options.title ?? "全局资产库";
  const activeCount = tab === "catalog" ? counts[catalogKind] : allItems.length;
  const saveDialogOpen = Boolean(sourceImage?.url) && (isSaveOnlyFlow || saveOpen);

  if (isSaveOnlyFlow && sourceImage?.url) {
    return (
      <SaveToCatalogDialog
        open
        variant={variant}
        api={api}
        sourceImage={sourceImage}
        defaultCatalog={options.defaultCatalog ?? "pose"}
        onClose={onClose}
        onSaved={() => {
          options.onCatalogSaved?.();
          onClose();
        }}
      />
    );
  }

  return (
    <>
      {showPicker
        ? createPortal(
        <div
          className={`fixed inset-0 z-[300] flex items-center justify-center p-4 ${theme.overlay}`}
          onClick={onClose}
        >
          <div
            className={`${GALD_DIALOG_SHELL_CLASS} ${theme.shell}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex shrink-0 items-center justify-between border-b px-4 py-2.5 ${theme.header}`}>
              <h2 className={`text-[14px] font-semibold ${theme.textPrimary}`}>{title}</h2>
              <div className="flex items-center gap-2">
                {sourceImage?.url && mode !== "browse" ? (
                  <button
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-xs ${theme.btnSecondary}`}
                    onClick={() => setSaveOpen(true)}
                  >
                    保存到库
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${GALD_CLOSE_BTN_CLASS} ${theme.btnSecondary}`}
                  aria-label="关闭"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={`flex shrink-0 items-center gap-2 border-b px-4 py-2 ${theme.filterBar}`}>
              <div className={`flex rounded-full p-0.5 ${theme.segmentedTrack}`}>
                {(["catalog", "works"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      tab === t ? theme.segmentedActive : theme.segmentedIdle
                    }`}
                    onClick={() => {
                      setTab(t);
                      setSelected([]);
                    }}
                  >
                    {t === "catalog" ? "平台素材" : "我的作品"}
                  </button>
                ))}
              </div>
              <input
                className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs ${theme.border} bg-transparent ${theme.textPrimary}`}
                placeholder="搜索…"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
              />
              {tab === "catalog" ? (
                <select
                  className={`rounded-lg border px-2 py-1 text-xs ${theme.border} bg-transparent ${theme.textPrimary}`}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="all">全部性别</option>
                  <option value="female">女</option>
                  <option value="male">男</option>
                </select>
              ) : null}
            </div>

            <div className={GALD_BODY_CLASS}>
              {tab === "catalog" ? (
                <nav className={`w-[148px] shrink-0 overflow-y-auto border-r p-1.5 ${theme.sidebar}`}>
                  {CATALOG_NAV.map((nav) => {
                    const count = counts[nav.id];
                    return (
                      <button
                        key={nav.id}
                        type="button"
                        className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          catalogKind === nav.id ? theme.navActive : theme.navIdle
                        }`}
                        onClick={() => handleCatalogNavClick(nav.id)}
                      >
                        <span>{nav.label}</span>
                        {typeof count === "number" ? (
                          <span className={`ml-1 text-[10px] ${theme.textSecondary}`}>{count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              ) : null}

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
                {loading ? (
                  <div className={`flex h-full min-h-[280px] flex-col items-center justify-center gap-2 ${theme.textSecondary}`}>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">正在加载…</span>
                  </div>
                ) : error ? (
                  <p className="flex min-h-[280px] items-center justify-center text-center text-sm text-red-600">
                    {error}
                  </p>
                ) : allItems.length === 0 ? (
                  <p className={`flex min-h-[280px] items-center justify-center text-center text-sm ${theme.textSecondary}`}>
                    {keyword ? "无匹配素材，请调整搜索或筛选" : "暂无素材"}
                  </p>
                ) : (
                  <>
                    <ul className={GALD_GRID_CLASS}>
                      {visibleItems.map((item) => {
                        const active = selected.includes(item.id);
                        return (
                          <li key={`${item.catalogKind ?? "works"}-${item.id}`}>
                            <GlobalAssetTile
                              item={item}
                              variant={variant}
                              active={active}
                              selectIndex={active ? selected.indexOf(item.id) + 1 : undefined}
                              scopeText={scopeLabel(item.scope)}
                              disabled={mode !== "pick"}
                              onSelect={() => mode === "pick" && toggle(item.id)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    {hasMore ? (
                      <div
                        ref={loadMoreRef}
                        className={`py-3 text-center text-[10px] ${theme.textSecondary}`}
                      >
                        向下滚动加载更多
                      </div>
                    ) : allItems.length > 0 ? (
                      <p className={`py-2 text-center text-[10px] ${theme.textSecondary}`}>
                        共 {allItems.length} 项
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {mode === "pick" ? (
              <div
                className={`flex shrink-0 items-center justify-between border-t px-4 py-2.5 ${theme.footer}`}
              >
                <p className={`text-xs ${theme.textSecondary}`}>
                  已选 {selected.length}/{maxSelect}
                  {selectedItems[0]?.title ? ` · ${selectedItems[0].title}` : ""}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-sm ${theme.btnSecondary}`}
                    onClick={onClose}
                  >
                    取消
                  </button>
                  <div className="flex items-center gap-1.5">
                    {selected.length > 0 ? (
                      <span
                        className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#22c55e] px-1.5 text-xs font-semibold text-white"
                        aria-label={`已选 ${selected.length} 项`}
                      >
                        {selected.length}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${theme.btnPrimary}`}
                      disabled={confirming || selectedItems.length === 0}
                      onClick={() => void confirmPick()}
                    >
                      {confirming ? "处理中…" : "确认选用"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
        )
        : null}

      {saveDialogOpen && sourceImage?.url ? (
        <SaveToCatalogDialog
          open
          variant={variant}
          api={api}
          sourceImage={sourceImage}
          defaultCatalog={options.defaultCatalog ?? "pose"}
          onClose={() => {
            setSaveOpen(false);
          }}
          onSaved={() => {
            options.onCatalogSaved?.();
            setSaveOpen(false);
            void fetchCatalog(catalogKind);
          }}
        />
      ) : null}
    </>
  );
}
