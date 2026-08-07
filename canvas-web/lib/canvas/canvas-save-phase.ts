/** 画布保存 · 分步阶段（顶栏提示 + 失败文案） */

import { formatCanvasApiError } from "@/lib/canvas-api";

export type CanvasSavePhase =
  | "idle"
  | "wait_uploads"
  | "commit_layout"
  | "flush_drafts"
  | "sync_version"
  | "history_thumb"
  | "patch_delta"
  | "patch_full"
  | "retry"
  | "done";

const PHASE_STEP_LABEL: Record<
  Exclude<CanvasSavePhase, "idle" | "done" | "retry">,
  string
> = {
  wait_uploads: "等待图片上传",
  commit_layout: "同步节点位置",
  flush_drafts: "写入文本草稿",
  sync_version: "同步画布版本",
  history_thumb: "生成历史封面",
  patch_delta: "增量保存",
  patch_full: "整图保存",
};

export function canvasSavePhaseLabel(
  phase: CanvasSavePhase,
  retryAttempt?: number,
): string {
  switch (phase) {
    case "wait_uploads":
      return "等待图片上传…";
    case "commit_layout":
      return "同步节点位置…";
    case "flush_drafts":
      return "写入文本草稿…";
    case "sync_version":
      return "同步画布版本…";
    case "history_thumb":
      return "生成历史封面…";
    case "patch_delta":
      return "增量保存中…";
    case "patch_full":
      return "整图保存中…";
    case "retry":
      return `保存重试中 (${retryAttempt ?? 1}/2)…`;
    case "done":
      return "已保存";
    default:
      return "";
  }
}

/** 按失败时所在步骤拼接可读错误（顶栏） */
export function formatCanvasSaveStepError(
  phase: CanvasSavePhase,
  raw: string,
): string {
  const detail = formatCanvasApiError(raw);
  if (phase === "retry" || phase === "idle" || phase === "done") {
    return detail;
  }
  if (phase in PHASE_STEP_LABEL) {
    const step = PHASE_STEP_LABEL[phase as keyof typeof PHASE_STEP_LABEL];
    return `${step}失败：${detail}`;
  }
  return detail;
}
