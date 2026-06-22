"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listCanvasBackgroundVideoTasks,
  recoverCanvasBackgroundVideoTask,
  type CanvasBackgroundVideoTaskRow,
} from "@/lib/canvas-api";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import { cn } from "@/lib/utils";

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export function CanvasBackgroundVideoPanel({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const [tasks, setTasks] = useState<CanvasBackgroundVideoTaskRow[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const prevReadyRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!base) return;
    try {
      const res = await listCanvasBackgroundVideoTasks(base, projectId);
      setTasks(res.tasks);
      for (const t of res.tasks) {
        if (t.kind === "recoverable_stall" && !prevReadyRef.current.has(t.taskId)) {
          prevReadyRef.current.add(t.taskId);
          canvasNotify({
            title: "视频可能已生成",
            message: `节点「${t.label}」可在右下角面板点击「加载到节点」。`,
            variant: "info",
          });
        }
      }
    } catch {
      // 非阻塞：保留上一帧
    }
  }, [base, projectId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const onRecover = useCallback(
    async (taskId: string) => {
      if (!base || loadingId) return;
      setLoadingId(taskId);
      try {
        const res = await recoverCanvasBackgroundVideoTask(base, projectId, taskId);
        if (res.ok) {
          canvasNotify({
            title: "视频已加载",
            message: "成片已写回节点，可在画布查看。",
            variant: "info",
          });
          window.dispatchEvent(new Event("canvas:video-library-changed"));
          await refresh();
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
    [base, projectId, loadingId, refresh],
  );

  if (tasks.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed bottom-6 right-6 z-[75] w-[min(100vw-2rem,22rem)] rounded-xl border border-orange-400/25 bg-[#141418]/95 shadow-xl backdrop-blur",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-orange-100">
          <Video className="size-4 text-orange-300" />
          后台视频 · {tasks.length}
        </span>
        <span className="text-xs text-zinc-500">{collapsed ? "展开" : "收起"}</span>
      </button>
      {!collapsed ? (
        <ul className="max-h-64 overflow-y-auto p-2">
          {tasks.map((t) => (
            <li
              key={t.taskId}
              className="mb-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 last:mb-0"
            >
              <div className="text-sm font-medium text-zinc-100 truncate">{t.label}</div>
              <div className="mt-1 text-[11px] leading-snug text-zinc-400">{t.hint}</div>
              <div className="mt-1 text-[10px] text-zinc-500">
                已等待 {formatAge(t.ageSec)}
                {t.kind === "recoverable_stall" ? " · 可恢复" : " · 后台生成中"}
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
  );
}
