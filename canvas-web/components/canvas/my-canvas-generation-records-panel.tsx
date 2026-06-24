"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { GenerationRecordMediaPreview } from "@/components/canvas/generation-record-media-preview";
import {
  formatCanvasApiError,
  listCanvasGenerationRecords,
  type CanvasGenerationRecord,
} from "@/lib/canvas-api";
import {
  buildGenerationRecordCanvasHref,
  canRestoreGenerationRecordCanvas,
  fetchGenerationRecordCanvas,
  generationRecordDisplayTitle,
} from "@/lib/canvas/restore-generation-record";
import { CanvasPanelShellLoading, CanvasPanelShellLoadingMore } from "@/components/canvas/canvas-panel-shell-loading";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
import {
  CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
} from "@/lib/canvas/canvas-toolbar-side-panel";
import {
  fetchToolbarPanelWithSwr,
  invalidateToolbarPanelCache,
  toolbarPanelCacheKey,
} from "@/lib/canvas/toolbar-panel-cache";
import {
  GENERATION_RECORDS_CACHE_PREFIX,
  subscribeCanvasGenerationRecordsChanged,
} from "@/lib/canvas/canvas-panel-sync-events";
import {
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_EMPTY_CLASS,
  CANVAS_PANEL_SHELL_ERROR_CLASS,
  CANVAS_PANEL_SHELL_FOOTER_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
  CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
  CANVAS_PANEL_SHELL_TABS_ROW_CLASS,
  CANVAS_PANEL_SHELL_THUMB_SM_CLASS,
  CANVAS_PANEL_ITEM_CARD_CLASS,
  CANVAS_PANEL_TAB_ACTIVE_CLASS,
  CANVAS_PANEL_TAB_IDLE_CLASS,
  CANVAS_SEMANTIC_ERROR_CLASS,
  CANVAS_SEMANTIC_STATUS_CLASS,
  CANVAS_STATUS_CHIP_ERROR_CLASS,
  CANVAS_STATUS_CHIP_NEUTRAL_CLASS,
  CANVAS_STATUS_CHIP_RUNNING_CLASS,
  CANVAS_STATUS_CHIP_SUCCESS_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import { usePanelInfiniteScroll } from "@/lib/canvas/use-panel-infinite-scroll";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/canvas/store";
import { resolveGenerationRecordPreview } from "@/lib/canvas/generation-record-preview";
import {
  generationRecordNodePresentLabel,
  resolveGenerationRecordNodePresent,
} from "@/lib/canvas/generation-record-node-present";

type TabId = "project" | "today";

function statusLabel(status: CanvasGenerationRecord["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "成功";
    case "FAILED":
      return "失败";
    case "PENDING":
      return "排队中";
    case "SUBMITTED":
      return "生成中";
    case "CANCELLED":
      return "已取消";
    default:
      return status;
  }
}

function statusTone(status: CanvasGenerationRecord["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return CANVAS_STATUS_CHIP_SUCCESS_CLASS;
    case "FAILED":
      return CANVAS_STATUS_CHIP_ERROR_CLASS;
    case "PENDING":
    case "SUBMITTED":
      return CANVAS_STATUS_CHIP_RUNNING_CLASS;
    default:
      return CANVAS_STATUS_CHIP_NEUTRAL_CLASS;
  }
}

function formatFailMessage(raw: string | null | undefined): string {
  if (!raw?.trim()) return "生成失败";
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string };
    return j.error ?? j.message ?? raw.slice(0, 160);
  } catch {
    return raw.slice(0, 160);
  }
}

function RecordRow({
  item,
  showProject,
  currentProjectId,
  nodePresent,
  onLocate,
  onRestoreCanvas,
  restoring,
}: {
  item: CanvasGenerationRecord;
  showProject: boolean;
  currentProjectId: string;
  nodePresent: boolean | null;
  onLocate: (item: CanvasGenerationRecord) => void;
  onRestoreCanvas: (item: CanvasGenerationRecord) => void;
  restoring: boolean;
}) {
  const title = generationRecordDisplayTitle(item);
  const hasMedia = resolveGenerationRecordPreview(item).previewMedia.length > 0;
  const canRestoreCanvas = canRestoreGenerationRecordCanvas(item);
  const nodePresentLabel = generationRecordNodePresentLabel(
    nodePresent,
    canRestoreCanvas,
  );
  const targetProjectId = item.projectId ?? currentProjectId;
  const isOtherProject = Boolean(
    item.projectId && item.projectId !== currentProjectId,
  );

  return (
    <li className={CANVAS_PANEL_ITEM_CARD_CLASS}>
      <div className="flex items-start gap-3">
        {hasMedia ? (
          <GenerationRecordMediaPreview item={item} title={title} />
        ) : (
          <div className={CANVAS_PANEL_SHELL_THUMB_SM_CLASS}>
            {item.status === "FAILED" ? (
              <AlertCircle className="size-5 text-red-400/80" />
            ) : item.status === "SUCCEEDED" ? (
              <CheckCircle2 className={cn("size-5", CANVAS_SEMANTIC_STATUS_CLASS)} />
            ) : (
              <Loader2 className={cn("size-5 animate-spin", CANVAS_SEMANTIC_STATUS_CLASS)} />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] ${statusTone(item.status)}`}
            >
              {statusLabel(item.status)}
            </span>
            <span className="truncate text-[12px] font-medium text-white/90">
              {title}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/45">
            {new Date(item.createdAt).toLocaleString("zh-CN")}
            {showProject && item.projectName
              ? ` · ${item.projectName}`
              : ""}
            {item.nodeId ? ` · 节点 ${item.nodeId.slice(0, 8)}…` : ""}
          </p>
          {nodePresentLabel ? (
            <p
              className={`mt-1 text-[11px] ${
                nodePresent
                  ? CANVAS_SEMANTIC_STATUS_CLASS
                  : canRestoreCanvas
                    ? CANVAS_SEMANTIC_STATUS_CLASS
                    : "text-white/45"
              }`}
            >
              {nodePresentLabel}
            </p>
          ) : null}
          {item.status === "FAILED" ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-red-200/75">
              {formatFailMessage(item.failMessage)}
            </p>
          ) : item.textOutput?.trim() ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-white/55">
              {item.textOutput.trim().slice(0, 120)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.nodeId ? (
              <button
                type="button"
                onClick={() => onLocate(item)}
                className={cn(
                  "inline-flex items-center gap-1",
                  CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
                )}
              >
                {isOtherProject ? (
                  <ExternalLink className="size-3" />
                ) : (
                  <MapPin className="size-3" />
                )}
                定位节点
              </button>
            ) : null}
            {canRestoreCanvas ? (
              <button
                type="button"
                disabled={restoring}
                onClick={() => onRestoreCanvas(item)}
                className={cn(
                  "inline-flex items-center gap-1 disabled:opacity-50",
                  CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
                )}
              >
                {restoring ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                恢复画布
              </button>
            ) : (
              <span className="text-[10px] text-white/35">
                无画布快照（新发起的生成会自动保存）
              </span>
            )}
          </div>
          {isOtherProject && targetProjectId ? (
            <p className="mt-1 text-[10px] text-white/35">
              位于其他画布 ·{" "}
              <Link
                href={`/canvas/${targetProjectId}`}
                className="text-white/75 hover:underline"
              >
                打开画布
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function MyCanvasGenerationRecordsPanel({
  open,
  onClose,
  projectId,
  onRestoreCanvas,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onRestoreCanvas: (canvas: unknown) => void | Promise<void>;
}) {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const { alert, doubleConfirm } = useDialogs();
  const focusCanvasNode = useCanvasStore((s) => s.focusCanvasNode);
  const liveNodeIdList = useCanvasStore((s) => s.nodes.map((n) => n.id));
  const liveNodeIds = useMemo(() => new Set(liveNodeIdList), [liveNodeIdList]);
  const [tab, setTab] = useState<TabId>("today");
  const [projectTasks, setProjectTasks] = useState<CanvasGenerationRecord[]>(
    [],
  );
  const [todayTasks, setTodayTasks] = useState<CanvasGenerationRecord[]>([]);
  const [projectHasMore, setProjectHasMore] = useState(false);
  const [todayHasMore, setTodayHasMore] = useState(false);
  const projectCursorRef = useRef<string | null>(null);
  const todayCursorRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const reload = useCallback(async (opts?: { force?: boolean }) => {
    if (!base || !projectId) return;
    const cacheKey = toolbarPanelCacheKey("generation-records", { projectId });
    await fetchToolbarPanelWithSwr({
      cacheKey,
      force: opts?.force,
      fetch: async () => {
        const data = await listCanvasGenerationRecords(base, projectId, {
          projectLimit: CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
          todayLimit: CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
        });
        return {
          projectTasks: data.projectTasks,
          todayTasks: data.todayTasks,
          projectHasMore: data.projectHasMore,
          todayHasMore: data.todayHasMore,
          projectNextCursor: data.projectNextCursor,
          todayNextCursor: data.todayNextCursor,
        };
      },
      onLoading: setLoading,
      onData: (cached) => {
        setProjectTasks(cached.projectTasks);
        setTodayTasks(cached.todayTasks);
        setProjectHasMore(cached.projectHasMore);
        setTodayHasMore(cached.todayHasMore);
        projectCursorRef.current = cached.projectNextCursor;
        todayCursorRef.current = cached.todayNextCursor;
        setListError(null);
      },
      onError: (e) => {
        if (e == null) return;
        setProjectTasks([]);
        setTodayTasks([]);
        setProjectHasMore(false);
        setTodayHasMore(false);
        projectCursorRef.current = null;
        todayCursorRef.current = null;
        setListError(formatCanvasApiError(e instanceof Error ? e.message : String(e)));
      },
    });
  }, [base, projectId]);

  const loadMore = useCallback(async () => {
    if (!base || !projectId || loadingMore) return;
    const isProject = tab === "project";
    const cursor = isProject
      ? projectCursorRef.current
      : todayCursorRef.current;
    const hasMore = isProject ? projectHasMore : todayHasMore;
    if (!hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await listCanvasGenerationRecords(base, projectId, {
        ...(isProject
          ? {
              projectLimit: CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
              projectCursor: cursor,
            }
          : {
              todayLimit: CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE,
              todayCursor: cursor,
            }),
      });
      if (isProject) {
        setProjectTasks((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          const merged = [...prev];
          for (const row of data.projectTasks) {
            if (!seen.has(row.id)) merged.push(row);
          }
          return merged;
        });
        setProjectHasMore(data.projectHasMore);
        projectCursorRef.current = data.projectNextCursor;
      } else {
        setTodayTasks((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          const merged = [...prev];
          for (const row of data.todayTasks) {
            if (!seen.has(row.id)) merged.push(row);
          }
          return merged;
        });
        setTodayHasMore(data.todayHasMore);
        todayCursorRef.current = data.todayNextCursor;
      }
      setListError(null);
    } catch (e) {
      setListError(formatCanvasApiError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingMore(false);
    }
  }, [
    base,
    projectId,
    tab,
    projectHasMore,
    todayHasMore,
    loadingMore,
  ]);

  const activeHasMore = tab === "project" ? projectHasMore : todayHasMore;
  const loadMoreSentinelRef = usePanelInfiniteScroll({
    enabled: open,
    hasMore: activeHasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
  });

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  useEffect(() => {
    return subscribeCanvasGenerationRecordsChanged((detail) => {
      if (detail.projectId !== projectId) return;
      invalidateToolbarPanelCache(GENERATION_RECORDS_CACHE_PREFIX);
      if (openRef.current) void reload({ force: true });
    });
  }, [projectId, reload]);

  const onLocate = useCallback(
    async (item: CanvasGenerationRecord) => {
      if (!item.nodeId) return;
      const href = buildGenerationRecordCanvasHref(item, projectId, "focus");
      if (href && item.projectId && item.projectId !== projectId) {
        onClose();
        router.push(href);
        return;
      }
      const present = resolveGenerationRecordNodePresent(
        item,
        projectId,
        liveNodeIds,
      );
      if (present === false) {
        const canRestore = canRestoreGenerationRecordCanvas(item);
        await alert({
          title: "当前画布上找不到该节点",
          message: canRestore
            ? "该节点已不在当前画布上。若需找回节点与连线，请点击本条记录的「恢复画布」。"
            : "该节点已不在当前画布上。本记录无画布快照，可尝试在「我的历史」中按时间查找。",
          variant: "warning",
        });
        return;
      }
      focusCanvasNode(item.nodeId);
      onClose();
    },
    [alert, focusCanvasNode, liveNodeIds, onClose, projectId, router],
  );

  const onRestoreCanvasItem = useCallback(
    async (item: CanvasGenerationRecord) => {
      if (!base || !canRestoreGenerationRecordCanvas(item)) return;
      const href = buildGenerationRecordCanvasHref(
        item,
        projectId,
        "restoreCanvas",
      );
      if (href && item.projectId && item.projectId !== projectId) {
        onClose();
        router.push(href);
        return;
      }

      const ok = await doubleConfirm({
        first: {
          title: "恢复此生成时的画布？",
          message: `将用 ${new Date(item.createdAt).toLocaleString("zh-CN")} 的快照覆盖当前画布（含节点、提示词与连线）。`,
          confirmLabel: "继续",
          danger: true,
        },
        second: {
          title: "再次确认 · 不可撤销",
          message:
            "恢复后当前未保存的编辑会丢失。建议先手动保存当前状态。是否继续？",
          confirmLabel: "恢复画布",
          danger: true,
        },
      });
      if (!ok) return;

      setRestoringId(item.id);
      try {
        const fetched = await fetchGenerationRecordCanvas(base, item, projectId);
        if (!fetched.ok) {
          await alert({
            title: "无法恢复画布",
            message: fetched.message,
            variant: "warning",
          });
          return;
        }
        await onRestoreCanvas(fetched.canvas);
        if (item.nodeId) {
          focusCanvasNode(item.nodeId);
        }
        onClose();
      } catch (e) {
        await alert({
          title: "恢复失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        setRestoringId(null);
      }
    },
    [
      alert,
      base,
      doubleConfirm,
      focusCanvasNode,
      onClose,
      onRestoreCanvas,
      projectId,
      router,
    ],
  );

  const items = tab === "project" ? projectTasks : todayTasks;

  return (
    <CanvasToolbarSidePanelShell
      open={open}
      onClose={onClose}
      ariaLabel="生成记录"
    >
        <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            <div>
              <p className="text-sm font-medium">生成记录</p>
              <p className="text-[10px] text-white/45">
                含成功与失败 · 可恢复整图快照
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
            onClick={() => setTab("today")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px]",
              tab === "today"
                ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                : CANVAS_PANEL_TAB_IDLE_CLASS,
            )}
          >
            今日全部 ({todayTasks.length}{todayHasMore ? "+" : ""})
          </button>
          <button
            type="button"
            onClick={() => setTab("project")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px]",
              tab === "project"
                ? CANVAS_PANEL_TAB_ACTIVE_CLASS
                : CANVAS_PANEL_TAB_IDLE_CLASS,
            )}
          >
            本项目 ({projectTasks.length}{projectHasMore ? "+" : ""})
          </button>
        </div>

        <div className={CANVAS_PANEL_SHELL_BODY_CLASS}>
          {listError ? (
            <p className={cn("mb-3", CANVAS_PANEL_SHELL_ERROR_CLASS)}>{listError}</p>
          ) : null}
          {loading && items.length === 0 ? (
            <CanvasPanelShellLoading label="加载生成记录…" />
          ) : items.length === 0 ? (
            <p className={CANVAS_PANEL_SHELL_EMPTY_CLASS}>
              {tab === "project"
                ? "本项目还没有生成记录。在节点上点击生成后，成功与失败都会出现在这里。"
                : "今天还没有生成记录。"}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <RecordRow
                  key={item.id}
                  item={item}
                  showProject={tab === "today"}
                  currentProjectId={projectId}
                  nodePresent={resolveGenerationRecordNodePresent(
                    item,
                    projectId,
                    liveNodeIds,
                  )}
                  onLocate={(record) => void onLocate(record)}
                  onRestoreCanvas={(record) => void onRestoreCanvasItem(record)}
                  restoring={restoringId === item.id}
                />
              ))}
              {loadingMore ? (
                <li>
                  <CanvasPanelShellLoadingMore />
                </li>
              ) : null}
              <li>
                <div ref={loadMoreSentinelRef} className="h-1" aria-hidden />
              </li>
            </ul>
          )}
        </div>

        <footer className={cn(CANVAS_PANEL_SHELL_FOOTER_CLASS, "flex items-center justify-between")}>
          <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
            <Clapperboard className="size-3" />
            每 8 秒自动刷新
          </span>
          <button
            type="button"
            onClick={() => void reload({ force: true })}
            className={CANVAS_PANEL_SHELL_LINK_BTN_CLASS}
          >
            刷新
          </button>
        </footer>
    </CanvasToolbarSidePanelShell>
  );
}
