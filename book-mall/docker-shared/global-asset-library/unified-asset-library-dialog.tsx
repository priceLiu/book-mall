"use client";

import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GlobalAssetTile } from "./global-asset-tile";
import { PLATFORM_CATALOG_SAVE_TYPE_OPTIONS } from "./platform-catalog-save-types";
import {
  GALD_BODY_CLASS,
  GALD_CLOSE_BTN_CLASS,
  GALD_DIALOG_SHELL_CLASS,
  GALD_MASONRY_CLASS,
  GALD_MASONRY_ITEM_CLASS,
  GALD_PAGE_SIZE,
  globalAssetTheme,
} from "./theme";
import type { GlobalAssetCatalogKind, GlobalAssetLibraryVariant } from "./types";
import { sectionLabel } from "./open-asset-library-utils";
import type {
  AssetLibrarySection,
  OpenAssetLibraryOptions,
  UnifiedAssetLibraryApiClient,
  UnifiedAssetPickItem,
} from "./unified-asset-library-types";
import { catalogItemToUnified, unifiedToGlobalPickItem } from "./unified-asset-library-types";

type Props = {
  open: boolean;
  variant: GlobalAssetLibraryVariant;
  api: UnifiedAssetLibraryApiClient;
  options: OpenAssetLibraryOptions;
  onClose: () => void;
};

const SECTIONS: AssetLibrarySection[] = ["platform", "shared", "project"];

function scopeText(item: UnifiedAssetPickItem): string {
  if (item.section === "platform") return "平台";
  if (item.section === "project") return "本项目";
  if (item.scope === "team") return "团队";
  return "我的";
}

export function UnifiedAssetLibraryDialog({ open, variant, api, options, onClose }: Props) {
  const theme = globalAssetTheme(variant);
  const maxSelect = Math.max(1, options.maxSelect ?? 1);
  const title = options.title ?? "资产库";

  const [section, setSection] = useState<AssetLibrarySection>(
    options.defaultSection ?? "shared",
  );
  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>(
    options.defaultCatalog ?? "reference",
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [allItems, setAllItems] = useState<UnifiedAssetPickItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(GALD_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);
  const openInitRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [keywordInput]);

  useEffect(() => {
    if (!open) {
      openInitRef.current = false;
      return;
    }
    if (openInitRef.current) return;
    openInitRef.current = true;
    setSection(options.defaultSection ?? "shared");
    setCatalogKind(options.defaultCatalog ?? "reference");
    setSelected([]);
    setKeywordInput("");
    setKeyword("");
  }, [open, options.defaultSection, options.defaultCatalog]);

  const loadItems = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    setAllItems([]);
    setVisibleCount(GALD_PAGE_SIZE);
    try {
      let merged: UnifiedAssetPickItem[] = [];
      const kindFilter = options.allowedCatalogKinds;
      const kinds =
        section === "project"
          ? []
          : kindFilter?.length
            ? kindFilter
            : [catalogKind];

      if (section === "platform") {
        for (const k of kinds.length ? kinds : [catalogKind]) {
          const page = await api.fetchCatalog({
            kind: k,
            keyword,
            limit: 240,
            platformOnly: true,
            projectId: options.projectId ?? options.saveContext?.projectId,
            tenantId: options.saveContext?.tenantId,
          });
          if (gen !== fetchGenRef.current) return;
          merged.push(...page.items.map((i) => catalogItemToUnified(i, "platform")));
        }
      } else if (section === "shared") {
        for (const k of kinds.length ? kinds : [catalogKind]) {
          const page = await api.fetchCatalog({
            kind: k,
            keyword,
            limit: 240,
            projectId: options.projectId ?? options.saveContext?.projectId,
            tenantId: options.saveContext?.tenantId,
          });
          if (gen !== fetchGenRef.current) return;
          merged.push(
            ...page.items
              .filter((i) => (i.scope ?? "platform") !== "platform")
              .map((i) => catalogItemToUnified(i, "shared")),
          );
        }
        const works = await api.fetchWorks({
          keyword,
          kind: options.media === "video" ? "video" : "image",
          perSource: 24,
        });
        if (gen !== fetchGenRef.current) return;
        merged.push(
          ...works.items.map((i) => ({
            ...catalogItemToUnified(i, "shared"),
            provenance: "works" as const,
          })),
        );
      } else if (section === "project" && api.fetchProjectItems) {
        const page = await api.fetchProjectItems({
          projectId: options.projectId ?? options.saveContext?.projectId,
          ecomModule: options.ecomModule,
          ecomModules: options.ecomModules,
          keyword,
          media: options.media,
          limit: 240,
        });
        if (gen !== fetchGenRef.current) return;
        merged = page.items;
        if (options.allowedProjectKinds?.length) {
          merged = merged.filter((i) =>
            options.allowedProjectKinds!.includes(i.projectAssetKind ?? ""),
          );
        }
      }

      const seen = new Set<string>();
      merged = merged.filter((i) => {
        if (!i.ossUrl?.trim() && !i.promptOnly) return false;
        const key = `${i.provenance}:${i.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (gen !== fetchGenRef.current) return;
      setAllItems(merged);
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      setError(e instanceof Error ? e.message : "加载失败");
      setAllItems([]);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [
    api,
    catalogKind,
    keyword,
    options.allowedCatalogKinds,
    options.allowedProjectKinds,
    options.ecomModule,
    options.ecomModules,
    options.media,
    options.projectId,
    options.saveContext?.projectId,
    options.saveContext?.tenantId,
    section,
  ]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  const visibleItems = useMemo(
    () => allItems.slice(0, visibleCount),
    [allItems, visibleCount],
  );

  const selectedItems = useMemo(
    () => allItems.filter((i) => selected.includes(`${i.provenance}:${i.id}`)),
    [allItems, selected],
  );

  function itemKey(item: UnifiedAssetPickItem): string {
    return `${item.provenance}:${item.id}`;
  }

  function toggle(item: UnifiedAssetPickItem) {
    const key = itemKey(item);
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      if (prev.length >= maxSelect) return prev;
      return [...prev, key];
    });
  }

  async function confirmPick() {
    if (selectedItems.length === 0) return;
    setConfirming(true);
    try {
      const unifiedHandler = (options as OpenAssetLibraryOptions & {
        onPickUnified?: (items: UnifiedAssetPickItem[]) => void | Promise<void>;
      }).onPickUnified;
      if (unifiedHandler) {
        await unifiedHandler(selectedItems);
      } else if (options.onPick) {
        await options.onPick(selectedItems.map(unifiedToGlobalPickItem));
      }
      onClose();
    } finally {
      setConfirming(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  const showKindNav = section !== "project";

  return createPortal(
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
          <button
            type="button"
            className={`${GALD_CLOSE_BTN_CLASS} ${theme.btnSecondary}`}
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`flex shrink-0 items-center gap-2 border-b px-4 py-2 ${theme.filterBar}`}>
          <div className={`flex rounded-full p-0.5 ${theme.segmentedTrack}`}>
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  section === s ? theme.segmentedActive : theme.segmentedIdle
                }`}
                onClick={() => {
                  setSection(s);
                  setSelected([]);
                }}
              >
                {sectionLabel(s)}
              </button>
            ))}
          </div>
          <input
            className={`ml-auto max-w-[200px] flex-1 rounded-lg border px-2 py-1 text-xs ${theme.border} bg-transparent ${theme.textPrimary}`}
            placeholder="搜索"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
        </div>

        <div className={GALD_BODY_CLASS}>
          {showKindNav ? (
            <aside
              className={`hidden w-[140px] shrink-0 overflow-y-auto border-r p-2 sm:block ${theme.sidebar} ${theme.border}`}
            >
              {PLATFORM_CATALOG_SAVE_TYPE_OPTIONS.filter((o) => o.imageImport).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`mb-0.5 block w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                    catalogKind === opt.id ? theme.navActive : theme.navIdle
                  }`}
                  onClick={() => {
                    setCatalogKind(opt.id);
                    setSelected([]);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </aside>
          ) : null}

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className={`flex justify-center py-12 ${theme.textSecondary}`}>
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : error ? (
              <p className={`text-center text-xs ${theme.textSecondary}`}>{error}</p>
            ) : visibleItems.length === 0 ? (
              <p className={`text-center text-xs ${theme.textSecondary}`}>暂无条目</p>
            ) : (
              <div className={GALD_MASONRY_CLASS}>
                {visibleItems.map((item) => {
                  const key = itemKey(item);
                  const globalItem = unifiedToGlobalPickItem(item);
                  return (
                    <div key={key} className={GALD_MASONRY_ITEM_CLASS}>
                      <GlobalAssetTile
                        item={globalItem}
                        variant={variant}
                        active={selected.includes(key)}
                        selectIndex={
                          selected.includes(key) ? selected.indexOf(key) + 1 : undefined
                        }
                        scopeText={scopeText(item)}
                        layout="fluid"
                        onSelect={() => toggle(item)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {visibleCount < allItems.length ? (
              <div className="py-4 text-center">
                <button
                  type="button"
                  className={`text-xs ${theme.textSecondary}`}
                  onClick={() => setVisibleCount((n) => n + GALD_PAGE_SIZE)}
                >
                  加载更多
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`flex shrink-0 items-center justify-between border-t px-4 py-2.5 ${theme.footer} ${theme.border}`}
        >
          <span className={`text-xs ${theme.textSecondary}`}>
            已选 {selected.length}/{maxSelect}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm ${theme.btnSecondary}`}
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              disabled={selected.length === 0 || confirming}
              className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${theme.btnPrimary}`}
              onClick={() => void confirmPick()}
            >
              {confirming ? "处理中…" : "确认选用"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
