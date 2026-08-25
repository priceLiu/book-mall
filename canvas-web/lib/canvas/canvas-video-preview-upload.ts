import { uploadCanvasVideo } from "@/lib/canvas-api";
import { fitLibtvUploadedVideoNaturalSize } from "./libtv-media-aspect-preset-apply";

import {
  CANVAS_IMAGE_UPLOAD_STALE_MS,
  scheduleCanvasStructurePersistAfterPaste,
  trackCanvasImageUpload,
} from "./canvas-pending-image-uploads";

export type ScheduleCanvasVideoUploadArgs = {
  nodeId: string;
  file: File;
  base: string | undefined;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  /** 首帧 blob，上传成功后 revoke */
  previewBlobUrl?: string;
  onUploadError?: (message: string) => void;
};

/**
 * 节点已写入 runtime.ephemeralUrl 后调用：后台上传 OSS 并写回 ossUrl。
 */
export function scheduleCanvasVideoUpload(
  args: ScheduleCanvasVideoUploadArgs,
): void {
  const previewBlobUrl = args.previewBlobUrl;
  const base = args.base?.trim();
  if (!base) {
    args.updateNodeData(args.nodeId, {
      uploading: false,
      uploadError: "画布未就绪，请刷新后重试",
    });
    return;
  }

  const uploadPromise = (async () => {
    const ossUrl = await uploadCanvasVideo(base, args.file);
    args.updateNodeData(args.nodeId, {
      runtime: {
        status: "done",
        ossUrl,
        ephemeralUrl: undefined,
        failCode: undefined,
        failMessage: undefined,
      },
      aspectRatio: "auto",
      mediaAspectPreset: "",
      uploading: false,
      uploadError: undefined,
    });
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    fitLibtvUploadedVideoNaturalSize(args.nodeId, ossUrl);
  })().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    args.updateNodeData(args.nodeId, {
      uploading: false,
      uploadError: msg,
    });
    args.onUploadError?.(msg);
  });

  trackCanvasImageUpload(args.nodeId, uploadPromise, () => {
    args.updateNodeData(args.nodeId, {
      uploading: false,
      uploadError: `上传超时（${Math.round(CANVAS_IMAGE_UPLOAD_STALE_MS / 1000)}s），请重试`,
    });
    args.onUploadError?.("上传超时");
  });
  scheduleCanvasStructurePersistAfterPaste();
}

export function canvasVideoPreviewLabel(file: File, fallback = "视频"): string {
  return file.name.replace(/\.[^.]+$/, "") || fallback;
}
