/** 画布保存 · 分步阶段（顶栏提示 + 失败文案） */

import { formatCanvasApiError } from "@/lib/canvas-api";
import {
  isTransientDbApiError,
  isTransientNetworkFetchError,
} from "@/lib/fetch-with-db-retry";

/** 顶栏 · 主站短暂不可达时的轻量提示（与其它 chip 同字号，勿用长错误句） */
export const CANVAS_AUTOSAVE_RECONNECT_HINT = "自动重连中…";

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

/** 主站超时 / 503 / 网络抖动等 · 自动重试，顶栏勿吓用户 */
export function isCanvasAutosaveReconnectError(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (isTransientNetworkFetchError(t)) return true;
  const status = Number((/\b(\d{3})\b/.exec(t) ?? [])[1]) || 0;
  if (isTransientDbApiError(status, t)) return true;
  if (/\b(502|503|429)\b/.test(t)) return true;
  if (t.includes("save_timeout") || t.includes("save_wait_timeout")) return true;
  if (/operation was aborted|The user aborted|AbortError/i.test(t)) return true;
  if (t.includes("DATABASE_UNAVAILABLE")) return true;
  return false;
}

/** 顶栏 autosave 失败文案：可恢复 → 自动重连；否则短句，不带「整图保存失败」前缀 */
export function formatCanvasAutosaveUserHint(raw: string): string {
  if (isCanvasAutosaveReconnectError(raw)) {
    return CANVAS_AUTOSAVE_RECONNECT_HINT;
  }
  const detail = formatCanvasApiError(raw);
  if (detail.length > 40) {
    return "保存未成功，请稍后重试";
  }
  return detail;
}

/** @deprecated 顶栏请用 formatCanvasAutosaveUserHint，避免「整图保存失败：…」长句 */
export function formatCanvasSaveStepError(
  phase: CanvasSavePhase,
  raw: string,
): string {
  if (isCanvasAutosaveReconnectError(raw)) {
    return CANVAS_AUTOSAVE_RECONNECT_HINT;
  }
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
