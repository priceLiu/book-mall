"use client";

/**
 * 全局资产库浏览器（筛选 + 网格）
 *
 * 同一个组件服务两个入口：
 * - 「资产库」tab：宽屏三～五列，动作为 收进空间 / 移出空间 / 继续创作
 * - 作品墙编辑器素材抽屉的「全部资产」：窄栏两列，主动作为 放到画布
 *
 * 图片一律用 `thumbnailUrl` + `loading="lazy"`；视频只显示封面，
 * 不在列表里挂 `<video>`（约束见 .cursor/rules/ai-space-space-blocks.mdc §性能）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AiSpaceLibraryAsset } from "@/lib/ai-space/ai-space-asset-library";
import type {
  AiSpacePinMediaKind,
  AiSpacePinSourceType,
} from "@/lib/ai-space/ai-space-pin-types";
import { cn } from "@/lib/utils";

import {
  fetchLibraryAssets,
  type AiSpaceLibraryFilters,
  type AiSpaceLibrarySourceOption,
} from "./asset-library-client";

const KIND_FILTERS: { value: AiSpacePinMediaKind | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
];

const KIND_LABEL: Record<AiSpacePinMediaKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

const KEYWORD_DEBOUNCE_MS = 400;

export type AiSpaceLibraryState = {
  items: AiSpaceLibraryAsset[];
  loading: boolean;
  error: string | null;
  filters: AiSpaceLibraryFilters;
  sourceOptions: AiSpaceLibrarySourceOption[];
  sourceCounts: Record<string, number>;
  truncated: boolean;
  setFilters: (next: Partial<AiSpaceLibraryFilters>) => void;
  reload: () => void;
  /** 本地打补丁，避免收藏后整页重查 */
  patchItem: (key: string, patch: Partial<AiSpaceLibraryAsset>) => void;
};

/** 聚合读 + 筛选状态；关键词 debounce，避免每敲一个字扫 14 张表 */
export function useAssetLibrary(
  initial?: Partial<AiSpaceLibraryFilters>,
): AiSpaceLibraryState {
  const [filters, setFiltersState] = useState<AiSpaceLibraryFilters>({
    kind: initial?.kind ?? "all",
    sources: initial?.sources ?? [],
    keyword: initial?.keyword ?? "",
  });
  const [debouncedKeyword, setDebouncedKeyword] = useState(filters.keyword);
  const [items, setItems] = useState<AiSpaceLibraryAsset[]>([]);
  const [sourceOptions, setSourceOptions] = useState<AiSpaceLibrarySourceOption[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedKeyword(filters.keyword),
      KEYWORD_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [filters.keyword]);

  const sourcesKey = filters.sources.join(",");

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);

    fetchLibraryAssets(
      {
        kind: filters.kind,
        sources: sourcesKey ? (sourcesKey.split(",") as AiSpacePinSourceType[]) : [],
        keyword: debouncedKeyword,
      },
      ac.signal,
    )
      .then((page) => {
        if (ac.signal.aborted) return;
        setItems(page.items);
        setSourceOptions(page.sourceOptions);
        setSourceCounts(page.sourceCounts);
        setTruncated(page.truncatedSources.length > 0);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "读取资产库失败");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [filters.kind, sourcesKey, debouncedKeyword, reloadToken]);

  const setFilters = useCallback((next: Partial<AiSpaceLibraryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const patchItem = useCallback(
    (key: string, patch: Partial<AiSpaceLibraryAsset>) => {
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    },
    [],
  );

  return {
    items,
    loading,
    error,
    filters,
    sourceOptions,
    sourceCounts,
    truncated,
    setFilters,
    reload: () => setReloadToken((n) => n + 1),
    patchItem,
  };
}

export function AssetLibraryFilters({
  state,
  compact,
}: {
  state: AiSpaceLibraryState;
  compact?: boolean;
}) {
  const { filters, setFilters, sourceOptions, sourceCounts } = state;

  const visibleSources = useMemo(
    () =>
      sourceOptions.filter(
        (o) => filters.kind === "all" || o.kinds.includes(filters.kind),
      ),
    [sourceOptions, filters.kind],
  );

  const toggleSource = (sourceType: AiSpacePinSourceType) => {
    const has = filters.sources.includes(sourceType);
    setFilters({
      sources: has
        ? filters.sources.filter((s) => s !== sourceType)
        : [...filters.sources, sourceType],
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilters({ kind: f.value })}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                filters.kind === f.value
                  ? "bg-[#1f2328] text-white"
                  : "border border-[#d0d7de] text-[#656d76]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={filters.keyword}
          onChange={(e) => setFilters({ keyword: e.target.value })}
          placeholder="搜索标题或提示词"
          className={cn(
            "rounded border border-[#d0d7de] px-2 py-1 text-xs outline-none focus:border-[#1f2328]",
            compact ? "w-full" : "w-56",
          )}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilters({ sources: [] })}
          className={cn(
            "rounded px-2 py-0.5 text-[11px]",
            filters.sources.length === 0
              ? "bg-[#eaeef2] text-[#1f2328]"
              : "border border-[#d0d7de] text-[#656d76]",
          )}
        >
          所有来源
        </button>
        {visibleSources.map((o) => {
          const active = filters.sources.includes(o.sourceType);
          const count = sourceCounts[o.sourceType] ?? 0;
          return (
            <button
              key={o.sourceType}
              type="button"
              onClick={() => toggleSource(o.sourceType)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px]",
                active
                  ? "bg-[#1f2328] text-white"
                  : "border border-[#d0d7de] text-[#656d76]",
              )}
            >
              {o.label}
              {count > 0 ? ` ${count}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AssetLibraryGrid({
  state,
  columnsClassName,
  disabledKinds,
  busy,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  renderFooter,
}: {
  state: AiSpaceLibraryState;
  columnsClassName: string;
  /** 不可用的媒体形态（选中块不接受时置灰） */
  disabledKinds?: AiSpacePinMediaKind[] | null;
  busy?: boolean;
  primaryLabel: string;
  onPrimary: (asset: AiSpaceLibraryAsset) => void;
  secondaryLabel?: (asset: AiSpaceLibraryAsset) => string;
  onSecondary?: (asset: AiSpaceLibraryAsset) => void;
  renderFooter?: (asset: AiSpaceLibraryAsset) => React.ReactNode;
}) {
  const { items, loading, error, truncated } = state;

  if (loading && items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[#d0d7de] p-6 text-center text-xs text-[#656d76]">
        正在汇聚各应用的资产…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-md border border-[#d0d7de] bg-[#fff8f6] p-4 text-center text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[#d0d7de] p-6 text-center text-xs leading-relaxed text-[#656d76]">
        没有匹配的资产。在电商工具箱、AI 工具站、画布、影视项目里完成作品后会自动出现在这里。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className={cn("grid gap-2", columnsClassName)}>
        {items.map((asset) => {
          const usable = !disabledKinds || !disabledKinds.includes(asset.resolved.kind);
          return (
            <li
              key={asset.key}
              className={cn(
                "overflow-hidden rounded-md border",
                usable ? "border-[#d0d7de]" : "border-[#eaeef2] opacity-45",
              )}
            >
              <button
                type="button"
                disabled={busy || !usable}
                onClick={() => onPrimary(asset)}
                title={usable ? primaryLabel : `选中的块不接受${KIND_LABEL[asset.resolved.kind]}素材`}
                className="block w-full text-left"
              >
                <div className="relative aspect-square bg-[#f6f8fa]">
                  {asset.resolved.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.resolved.thumbnailUrl}
                      alt={asset.resolved.title ?? "资产"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-[#8c959f]">
                      {KIND_LABEL[asset.resolved.kind]}
                    </div>
                  )}
                  {asset.resolved.kind !== "image" ? (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                      {KIND_LABEL[asset.resolved.kind]}
                    </span>
                  ) : null}
                  {asset.pinned ? (
                    <span className="absolute right-1 top-1 rounded bg-[#1f2328]/80 px-1 py-0.5 text-[10px] text-white">
                      已收进
                    </span>
                  ) : null}
                  {asset.blockRefCount > 0 ? (
                    <span className="absolute bottom-1 right-1 rounded bg-white/85 px-1 py-0.5 text-[10px] text-[#1f2328]">
                      画布 {asset.blockRefCount}
                    </span>
                  ) : null}
                </div>
                <div className="px-1.5 py-1">
                  <p className="truncate text-[11px] text-[#1f2328]">
                    {asset.resolved.title ?? asset.resolved.prompt ?? "未命名"}
                  </p>
                  <p className="truncate text-[10px] text-[#8c959f]">
                    {asset.sourceLabel}
                    {asset.resolved.moduleLabel ? ` · ${asset.resolved.moduleLabel}` : ""}
                  </p>
                </div>
              </button>

              {onSecondary && secondaryLabel ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSecondary(asset)}
                  className="w-full border-t border-[#eaeef2] py-1 text-[10px] text-[#656d76] hover:text-[#1f2328]"
                >
                  {secondaryLabel(asset)}
                </button>
              ) : null}
              {renderFooter?.(asset)}
            </li>
          );
        })}
      </ul>

      {truncated ? (
        <p className="text-[11px] text-[#8c959f]">
          每个来源只显示最近若干条。用来源筛选或关键词可以找到更早的资产。
        </p>
      ) : null}
    </div>
  );
}
