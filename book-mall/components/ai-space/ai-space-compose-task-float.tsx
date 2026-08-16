"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSpaceComposeTaskDto } from "@/lib/ai-space/ai-space-compose-types";
import type { AiSpaceVideoMaterialDto } from "@/lib/ai-space/ai-space-video-types";

import {
  ComposeProgressSteps,
  isComposeTaskRunning,
} from "./ai-space-compose-progress-ui";
import { useAiSpaceComposeTasks } from "./ai-space-compose-tasks-context";

const PINS_API = "/api/platform/v1/ai-space/pins";

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#1a7f37]" />;
  }
  if (status === "failed") {
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  }
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#0969da]" />;
}

function ComposeTaskCard({
  task,
  compact,
}: {
  task: AiSpaceComposeTaskDto;
  compact?: boolean;
}) {
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const pinToWall = useCallback(async () => {
    setPinError(null);
    setPinning(true);
    try {
      const listRes = await fetch(
        "/api/platform/v1/ai-space/video-materials?ownedOnly=1",
        { credentials: "include" },
      );
      const listData = (await listRes.json().catch(() => ({}))) as {
        materials?: AiSpaceVideoMaterialDto[];
      };
      const material = listData.materials?.find((m) => m.composeTaskId === task.id);
      if (!material) {
        setPinError("未找到成片记录");
        return;
      }
      const res = await fetch(PINS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType: "ai_space_video", sourceId: material.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPinError(data.error ?? "展示失败");
      }
    } finally {
      setPinning(false);
    }
  }, [task.id]);

  const running = isComposeTaskRunning(task.status);

  return (
    <li className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] p-2.5">
      <div className="flex items-start gap-2">
        <TaskStatusIcon status={task.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-[#1f2328]">
              {task.statusLabel}
            </span>
            <span className="shrink-0 text-[10px] text-[#8c959f]">
              {new Date(task.createdAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {running || task.status === "failed" ? (
            <>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#eaeef2]">
                <div
                  className="h-full rounded-full bg-[#0969da] transition-all"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              {!compact ? <ComposeProgressSteps steps={task.steps} /> : null}
            </>
          ) : null}

          {task.errorMessage ? (
            <p className="mt-1 text-[10px] leading-snug text-destructive">
              {task.errorMessage}
            </p>
          ) : null}

          {pinError ? (
            <p className="mt-1 text-[10px] text-destructive">{pinError}</p>
          ) : null}

          {task.status === "completed" && task.finalVideoUrl ? (
            <div className="mt-2 space-y-2">
              {!compact ? (
                <video
                  className="aspect-video w-full rounded bg-black object-contain"
                  controls
                  preload="metadata"
                  src={task.finalVideoUrl}
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs"
                disabled={pinning}
                onClick={() => void pinToWall()}
              >
                {pinning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                展示到作品墙
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AiSpaceComposeTaskFloat() {
  const { tasks, panelOpen, setPanelOpen, runningCount } = useAiSpaceComposeTasks();

  if (tasks.length === 0) return null;

  const displayTasks = panelOpen ? tasks : tasks.filter((t) => isComposeTaskRunning(t.status)).slice(0, 1);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[450] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-[#d0d7de] bg-white shadow-lg shadow-black/10">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#f6f8fa]"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#1f2328]">
            <Sparkles className="h-4 w-4 shrink-0 text-[#0969da]" />
            <span className="truncate">合成任务</span>
            {runningCount > 0 ? (
              <span className="rounded-full bg-[#0969da] px-1.5 py-0.5 text-[10px] font-medium text-white">
                {runningCount}
              </span>
            ) : (
              <span className="text-[10px] font-normal text-[#8c959f]">{tasks.length} 条</span>
            )}
          </span>
          {panelOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#656d76]" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0 text-[#656d76]" aria-hidden />
          )}
        </button>

        {displayTasks.length > 0 ? (
          <ul
            className={
              panelOpen
                ? "max-h-[min(24rem,50dvh)] space-y-2 overflow-y-auto border-t border-[#eaeef2] p-2"
                : "border-t border-[#eaeef2] p-2"
            }
          >
            {displayTasks.map((task) => (
              <ComposeTaskCard key={task.id} task={task} compact={!panelOpen} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-[#eaeef2] px-3 py-3 text-xs text-[#656d76]">
            暂无进行中的任务，点击标题展开查看全部记录。
          </p>
        )}
      </div>
    </div>
  );
}
