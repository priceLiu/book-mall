"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clapperboard,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
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
import {
  CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS,
  CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
  canvasToolbarSidePanelAsideClass,
} from "@/lib/canvas/canvas-toolbar-side-panel";
import {
  CANVAS_PANEL_HEADER_BORDER_CLASS,
  CANVAS_PANEL_HEADER_ICON_CLASS,
  CANVAS_PANEL_ITEM_META_CLASS,
  CANVAS_PANEL_TAB_ACTIVE_CLASS,
  CANVAS_PANEL_TAB_IDLE_CLASS,
  CANVAS_PANEL_TITLE_CLASS,
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
          : "border-white/10 bg-white/[0.03]",
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
          className="shrink-0 rounded-md border border-white/10 p-1.5 text-white/60 hover:border-white/25 hover:text-white"
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

  const loadFirst = useCallback(async () => {
    if (!base) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    setItems([]);
    cursorRef.current = null;
    hasMoreRef.current = false;
    try {
      const page = await fetchPage(null);
      if (seq !== loadSeqRef.current) return;
      setItems(page.items);
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
      cursorRef.current = page.nextCursor;
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(
        e instanceof Error ? formatCanvasApiError(e.message) : "加载提示词失败",
      );
      setItems([]);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [base, fetchPage]);

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

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div
      className={`${CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS} z-[60]`}
      onClick={onClose}
      role="presentation"
    >
      <aside
        className={canvasToolbarSidePanelAsideClass(
          `border-l ${CANVAS_PANEL_HEADER_BORDER_CLASS}`,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="我的提示词"
      >
        <header
          className={cn(
            "border-b px-4 py-3",
            CANVAS_PANEL_HEADER_BORDER_CLASS,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className={CANVAS_PANEL_HEADER_ICON_CLASS} />
              <p className={CANVAS_PANEL_TITLE_CLASS}>我的提示词</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-white/50">
            已提交的提示词自动归档 · 按类型与成败分类
          </p>
          <div className="mt-3 flex gap-1">
            <button
              type="button"
              onClick={() => setScope("project")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px]",
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
                "rounded-md px-2.5 py-1 text-[11px]",
                scope === "mine"
                  ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                  : CANVAS_PANEL_TAB_IDLE_CLASS,
              )}
            >
              我的全部
            </button>
          </div>
        </header>

        <div className="border-b border-white/10 px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {MEDIA_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMediaKind(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px]",
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
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => setOutcome("success")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px]",
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
                "rounded-md px-2.5 py-1 text-[11px]",
                outcome === "failed"
                  ? "bg-red-500/20 text-red-100"
                  : "text-white/55 hover:bg-white/5",
              )}
            >
              失败
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50">
              <Loader2 className={cn("size-4 animate-spin", CANVAS_SEMANTIC_STATUS_CLASS)} />
              加载中…
            </div>
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
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-white/45">
                  <Loader2 className="size-3.5 animate-spin" />
                  加载更多…
                </div>
              ) : null}
              <div ref={loadMoreSentinelRef} className="h-1" aria-hidden />
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 px-4 py-2 text-[10px] text-white/40">
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
      </aside>
    </div>
  );
}
