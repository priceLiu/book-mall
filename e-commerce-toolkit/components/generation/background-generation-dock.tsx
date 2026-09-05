"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Video,
  X,
} from "lucide-react";

import {
  BACKGROUND_DOCK_EXIT_ANIM_MS,
  estimateBackgroundGenerationProgress,
  formatBackgroundGenerationAge,
  isBackgroundDockTaskVisible,
  resolveBackgroundGenerationLabel,
} from "@/lib/generation/background-generation-policy";
import type { BackgroundGenerationTask } from "@/lib/generation/background-generation-types";
import { cn } from "@/lib/utils";

type Props = {
  tasks: BackgroundGenerationTask[];
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onDismiss: (id: string) => void;
  /** light = 电商工具箱；dark 见 canvas-background-video-panel */
  variant?: "light" | "dark";
};

function taskIcon(task: BackgroundGenerationTask) {
  if (task.id.includes("video") || task.label.includes("视频") || task.label.includes("成片")) {
    return Video;
  }
  return Sparkles;
}

export function BackgroundGenerationDock({
  tasks,
  expanded,
  onExpandedChange,
  onDismiss,
  variant = "light",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [entered, setEntered] = useState(false);
  const [renderTasks, setRenderTasks] = useState<BackgroundGenerationTask[]>([]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => isBackgroundDockTaskVisible(task, now)),
    [now, tasks],
  );

  useEffect(() => {
    if (visibleTasks.length > 0) {
      setRenderTasks(visibleTasks);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setEntered(false);
  }, [visibleTasks]);

  useEffect(() => {
    if (visibleTasks.length > 0 || renderTasks.length === 0) return;
    const timer = window.setTimeout(() => setRenderTasks([]), BACKGROUND_DOCK_EXIT_ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [renderTasks.length, visibleTasks.length]);

  const displayTasks = visibleTasks.length > 0 ? visibleTasks : renderTasks;
  const hasSuccessFlash = displayTasks.some((t) => t.status === "succeeded");
  const hasFailed = displayTasks.some((t) => t.status === "failed");
  const runningCount = displayTasks.filter((t) => t.status === "running").length;
  const exitingSuccess =
    visibleTasks.length === 0 && renderTasks.some((t) => t.status === "succeeded");
  const effectiveExpanded = expanded || hasSuccessFlash || exitingSuccess;
  const collapsed = !effectiveExpanded;

  if (!mounted || displayTasks.length === 0) return null;

  const shellLight =
    "border-[#e8e8ed] bg-white shadow-lg ring-1 ring-black/[0.04]";
  const shellDark = "border-orange-400/35 bg-[#141418]/98 shadow-xl";
  const shell = variant === "light" ? shellLight : shellDark;

  const collapsedBtn = (
    <button
      type="button"
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-lg transition hover:shadow-xl",
        hasFailed
          ? variant === "light"
            ? "border-[#ff3b30]/35 bg-[#fff5f5] text-[#ff3b30] hover:bg-[#ffecec]"
            : "border-red-400/45 bg-red-950/90 text-red-200"
          : variant === "light"
            ? "border-[#d2d2d7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
            : "border-orange-400/40 bg-[#141418]/95 text-orange-100",
      )}
      onClick={() => onExpandedChange(true)}
      aria-label={hasFailed ? "展开失败任务" : "展开后台生成任务"}
    >
      {hasFailed ? (
        <AlertCircle className="size-4 shrink-0" />
      ) : runningCount > 0 ? (
        <Loader2
          className={cn(
            "size-4 shrink-0 animate-spin",
            variant === "light" ? "text-[#0071e3]" : "text-orange-300",
          )}
        />
      ) : (
        <Sparkles
          className={cn(
            "size-4 shrink-0",
            variant === "light" ? "text-[#0071e3]" : "text-orange-300",
          )}
        />
      )}
      <span>
        {hasFailed ? "生成失败" : "后台生成"}
        {visibleTasks.length > 0
          ? ` · ${runningCount > 0 ? runningCount : displayTasks.length}`
          : ""}
      </span>
      <ChevronUp className="size-3.5 opacity-50" />
    </button>
  );

  const panel = (
    <div
      className={cn(
        "pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl",
        shell,
        hasFailed && !hasSuccessFlash && variant === "light" && "ring-1 ring-[#ff3b30]/20",
        hasFailed && !hasSuccessFlash && variant === "dark" && "ring-1 ring-red-400/25",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-3 py-2",
          variant === "light" ? "border-[#e8e8ed]" : "border-white/10",
          hasFailed && !hasSuccessFlash && variant === "light" && "bg-[#fffafa]",
          hasFailed && !hasSuccessFlash && variant === "dark" && "bg-red-950/40",
        )}
      >
        <span
          className={cn(
            "flex min-w-0 items-center gap-2 text-sm font-medium",
            hasFailed && !hasSuccessFlash
              ? variant === "light"
                ? "text-[#ff3b30]"
                : "text-red-200"
              : variant === "light"
                ? "text-[#1d1d1f]"
                : "text-orange-100",
          )}
        >
          {hasSuccessFlash ? (
            <CheckCircle2
              className={cn(
                "size-4 shrink-0",
                variant === "light" ? "text-[#34c759]" : "text-emerald-400",
              )}
            />
          ) : hasFailed ? (
            <AlertCircle className="size-4 shrink-0" />
          ) : runningCount > 0 ? (
            <Loader2
              className={cn(
                "size-4 shrink-0 animate-spin",
                variant === "light" ? "text-[#0071e3]" : "text-orange-300",
              )}
            />
          ) : (
            <Sparkles
              className={cn(
                "size-4 shrink-0",
                variant === "light" ? "text-[#0071e3]" : "text-orange-300",
              )}
            />
          )}
          <span className="truncate">
            {hasSuccessFlash
              ? "生成完成"
              : hasFailed
                ? "生成失败"
                : `后台生成${runningCount > 0 ? ` · ${runningCount} 进行中` : ""}`}
          </span>
        </span>
        {!hasSuccessFlash ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={cn(
                "rounded-md p-1",
                variant === "light"
                  ? "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              aria-label="最小化"
              onClick={() => onExpandedChange(false)}
            >
              <ChevronDown className="size-4" />
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md p-1",
                variant === "light"
                  ? "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              aria-label="关闭面板"
              onClick={() => onExpandedChange(false)}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
      </div>

      <ul className="max-h-64 overflow-y-auto p-2 ecom-scrollbar-thin">
        {displayTasks.map((task) => {
          const startedMs = new Date(task.startedAt).getTime();
          const ageSec = Math.max(0, Math.round((now - startedMs) / 1000));
          const statusLabel =
            task.status === "succeeded"
              ? "已完成"
              : task.status === "failed"
                ? "生成失败"
                : resolveBackgroundGenerationLabel(startedMs, now);
          const progress =
            task.status === "running" && task.expectedDurationMs
              ? estimateBackgroundGenerationProgress(
                  startedMs,
                  task.expectedDurationMs,
                  now,
                )
              : task.status === "succeeded"
                ? 1
                : 0;
          const Icon = taskIcon(task);
          const failed = task.status === "failed";

          return (
            <li
              key={task.id}
              className={cn(
                "mb-2 rounded-lg border px-3 py-2 last:mb-0",
                failed
                  ? variant === "light"
                    ? "border-[#ff3b30]/25 bg-[#fff5f5]"
                    : "border-red-400/30 bg-red-950/30"
                  : variant === "light"
                    ? "border-[#e8e8ed] bg-[#fafafa]"
                    : "border-white/10 bg-black/30",
              )}
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    failed
                      ? variant === "light"
                        ? "text-[#ff3b30]"
                        : "text-red-300"
                      : variant === "light"
                        ? "text-[#0071e3]"
                        : "text-orange-300",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-sm font-medium",
                      failed
                        ? variant === "light"
                          ? "text-[#ff3b30]"
                          : "text-red-200"
                        : variant === "light"
                          ? "text-[#1d1d1f]"
                          : "text-zinc-100",
                    )}
                  >
                    {task.label}
                  </div>
                  {task.hint ? (
                    <div
                      className={cn(
                        "mt-0.5 text-[11px] leading-snug",
                        variant === "light" ? "text-[#86868b]" : "text-zinc-400",
                      )}
                    >
                      {task.hint}
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "mt-1 text-[10px] leading-snug",
                      variant === "light" ? "text-[#86868b]" : "text-zinc-500",
                    )}
                  >
                    已等待 {formatBackgroundGenerationAge(ageSec)} · {statusLabel}
                  </div>
                  {failed && task.error ? (
                    <div
                      className={cn(
                        "mt-1 line-clamp-3 text-[10px] leading-snug",
                        variant === "light" ? "text-[#ff3b30]" : "text-red-400",
                      )}
                      title={task.error}
                    >
                      {task.error}
                    </div>
                  ) : null}
                  {task.status === "running" ? (
                    <div
                      className={cn(
                        "mt-2 h-1 overflow-hidden rounded-full",
                        variant === "light" ? "bg-[#e8e8ed]" : "bg-white/10",
                      )}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700",
                          variant === "light" ? "bg-[#0071e3]" : "bg-orange-400",
                        )}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {task.status === "running" && task.onCancel ? (
                    <button
                      type="button"
                      className={cn(
                        "text-[10px] font-medium",
                        variant === "light"
                          ? "text-[#ff3b30] hover:text-[#d70015]"
                          : "text-red-400 hover:text-red-300",
                      )}
                      onClick={() => void task.onCancel?.()}
                    >
                      {task.cancelLabel ?? "中止"}
                    </button>
                  ) : null}
                  {task.status === "succeeded" && task.onOpen ? (
                    <button
                      type="button"
                      className={cn(
                        "text-[10px] font-medium",
                        variant === "light"
                          ? "text-[#0071e3] hover:text-[#0077ed]"
                          : "text-orange-300 hover:text-orange-200",
                      )}
                      onClick={() => void task.onOpen?.()}
                    >
                      {task.openLabel ?? "打开作品"}
                    </button>
                  ) : null}
                  {task.status !== "running" && !hasSuccessFlash ? (
                    <button
                      type="button"
                      className={cn(
                        "text-[10px]",
                        variant === "light"
                          ? "text-[#86868b] hover:text-[#1d1d1f]"
                          : "text-zinc-500 hover:text-zinc-300",
                      )}
                      onClick={() => onDismiss(task.id)}
                    >
                      清除
                    </button>
                  ) : task.status === "running" && task.onCancel ? (
                    <button
                      type="button"
                      className={cn(
                        "text-[10px]",
                        variant === "light"
                          ? "text-[#86868b] hover:text-[#1d1d1f]"
                          : "text-zinc-500 hover:text-zinc-300",
                      )}
                      onClick={() => onExpandedChange(false)}
                    >
                      收起
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <div className="pointer-events-none fixed bottom-4 right-4 flex flex-col items-end gap-2">
        <div
          className={cn(
            "transition-all ease-out",
            entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
          )}
          style={{ transitionDuration: `${BACKGROUND_DOCK_EXIT_ANIM_MS}ms` }}
        >
          {collapsed ? (
            <div className="pointer-events-auto">{collapsedBtn}</div>
          ) : (
            panel
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
