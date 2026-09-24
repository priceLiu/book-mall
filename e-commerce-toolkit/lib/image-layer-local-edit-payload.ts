import { bboxToMaskDataUrl } from "@/lib/image-layer-bbox-to-mask";
import {
  isWan27RetouchModel,
  isWanxPaintingRetouchModel,
} from "@/lib/image-layer-tool-mode";

export type LocalEditSelectionPayload = {
  maskImageDataUrl?: string;
  bbox?: [number, number, number, number];
};

/**
 * 局部重绘提交时，按「当前选中的重绘模型」整理选区。
 * 不用于「框选拆层」（decompose 只走 getBboxes），也不用于图像擦除补全。
 */
export function resolveLocalEditSelectionPayload(opts: {
  model: string;
  mask?: string;
  bbox?: [number, number, number, number];
  natural?: { w: number; h: number } | null;
}): LocalEditSelectionPayload {
  if (isWan27RetouchModel(opts.model)) {
    return opts.bbox ? { bbox: opts.bbox } : {};
  }

  if (opts.mask?.trim()) {
    return { maskImageDataUrl: opts.mask.trim() };
  }

  if (opts.bbox && opts.natural && opts.natural.w > 0 && opts.natural.h > 0) {
    return {
      maskImageDataUrl: bboxToMaskDataUrl(opts.bbox, opts.natural.w, opts.natural.h),
    };
  }

  return {};
}

/**
 * 图像擦除补全（image-erase-completion）必须提交蒙版：
 * 笔刷蒙版优先；仅框选时在前端转成蒙版。
 */
export function resolveEraseSelectionPayload(opts: {
  mask?: string;
  bbox?: [number, number, number, number];
  natural?: { w: number; h: number } | null;
}): { maskDataUrl?: string } {
  if (opts.mask?.trim()) {
    return { maskDataUrl: opts.mask.trim() };
  }
  if (opts.bbox && opts.natural && opts.natural.w > 0 && opts.natural.h > 0) {
    return {
      maskDataUrl: bboxToMaskDataUrl(opts.bbox, opts.natural.w, opts.natural.h),
    };
  }
  return {};
}

export function missingLocalEditSelectionMessage(model: string): {
  title: string;
  message: string;
} {
  if (isWan27RetouchModel(model)) {
    return { title: "请框选区域", message: "万相 2.7 Pro 需要框选区域" };
  }
  if (isWanxPaintingRetouchModel(model)) {
    return { title: "请标记区域", message: "万相局部编辑需要笔刷蒙版或框选" };
  }
  return { title: "请标记区域", message: "用笔刷涂抹或框选需要处理的区域" };
}

export function missingEraseSelectionMessage(): {
  title: string;
  message: string;
} {
  return {
    title: "请标记区域",
    message: "涂抹或框选需要擦除的区域",
  };
}
