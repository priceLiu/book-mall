/** 与 book-mall/lib/gateway/video-task-wait-policy.ts 保持同步（前端不可跨包 import） */

export const VIDEO_BACKGROUND_UI_MS = 10 * 60 * 1000;

export const VIDEO_BACKGROUND_UI_LABEL = "持续后台生成中…";
export const VIDEO_GENERATING_LABEL = "视频生成中…";
export const VIDEO_QUEUE_LABEL = "排队中…";
export const VIDEO_BACKGROUND_WAIT_HINT =
  "视频仍在厂商侧生成，可先处理其他内容；成片后将通知您加载到节点。";

export function isVideoBackgroundWaitAge(
  sinceIso: string | null | undefined,
  nowMs: number = Date.now(),
  thresholdMs: number = VIDEO_BACKGROUND_UI_MS,
): boolean {
  if (!sinceIso) return false;
  const ts = Date.parse(sinceIso);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts >= thresholdMs;
}

export function resolveVideoGeneratingLabel(
  isPending: boolean,
  isBackground: boolean,
): string {
  if (isBackground) return VIDEO_BACKGROUND_UI_LABEL;
  if (isPending) return VIDEO_QUEUE_LABEL;
  return VIDEO_GENERATING_LABEL;
}
