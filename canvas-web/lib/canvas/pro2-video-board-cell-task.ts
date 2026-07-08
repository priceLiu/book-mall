"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  pickStoryRowApplyTask,
  pickStoryRowSucceededTask,
  tasksMatchStoryScope,
} from "./task-pick";
import { pickTaskResultMediaUrl } from "./task-media-url";
import type { CanvasNodeRuntime } from "./types";
import type { StoryProVideoRow } from "./story-pro-workspace-types";

/** 分镜视频组格 · 任务挂在 video 列 nodeId + storyScope.rowKey */
export function pro2VideoBoardRowScope(rowKey: string) {
  return { rowKey, mediaKind: "video" as const };
}

/** 同镜最新成功成片（用于展示 URL，不受后续失败重试覆盖） */
export function pickPro2VideoBoardRowSucceededTask(
  tasks: CanvasTaskRecord[],
  controllerNodeId: string,
  rowKey: string,
): CanvasTaskRecord | undefined {
  return pickStoryRowSucceededTask(
    tasks.filter((t) => t.nodeId === controllerNodeId),
    pro2VideoBoardRowScope(rowKey),
  );
}

/**
 * 写回 runtime 时优先：进行中 > 最新成功成片 > 最新失败（仅无成功成片时）。
 * 避免「重试失败」覆盖较早的成功视频导致闪一下又消失。
 */
export function pickPro2VideoBoardRowApplyTask(
  tasks: CanvasTaskRecord[],
  controllerNodeId: string,
  rowKey: string,
  localRuntime?: CanvasNodeRuntime | null,
): CanvasTaskRecord | undefined {
  return pickStoryRowApplyTask(
    tasks.filter((t) => t.nodeId === controllerNodeId),
    pro2VideoBoardRowScope(rowKey),
    localRuntime,
  );
}

/** @deprecated 使用 pickPro2VideoBoardRowApplyTask；保留别名避免遗漏引用 */
export function pickPro2VideoBoardRowTask(
  tasks: CanvasTaskRecord[],
  controllerNodeId: string,
  rowKey: string,
): CanvasTaskRecord | undefined {
  return pickPro2VideoBoardRowApplyTask(tasks, controllerNodeId, rowKey);
}

export function pro2VideoBoardRowRuntime(
  rows: StoryProVideoRow[] | undefined,
  rowKey: string,
): CanvasNodeRuntime | undefined {
  return rows?.find((r) => r.key === rowKey)?.videoRuntime;
}

export function pro2VideoBoardRowMediaUrl(input: {
  runtime?: CanvasNodeRuntime;
  task?: CanvasTaskRecord;
}): string | undefined {
  const fromRt =
    input.runtime?.ossUrl?.trim() || input.runtime?.ephemeralUrl?.trim();
  if (fromRt) return fromRt;
  if (!input.task) return undefined;
  return (
    pickTaskResultMediaUrl(input.task) ??
    input.task.ossUrl?.trim() ??
    input.task.ephemeralUrl?.trim() ??
    undefined
  );
}

export function pro2VideoBoardRowTasks(
  tasks: CanvasTaskRecord[],
  controllerNodeId: string,
  rowKey: string,
): CanvasTaskRecord[] {
  return tasks.filter(
    (t) =>
      t.nodeId === controllerNodeId &&
      tasksMatchStoryScope(t, pro2VideoBoardRowScope(rowKey)),
  );
}
