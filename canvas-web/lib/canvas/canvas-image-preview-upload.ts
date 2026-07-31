import { uploadCanvasImage } from "@/lib/canvas-api";

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
 * 节点已写入 blobUrl 后调用：可选后台 refine 预览，异步上传原始 bytes 至 OSS。
 * 与 sbv1 Dock 粘贴一致——预览可客户端规范化，上传仍交服务端 sharp。
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

  void uploadCanvasImage(base, args.file)
    .then((ossUrl) => {
      args.updateNodeData(args.nodeId, { ossUrl, uploading: false });
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      args.updateNodeData(args.nodeId, {
        uploading: false,
        uploadError: msg,
      });
      args.onUploadError?.(msg);
    });
}

export function canvasImagePreviewLabel(file: File, fallback = "图片"): string {
  return file.name.replace(/\.[^.]+$/, "") || fallback;
}
