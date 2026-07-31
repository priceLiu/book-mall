import { uploadCanvasImage } from "@/lib/canvas-api";

import { trackCanvasImageUpload } from "./canvas-pending-image-uploads";
import { normalizeCanvasImageFile } from "./normalize-canvas-image-file";

export type ScheduleCanvasImageUploadArgs = {
  nodeId: string;
  file: File;
  base: string | undefined;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  /** 首帧 blob，refine 成功后 revoke */
  previewBlobUrl?: string;
  /** 后台用规范化图替换预览 blob；默认关，避免大 PNG canvas 重编码拖慢首帧 */
  refinePreview?: boolean;
  onUploadError?: (message: string) => void;
};

/**
 * 节点已写入 blobUrl 后调用：OSS 上传走独立队列（见 canvas-image-upload-lane.ts），
 * 不直接触发画布 autosave；OSS 完成后由 pending 队列 drain 合并落盘。
 */
export function scheduleCanvasImageUpload(
  args: ScheduleCanvasImageUploadArgs,
): void {
  let previewBlobUrl = args.previewBlobUrl;

  if (args.refinePreview === true) {
    void normalizeCanvasImageFile(args.file)
      .then((preview) => {
        if (preview === args.file) return;
        const refined = URL.createObjectURL(preview);
        args.updateNodeData(args.nodeId, { blobUrl: refined });
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        previewBlobUrl = refined;
      })
      .catch(() => {
        /* 保持原始 blob 预览 */
      });
  }

  const base = args.base?.trim();
  if (!base) {
    args.updateNodeData(args.nodeId, {
      uploading: false,
      uploadError: "画布未就绪，请刷新后重试",
    });
    return;
  }

  const uploadPromise = uploadCanvasImage(base, args.file)
    .then((ossUrl) => {
      args.updateNodeData(args.nodeId, {
        ossUrl,
        uploading: false,
        blobUrl: undefined,
        uploadError: undefined,
        mediaFit: true,
        // 与 useLibtvMediaNodeAutoFit 的 fitKey 对齐，避免 blob→oss 后再 probe 触发二次改图/保存
        mediaFitKey: `image|${ossUrl}|sbv1-media`,
      });
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      args.updateNodeData(args.nodeId, {
        uploading: false,
        uploadError: msg,
      });
      args.onUploadError?.(msg);
    });

  trackCanvasImageUpload(args.nodeId, uploadPromise);
}

export function canvasImagePreviewLabel(file: File, fallback = "图片"): string {
  return file.name.replace(/\.[^.]+$/, "") || fallback;
}
