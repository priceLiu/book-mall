/**
 * 粘贴/上传图片 · OSS 链路（与画布 autosave 分离）
 *
 * 预览：本地 blobUrl，立刻显示 + 自适应外框。
 * 上传：scheduleCanvasImageUpload → OSS（trackCanvasImageUpload 队列）。
 * 落盘：上传队列清空后合并一次 canvasDelta（upsertNodes）；失败 fallback 整图 flush。
 *       autosave 在上传进行中会跳过，避免 strip blob 后存空节点。
 */

export {
  canvasImagePreviewLabel,
  scheduleCanvasImageUpload,
  type ScheduleCanvasImageUploadArgs,
} from "./canvas-image-preview-upload";

export {
  CANVAS_IMAGE_UPLOADS_CHANGED,
  flushPendingCanvasImageUploadPersist,
  hasPendingCanvasImageUploads,
  pendingCanvasImageUploadCount,
  trackCanvasImageUpload,
  waitForPendingCanvasImageUploads,
} from "./canvas-pending-image-uploads";
