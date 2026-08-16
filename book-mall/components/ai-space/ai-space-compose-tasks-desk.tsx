"use client";

import {
  CheckCircle2,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildAiSpaceComposeDeskEditHref } from "@/lib/ai-space/ai-space-compose-options";
import type { AiSpaceComposeTaskDto } from "@/lib/ai-space/ai-space-compose-types";
import type { AiSpaceVideoMaterialDto } from "@/lib/ai-space/ai-space-video-types";

import {
  ComposeProgressSteps,
  isComposeTaskRunning,
} from "./ai-space-compose-progress-ui";
import { useAiSpaceComposeTasks } from "./ai-space-compose-tasks-context";
import { AiSpaceOverlay } from "./ai-space-overlay";

const PINS_API = "/api/platform/v1/ai-space/pins";

function ComposeTaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1a7f37]" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
  }
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0969da]" />;
}

function formatTaskTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ComposeTaskDetailDialog({
  task,
  onClose,
  onRetry,
  retrying,
  retryError,
}: {
  task: AiSpaceComposeTaskDto;
  onClose: () => void;
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const running = isComposeTaskRunning(task.status);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  return (
    <AiSpaceOverlay label="合成任务详情" onClose={onClose}>
      <div className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[#d0d7de] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#eaeef2] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#1f2328]">合成任务详情</h2>
            <p className="mt-0.5 text-xs text-[#8c959f]">
              {formatTaskTime(task.createdAt)} · {task.id.slice(0, 8)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[#656d76] hover:bg-[#f6f8fa]"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <ComposeTaskStatusIcon status={task.status} />
            <span className="text-sm font-medium text-[#1f2328]">{task.statusLabel}</span>
          </div>

          {running || task.status === "failed" ? (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eaeef2]">
              <div
                className="h-full rounded-full bg-[#0969da] transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          ) : null}

          <ComposeProgressSteps steps={task.steps} />

          {task.errorMessage ? (
            <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
              {task.errorMessage}
            </p>
          ) : null}

          {retryError ? (
            <p className="mt-2 text-xs text-destructive">{retryError}</p>
          ) : null}
          {pinError ? <p className="mt-2 text-xs text-destructive">{pinError}</p> : null}

          {task.status === "completed" && task.finalVideoUrl ? (
            <div className="mt-4 space-y-2">
              <video
                className="aspect-video w-full rounded-md bg-black object-contain"
                controls
                preload="metadata"
                src={task.finalVideoUrl}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={pinning}
                onClick={() => void pinToWall()}
              >
                {pinning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                展示到作品墙
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eaeef2] px-4 py-3">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={buildAiSpaceComposeDeskEditHref(task.id)} onClick={onClose}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              打开到合成台
            </Link>
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {task.status === "failed" ? (
              <Button
                type="button"
                size="sm"
                disabled={retrying}
                onClick={() => void onRetry()}
              >
                {retrying ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                重试
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </div>
    </AiSpaceOverlay>
  );
}

export function AiSpaceComposeTasksDesk() {
  const { tasks, runningCount, refresh, retryTask } = useAiSpaceComposeTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  const handleRetry = useCallback(
    async (taskId: string) => {
      setRetryError(null);
      setRetryingId(taskId);
      try {
        await retryTask(taskId);
      } catch (e) {
        setRetryError(e instanceof Error ? e.message : "重试失败");
      } finally {
        setRetryingId(null);
      }
    },
    [retryTask],
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#656d76]">
            点击任务查看详情；可「打开到合成台」载入参数后重新编辑提交，失败任务也可直接重试。
          </p>
          {runningCount > 0 ? (
            <span className="rounded-full bg-[#0969da] px-2 py-0.5 text-xs font-medium text-white">
              {runningCount} 个进行中
            </span>
          ) : null}
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] p-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#8c959f]" />
            <p className="mt-3 text-sm font-medium text-[#1f2328]">还没有合成任务</p>
            <p className="mt-1 text-sm text-[#656d76]">
              在
              <Link href="/account/ai-space?tab=compose" className="text-[#0969da] hover:underline">
                合成台
              </Link>
              提交后，任务会出现在这里。
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const running = isComposeTaskRunning(task.status);
              return (
                <li
                  key={task.id}
                  className="rounded-lg border border-[#d0d7de] bg-white p-3 transition hover:border-[#8c959f]"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setRetryError(null);
                        setSelectedId(task.id);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <ComposeTaskStatusIcon status={task.status} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[#1f2328]">
                              {task.statusLabel}
                            </span>
                            <span className="text-xs text-[#8c959f]">
                              {formatTaskTime(task.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#656d76]">
                            任务 {task.id.slice(0, 8)} · 进度 {task.progress}%
                          </p>
                          {running ? (
                            <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-[#eaeef2]">
                              <div
                                className="h-full rounded-full bg-[#0969da] transition-all"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          ) : null}
                          {task.status === "failed" && task.errorMessage ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-destructive">
                              {task.errorMessage}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={buildAiSpaceComposeDeskEditHref(task.id)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          编辑
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRetryError(null);
                          setSelectedId(task.id);
                        }}
                      >
                        详情
                      </Button>
                      {task.status === "failed" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={retryingId === task.id}
                          onClick={() => void handleRetry(task.id)}
                        >
                          {retryingId === task.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          重试
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedTask ? (
        <ComposeTaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedId(null)}
          onRetry={() => void handleRetry(selectedTask.id)}
          retrying={retryingId === selectedTask.id}
          retryError={retryError}
        />
      ) : null}
    </>
  );
}
