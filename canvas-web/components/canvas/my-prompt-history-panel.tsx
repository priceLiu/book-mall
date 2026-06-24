"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clapperboard,
  Copy,
  FileText,
  Image as ImageIcon,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  formatCanvasApiError,
  listProjectPromptHistory,
  listUserPromptHistory,
  type CanvasPromptHistoryItem,
} from "@/lib/canvas-api";
import { CanvasPanelShellLoading, CanvasPanelShellLoadingMore } from "@/components/canvas/canvas-panel-shell-loading";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
import {
  CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
} from "@/lib/canvas/canvas-toolbar-side-panel";
import {
  fetchToolbarPanelWithSwr,
  invalidateToolbarPanelCache,
  peekToolbarPanelCache,
  toolbarPanelCacheKey,
} from "@/lib/canvas/toolbar-panel-cache";
import {
  PROMPT_HISTORY_CACHE_PREFIX,
  subscribeCanvasPromptHistoryChanged,
} from "@/lib/canvas/canvas-panel-sync-events";
import {
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_ERROR_CLASS,
  CANVAS_PANEL_SHELL_FOOTER_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
  CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
  CANVAS_PANEL_SHELL_TABS_ROW_CLASS,
  CANVAS_PANEL_ITEM_CARD_CLASS,
  CANVAS_PANEL_ITEM_META_CLASS,
  CANVAS_PANEL_TAB_ACTIVE_CLASS,
  CANVAS_PANEL_TAB_IDLE_CLASS,
  CANVAS_SEMANTIC_ERROR_CLASS,
  CANVAS_SEMANTIC_STATUS_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import { usePanelInfiniteScroll } from "@/lib/canvas/use-panel-infinite-scroll";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/canvas/store";

type MediaTab = CanvasPromptHistoryItem["mediaKind"];
type OutcomeTab = "success" | "failed";
type ScopeTab = "project" | "mine";

const MEDIA_TABS: { id: MediaTab; label: string; icon: typeof FileText }[] = [
  { id: "TEXT", label: "文字", icon: FileText },
  { id: "IMAGE", label: "图片", icon: ImageIcon },
  { id: "VIDEO", label: "视频", icon: Clapperboard },
];

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function PromptRow({
  item,
  showProject,
  onCopy,
}: {
  item: CanvasPromptHistoryItem;
  showProject: boolean;
  onCopy: (text: string) => void;
}) {
  const failed = item.status === "FAILED";
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        failed
          ? "border-red-400/25 bg-red-500/5"
          : "border-white/10 bg-black/25",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {failed ? (
              <span className={cn("inline-flex items-center gap-1", CANVAS_SEMANTIC_ERROR_CLASS)}>
                <XCircle className="size-3" />
                失败
              </span>
            ) : (
              <span className={cn("inline-flex items-center gap-1", CANVAS_SEMANTIC_STATUS_CLASS)}>
                <CheckCircle2 className="size-3" />
                成功
              </span>
            )}
            <span className="text-white/45">
              {item.providerLabel} · {item.modelLabel}
            </span>
            <span className="text-white/35">{formatWhen(item.createdAt)}</span>
          </div>
          {showProject && item.projectName ? (
            <p className={cn("mt-1 text-[10px]", CANVAS_PANEL_ITEM_META_CLASS)}>
              {item.projectName}
            </p>
          ) : null}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
            {item.promptText}
          </p>
          {failed && item.failMessage ? (
            <p className="mt-1.5 text-xs leading-relaxed text-red-200/80">
              {item.failMessage.slice(0, 240)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onCopy(item.promptText)}
          className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-black/25 hover:text-white"
          title="复制提示词"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MyPromptHistoryPanel({
  open,
  onClose,
  projectId,
  initialScope = "project",
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  initialScope?: ScopeTab;
}) {
  const base = useBookMallBaseUrl();
  const storeProjectId = useCanvasStore((s) => s.projectId);
  const effectiveProjectId = projectId || storeProjectId;

  const [scope, setScope] = useState<ScopeTab>(initialScope);
  const [mediaKind, setMediaKind] = useState<MediaTab>("TEXT");
  const [outcome, setOutcome] = useState<OutcomeTab>("success");
  const [items, setItems] = useState<CanvasPromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const loadSeqRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      const filters = {
        mediaKind,
        outcome,
        limit: CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
        cursor,
      };
      return scope === "project" && effectiveProjectId
        ? listProjectPromptHistory(base!, effectiveProjectId, filters)
        : listUserPromptHistory(base!, filters);
    },
    [base, effectiveProjectId, mediaKind, outcome, scope],
  );

  const loadFirst = useCallback(async (opts?: { force?: boolean }) => {
    if (!base) return;
    const cacheKey = toolbarPanelCacheKey("prompt-history", {
      scope,
      projectId: effectiveProjectId ?? "",
      mediaKind,
      outcome,
    });
    const seq = ++loadSeqRef.current;
    if (!opts?.force) {
      setLoading(true);
      setError(null);
    }
    await fetchToolbarPanelWithSwr({
      cacheKey,
      force: opts?.force,
      seq,
      isStale: (s) => s !== loadSeqRef.current,
      fetch: async () => {
        const page = await fetchPage(null);
        return {
          items: page.items,
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        };
      },
      onLoading: (loading) => {
        if (seq !== loadSeqRef.current) return;
        setLoading(loading);
      },
      onData: (cached, meta) => {
        if (seq !== loadSeqRef.current) return;
        setItems(cached.items);
        setHasMore(cached.hasMore);
        hasMoreRef.current = cached.hasMore;
        cursorRef.current = cached.nextCursor;
        if (!meta.fromCache) setError(null);
      },
      onError: (e) => {
        if (seq !== loadSeqRef.current) return;
        if (e == null) return;
        setError(
          e instanceof Error ? formatCanvasApiError(e.message) : "加载提示词失败",
        );
        if (!peekToolbarPanelCache(cacheKey)) setItems([]);
      },
    });
  }, [base, effectiveProjectId, fetchPage, mediaKind, outcome, scope]);

  const loadMore = useCallback(async () => {
    if (!base || !hasMoreRef.current || !cursorRef.current || loadingMore) return;
    const seq = ++loadSeqRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursorRef.current);
      if (seq !== loadSeqRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const merged = [...prev];
        for (const row of page.items) {
          if (!seen.has(row.id)) merged.push(row);
        }
        return merged;
      });
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
      cursorRef.current = page.nextCursor;
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(
        e instanceof Error ? formatCanvasApiError(e.message) : "加载更多失败",
      );
    } finally {
      if (seq === loadSeqRef.current) setLoadingMore(false);
    }
  }, [base, fetchPage, loadingMore]);

  const loadMoreSentinelRef = usePanelInfiniteScroll({
    enabled: open,
    hasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
  });

  useEffect(() => {
    if (!open) return;
    setScope(initialScope);
  }, [open, initialScope]);

  useEffect(() => {
    if (!open) return;
    void loadFirst();
  }, [open, loadFirst]);

  useEffect(() => {
    return subscribeCanvasPromptHistoryChanged((detail) => {
      if (scope === "project" && detail.projectId !== effectiveProjectId) return;
      invalidateToolbarPanelCache(PROMPT_HISTORY_CACHE_PREFIX);
      if (openRef.current) void loadFirst({ force: true });
    });
  }, [effectiveProjectId, loadFirst, scope]);

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <CanvasToolbarSidePanelShell
      open={open}
      onClose={onClose}
      ariaLabel="我的提示词"
    >
        <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            <div>
              <p className="text-sm font-medium">我的提示词</p>
              <p className="text-[10px] text-white/45">
                已提交的提示词自动归档 · 按类型与成败分类
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className={CANVAS_PANEL_SHELL_TABS_ROW_CLASS}>
          <button
            type="button"
            onClick={() => setScope("project")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px]",
              scope === "project"
                ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                : CANVAS_PANEL_TAB_IDLE_CLASS,
            )}
          >
            本项目
          </button>
          <button
            type="button"
            onClick={() => setScope("mine")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px]",
              scope === "mine"
                ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                : CANVAS_PANEL_TAB_IDLE_CLASS,
            )}
          >
            我的全部
          </button>
        </div>

        <div className={cn(CANVAS_PANEL_SHELL_TABS_ROW_CLASS, "flex-col gap-2 border-t-0 pt-0")}>
          <div className="flex flex-wrap gap-1">
            {MEDIA_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMediaKind(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px]",
                    mediaKind === tab.id
                      ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                      : CANVAS_PANEL_TAB_IDLE_CLASS,
                  )}
                >
                  <Icon className="size-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setOutcome("success")}
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1.5 text-[11px]",
                outcome === "success"
                  ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                  : CANVAS_PANEL_TAB_IDLE_CLASS,
              )}
            >
              成功
            </button>
            <button
              type="button"
              onClick={() => setOutcome("failed")}
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1.5 text-[11px]",
                outcome === "failed"
                  ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                  : CANVAS_PANEL_TAB_IDLE_CLASS,
              )}
            >
              失败
            </button>
          </div>
        </div>

        <div className={CANVAS_PANEL_SHELL_BODY_CLASS}>
          {error ? (
            <p className={CANVAS_PANEL_SHELL_ERROR_CLASS}>{error}</p>
          ) : loading ? (
            <CanvasPanelShellLoading />
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/45">
              当前分类下暂无提示词记录
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <PromptRow
                  key={item.id}
                  item={item}
                  showProject={scope === "mine"}
                  onCopy={copyPrompt}
                />
              ))}
              {loadingMore ? <CanvasPanelShellLoadingMore /> : null}
              <div ref={loadMoreSentinelRef} className="h-1" aria-hidden />
            </div>
          )}
        </div>

        <footer className={cn(CANVAS_PANEL_SHELL_FOOTER_CLASS, "text-[10px] text-white/40")}>
          提示词在每次点击生成时自动保存；成功与失败分别归档。
          {scope === "project" && effectiveProjectId ? (
            <Link
              href={`/canvas/${effectiveProjectId}`}
              className="ml-1 text-white/75 hover:underline"
              onClick={onClose}
            >
              回到画布
            </Link>
          ) : null}
        </footer>
    </CanvasToolbarSidePanelShell>
  );
}
