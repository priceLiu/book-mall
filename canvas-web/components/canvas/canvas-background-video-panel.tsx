"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronUp, Loader2, Video } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  CANVAS_BACKGROUND_VIDEO_PANEL_TOGGLE_EVENT,
  CANVAS_BACKGROUND_VIDEO_TASK_COUNT_EVENT,
} from "@/components/canvas/canvas-viewport-toolbar";
import {
  listCanvasBackgroundVideoTasks,
  recoverCanvasBackgroundVideoTask,
  type CanvasBackgroundVideoTaskRow,
} from "@/lib/canvas-api";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import {
  BACKGROUND_DOCK_LONG_TASK_MS,
  formatBackgroundGenerationAge,
} from "@/lib/canvas/background-generation-dock-policy";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;
const PANEL_OPEN_EVENT = "canvas:background-video-panel-open";
const LONG_TASK_SEC = BACKGROUND_DOCK_LONG_TASK_MS / 1000;

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

function syncPanelExpanded(expanded: boolean) {
  window.dispatchEvent(
    new CustomEvent(PANEL_OPEN_EVENT, {
      detail: { open: expanded },
    }),
  );
}

function syncTaskCount(count: number) {
  window.dispatchEvent(
    new CustomEvent(CANVAS_BACKGROUND_VIDEO_TASK_COUNT_EVENT, {
      detail: { count },
    }),
  );
}

function countReadyTasks(tasks: CanvasBackgroundVideoTaskRow[]): number {
  return tasks.filter((t) => t.kind === "ready_to_load").length;
}

function countRunningTasks(tasks: CanvasBackgroundVideoTaskRow[]): number {
  return tasks.filter((t) => t.kind === "background_generating").length;
}

/** 画布 · 后台视频 Dock（默认最小化胶囊，不常驻展开） */
export function CanvasBackgroundVideoPanel({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<CanvasBackgroundVideoTaskRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const prevReadyRef = useRef<Set<string>>(new Set());
  const prevLongRunningNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const next = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof next === "boolean") {
        setExpanded(next);
        syncPanelExpanded(next);
      } else {
        setExpanded((prev) => {
          const v = !prev;
          syncPanelExpanded(v);
          return v;
        });
      }
    };
    window.addEventListener(CANVAS_BACKGROUND_VIDEO_PANEL_TOGGLE_EVENT, onToggle);
    return () =>
      window.removeEventListener(CANVAS_BACKGROUND_VIDEO_PANEL_TOGGLE_EVENT, onToggle);
  }, []);

  const refresh = useCallback(async () => {
    if (!base) {
      setFetchError("未连接主站，无法加载后台视频任务");
      syncTaskCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await listCanvasBackgroundVideoTasks(base, projectId);
      setTasks(res.tasks);
      setFetchError(null);
      syncTaskCount(res.tasks.length);

      for (const t of res.tasks) {
        if (t.kind === "ready_to_load" && !prevReadyRef.current.has(t.taskId)) {
          prevReadyRef.current.add(t.taskId);
          // 成功：不展开面板、不弹阻塞对话框
        }
        if (
          (t.kind === "recoverable_stall" ||
            t.kind === "background_generating") &&
          t.ageSec >= LONG_TASK_SEC &&
          !prevLongRunningNotifiedRef.current.has(t.taskId)
        ) {
          prevLongRunningNotifiedRef.current.add(t.taskId);
          canvasNotify({
            title: "视频仍在生成",
            message: `「${t.label}」已等待 ${formatBackgroundGenerationAge(t.ageSec)}，仍在厂商侧生成。点右下角「后台视频」或工具栏摄像机图标查看进度。`,
            variant: "info",
          });
        }
      }

      if (res.tasks.length === 0) {
        setExpanded(false);
        syncPanelExpanded(false);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "加载失败");
      syncTaskCount(0);
    } finally {
      setLoading(false);
    }
  }, [base, projectId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const minimizePanel = useCallback(() => {
    setExpanded(false);
    syncPanelExpanded(false);
  }, []);

  const onRecover = useCallback(
    async (taskId: string) => {
      if (!base || loadingId) return;
      setLoadingId(taskId);
      try {
        const res = await recoverCanvasBackgroundVideoTask(base, projectId, taskId);
        if (res.ok) {
          window.dispatchEvent(new Event("canvas:video-library-changed"));
          await refresh();
          minimizePanel();
        } else {
          canvasNotify({
            title: "暂未出片",
            message: res.result.reason ?? "厂商仍在生成，请稍后再试。",
            variant: "info",
          });
        }
      } catch (e) {
        canvasNotify({
          title: "恢复失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setLoadingId(null);
      }
    },
    [base, minimizePanel, projectId, loadingId, refresh],
  );

  if (!mounted) return null;

  const hasTasks = tasks.length > 0;
  const readyCount = countReadyTasks(tasks);
  const runningCount = countRunningTasks(tasks);
  const showDock = hasTasks || expanded;

  if (!showDock) return null;

  const collapsedLabel =
    readyCount > 0
      ? `后台视频 · ${readyCount} 可加载`
      : runningCount > 0
        ? `后台视频 · ${runningCount} 生成中`
        : `后台视频 · ${tasks.length}`;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed bottom-[5.75rem] right-4 z-[200] flex flex-col items-end",
      )}
    >
      {!expanded && hasTasks ? (
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-lg transition hover:shadow-xl",
            readyCount > 0
              ? "border-emerald-400/35 bg-[#141418]/96 text-emerald-100"
              : "border-orange-400/40 bg-[#141418]/96 text-orange-100",
          )}
          onClick={() => {
            setExpanded(true);
            syncPanelExpanded(true);
          }}
          aria-label="展开后台视频"
        >
          {runningCount > 0 && readyCount === 0 ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-orange-300" />
          ) : readyCount > 0 ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <Video className="size-4 shrink-0 text-orange-300" />
          )}
          <span>{collapsedLabel}</span>
          <ChevronUp className="size-3.5 opacity-50" />
        </button>
      ) : expanded ? (
        <div
          className={cn(
            "pointer-events-auto w-[min(100vw-2rem,22rem)] rounded-xl border shadow-xl",
            hasTasks
              ? "border-orange-400/35 bg-[#141418]/98"
              : "border-orange-400/20 bg-[#141418]/95",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <span
              className={cn(
                "flex min-w-0 items-center gap-2 text-sm font-medium",
                hasTasks ? "text-orange-100" : "text-zinc-200",
              )}
            >
              {loading ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-orange-300" />
              ) : (
                <Video className="size-4 shrink-0 text-orange-300" />
              )}
              <span className="truncate">
                后台视频
                {hasTasks ? ` · ${tasks.length}` : ""}
              </span>
            </span>
            <button
              type="button"
              className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
              onClick={minimizePanel}
            >
              最小化
            </button>
          </div>

          <div className="p-2">
            {fetchError ? (
              <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] leading-snug text-red-200/90">
                {fetchError}
              </p>
            ) : null}

            {!fetchError && !hasTasks ? (
              <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
                暂无后台视频任务。长视频在生成超过约 15
                分钟后会转入后台；成片就绪后点「加载到节点」写回画布。
              </p>
            ) : null}

            {hasTasks ? (
              <ul className="max-h-64 overflow-y-auto">
                {tasks.map((t) => (
                  <li
                    key={t.taskId}
                    className="mb-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 last:mb-0"
                  >
                    <div className="truncate text-sm font-medium text-zinc-100">
                      {t.label}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-zinc-400">
                      {t.hint}
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      已等待 {formatAge(t.ageSec)}
                      {t.kind === "recoverable_stall"
                        ? " · 可恢复"
                        : t.kind === "ready_to_load"
                          ? " · 可加载"
                          : " · 后台生成中"}
                    </div>
                    {t.canRecover ? (
                      <button
                        type="button"
                        disabled={loadingId === t.taskId}
                        onClick={() => void onRecover(t.taskId)}
                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-orange-600/90 px-2 py-1 text-xs text-white hover:bg-orange-500 disabled:opacity-60"
                      >
                        {loadingId === t.taskId ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        加载到节点
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
