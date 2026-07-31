import { uploadCanvasImage } from "@/lib/canvas-api";

import {
  CANVAS_IMAGE_UPLOAD_STALE_MS,
  scheduleCanvasStructurePersistAfterPaste,
  trackCanvasImageUpload,
} from "./canvas-pending-image-uploads";
import {
  compressImageFileForUpload,
  ensureCanvasUploadFileMeta,
  normalizeCanvasImageFile,
} from "./normalize-canvas-image-file";

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

const COMPRESS_TIMEOUT_MS = 20_000;

function rejectAfterMs(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(label)), ms);
  });
}

async function resolveUploadFile(file: File): Promise<File> {
  const fallback = ensureCanvasUploadFileMeta(file);
  try {
    return await Promise.race([
      compressImageFileForUpload(file),
      rejectAfterMs(COMPRESS_TIMEOUT_MS, "compress_timeout"),
    ]);
  } catch {
    return fallback;
  }
}

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

  const uploadPromise = (async () => {
    const uploadFile = await resolveUploadFile(args.file);
    const ossUrl = await uploadCanvasImage(base, uploadFile);
    args.updateNodeData(args.nodeId, {
      ossUrl,
      uploading: false,
      blobUrl: undefined,
      uploadError: undefined,
      mediaFit: true,
      mediaFitKey: `image|${ossUrl}|sbv1-media`,
    });
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

export function canvasImagePreviewLabel(file: File, fallback = "图片"): string {
  return file.name.replace(/\.[^.]+$/, "") || fallback;
}
