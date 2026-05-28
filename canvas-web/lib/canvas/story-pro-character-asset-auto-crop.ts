/**
 * 标准三视图（左正 / 中侧 / 右背横排）→ 脸 / 全身 / 服装 裁切区域（相对坐标 0–1）
 */
import type { StoryProAssetRefKind } from "@/lib/canvas/story-pro-character-asset-catalog";

export type AutoCropSlotKind = Extract<
  StoryProAssetRefKind,
  "face" | "full_body" | "outfit"
>;

export const THREE_VIEW_AUTO_CROP_REGIONS: Record<
  AutoCropSlotKind,
  { x: number; y: number; w: number; h: number; label: string }
> = {
  /** 正面列 · 上半身（脸/发型） */
  face: { x: 0, y: 0, w: 1 / 3, h: 0.42, label: "脸（正面上部）" },
  /** 正面列 · 全身 */
  full_body: { x: 0, y: 0, w: 1 / 3, h: 1, label: "全身（正面）" },
  /** 正面列 · 躯干服装 */
  outfit: { x: 0.02, y: 0.34, w: 1 / 3 - 0.04, h: 0.38, label: "服装（正面躯干）" },
};

async function loadImageForCrop(
  url: string,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    }
  } catch {
    /* fallback */
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () =>
      reject(
        new Error(
          "无法读取三视图图片（可能被跨域拦截）。请稍后重试，或手动上传脸/全身/服装。",
        ),
      );
    img.src = url;
  });
}

function cropRegionToBlob(
  source: CanvasImageSource,
  imgW: number,
  imgH: number,
  region: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  const sx = Math.max(0, Math.round(region.x * imgW));
  const sy = Math.max(0, Math.round(region.y * imgH));
  const sw = Math.min(imgW - sx, Math.max(1, Math.round(region.w * imgW)));
  const sh = Math.min(imgH - sy, Math.max(1, Math.round(region.h * imgH)));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas 不可用"));
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("裁切导出失败")),
      "image/jpeg",
      0.92,
    );
  });
}

/** 从三视图 URL 裁出脸 / 全身 / 服装三张 JPEG */
export async function cropThreeViewToSlotBlobs(
  threeViewUrl: string,
): Promise<Record<AutoCropSlotKind, Blob>> {
  const { source, width, height } = await loadImageForCrop(threeViewUrl);
  const kinds = Object.keys(THREE_VIEW_AUTO_CROP_REGIONS) as AutoCropSlotKind[];
  const out = {} as Record<AutoCropSlotKind, Blob>;
  for (const kind of kinds) {
    out[kind] = await cropRegionToBlob(
      source,
      width,
      height,
      THREE_VIEW_AUTO_CROP_REGIONS[kind],
    );
  }
  return out;
}
