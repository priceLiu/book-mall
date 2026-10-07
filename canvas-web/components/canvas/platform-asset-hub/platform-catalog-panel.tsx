"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GlobalAssetTile } from "@/docker-shared/global-asset-library/global-asset-tile";
import { GALD_PAGE_SIZE } from "@/docker-shared/global-asset-library/theme";
import type {
  GlobalAssetCatalogKind,
  GlobalAssetLibraryApiClient,
  GlobalAssetPickItem,
} from "@/docker-shared/global-asset-library/types";
import { cn } from "@/lib/utils";

const CATALOG_NAV: Array<{ id: GlobalAssetCatalogKind; label: string }> = [
  { id: "full-body", label: "全身模特" },
  { id: "avatar", label: "模特头像" },
  { id: "garment", label: "服装库" },
  { id: "pose", label: "姿势库" },
];

export type PlatformCatalogPanelProps = {
  api: GlobalAssetLibraryApiClient;
  previewLightboxZIndex?: number;
  maxSelect?: number;
  onPick?: (items: GlobalAssetPickItem[]) => void | Promise<void>;
  onCancel?: () => void;
};

export function PlatformCatalogPanel({
  api,
  previewLightboxZIndex = 2100,
  maxSelect = 9,
  onPick,
  onCancel,
}: PlatformCatalogPanelProps) {
  const pickMode = Boolean(onPick);
  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>("garment");
  const [gender, setGender] = useState("all");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [allItems, setAllItems] = useState<GlobalAssetPickItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(GALD_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [keywordInput]);

  const fetchCatalog = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    setAllItems([]);
    setVisibleCount(GALD_PAGE_SIZE);
    try {
      const page = await api.fetchCatalog({
        kind: catalogKind,
        gender: gender === "all" ? null : gender,
        keyword,
        limit: 240,
        platformOnly: true,
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
  }, [api, catalogKind, gender, keyword]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const visibleItems = useMemo(
    () => allItems.slice(0, visibleCount),
    [allItems, visibleCount],
  );
  const hasMore = visibleCount < allItems.length;

  useEffect(() => {
    const root = scrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(n + GALD_PAGE_SIZE, allItems.length));
        }
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, allItems.length]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-[11px] text-white/45">
        平台官方模特与素材 · 选用后插入画布（仅 platform 库，不含个人 catalog）
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {CATALOG_NAV.map((nav) => {
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
                <span className="ml-1 text-[10px] opacity-70">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          placeholder="搜索…"
          className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
        />
        <select
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        >
          <option value="all">全部性别</option>
          <option value="female">女</option>
          <option value="male">男</option>
        </select>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3"
      >
        {loading ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-white/50">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">正在加载…</span>
          </div>
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
            {keyword ? "无匹配素材" : "暂无平台素材"}
          </p>
        ) : (
          <>
            <ul className="columns-2 gap-3 sm:columns-3 md:columns-4 xl:columns-5 [column-fill:_balance]">
              {visibleItems.map((item) => {
                const active = selected.includes(item.id);
                return (
                  <li
                    key={`${item.catalogKind ?? "cat"}-${item.id}`}
                    className="mb-3 break-inside-avoid"
                  >
                    <GlobalAssetTile
                      item={item}
                      variant="dark"
                      layout="fluid"
                      active={active}
                      selectIndex={active ? selected.indexOf(item.id) + 1 : undefined}
                      scopeText=""
                      disabled={!pickMode}
                      previewLightboxZIndex={previewLightboxZIndex}
                      onSelect={() => toggle(item.id)}
                    />
                  </li>
                );
              })}
            </ul>
            {hasMore ? (
              <div ref={loadMoreRef} className="py-3 text-center text-[10px] text-white/40">
                向下滚动加载更多
              </div>
            ) : (
              <p className="py-2 text-center text-[10px] text-white/40">
                共 {allItems.length} 项
              </p>
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
