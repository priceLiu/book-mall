"use client";

/** 侧栏面板 · 生成任务变更同步（P0 事件总线） */

export type CanvasTaskPanelSyncDetail = {
  projectId: string;
  taskId?: string;
  status?: string;
  /** 任务进入终态（SUCCEEDED / FAILED / CANCELLED） */
  terminal?: boolean;
  /** 新任务创建或复用 */
  created?: boolean;
};

export const CANVAS_GENERATION_RECORDS_CHANGED =
  "canvas:generation-records-changed";
export const CANVAS_PROMPT_HISTORY_CHANGED = "canvas:prompt-history-changed";
export const CANVAS_TASKS_CHANGED = "canvas:tasks-changed";

const GENERATION_RECORDS_PREFIX = "generation-records|";
const PROMPT_HISTORY_PREFIX = "prompt-history|";

export function notifyCanvasTaskPanelSync(
  detail: CanvasTaskPanelSyncDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CANVAS_GENERATION_RECORDS_CHANGED, { detail }),
  );
  if (detail.terminal || detail.created) {
    window.dispatchEvent(
      new CustomEvent(CANVAS_PROMPT_HISTORY_CHANGED, { detail }),
    );
  }
  window.dispatchEvent(new CustomEvent(CANVAS_TASKS_CHANGED, { detail }));
}

export function isCanvasTaskTerminalStatus(
  status: string | undefined,
): boolean {
  return (
    status === "SUCCEEDED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

export function subscribeCanvasGenerationRecordsChanged(
  handler: (detail: CanvasTaskPanelSyncDetail) => void,
): () => void {
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<CanvasTaskPanelSyncDetail>).detail;
    if (detail?.projectId) handler(detail);
  };
  window.addEventListener(CANVAS_GENERATION_RECORDS_CHANGED, onEvent);
  return () =>
    window.removeEventListener(CANVAS_GENERATION_RECORDS_CHANGED, onEvent);
}

export function subscribeCanvasPromptHistoryChanged(
  handler: (detail: CanvasTaskPanelSyncDetail) => void,
): () => void {
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<CanvasTaskPanelSyncDetail>).detail;
    if (detail?.projectId) handler(detail);
  };
  window.addEventListener(CANVAS_PROMPT_HISTORY_CHANGED, onEvent);
  return () =>
    window.removeEventListener(CANVAS_PROMPT_HISTORY_CHANGED, onEvent);
}

export const GENERATION_RECORDS_CACHE_PREFIX = GENERATION_RECORDS_PREFIX;
export const PROMPT_HISTORY_CACHE_PREFIX = PROMPT_HISTORY_PREFIX;
