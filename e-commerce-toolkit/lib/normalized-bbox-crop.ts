import { denormalizedBboxToNatural } from "@/lib/image-layer-coords";
import { imageLayerComposeImageSrc } from "@/lib/image-layer-compose-image-src";

export function normalizedBboxToPixelRect(
  bbox: [number, number, number, number],
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const [x1, y1, x2, y2] = denormalizedBboxToNatural(bbox, width, height);
  const x = Math.max(0, Math.min(width - 1, Math.round(x1)));
  const y = Math.max(0, Math.min(height - 1, Math.round(y1)));
  const w = Math.max(1, Math.min(width - x, Math.round(x2 - x1)));
  const h = Math.max(1, Math.min(height - y, Math.round(y2 - y1)));
  return { x, y, w, h };
}

const cropCache = new Map<string, Promise<string>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return (async () => {
    const res = await fetch(src, { credentials: "include", cache: "force-cache" });
    if (!res.ok) throw new Error("加载框选预览失败");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("加载框选预览失败"));
        img.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  })();
}

/** 按原图像素裁出框选主体，避免用 0～999 宽高比把原图拉变形。 */
export function cropNormalizedBboxPreview(
  url: string,
  bbox: [number, number, number, number],
  maxEdge = 640,
): Promise<string> {
  const key = `${url}|${bbox.join(",")}|${maxEdge}`;
  const hit = cropCache.get(key);
  if (hit) return hit;

  const task = (async () => {
    const img = await loadImage(imageLayerComposeImageSrc(url));
    const rect = normalizedBboxToPixelRect(bbox, img.naturalWidth, img.naturalHeight);
    const scale = Math.min(1, maxEdge / Math.max(rect.w, rect.h));
    const cw = Math.max(1, Math.round(rect.w * scale));
    const ch = Math.max(1, Math.round(rect.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法裁切框选预览");
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, cw, ch);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) throw new Error("无法裁切框选预览");
    return URL.createObjectURL(blob);
  })();

  cropCache.set(key, task);
  task.catch(() => {
    cropCache.delete(key);
  });
  return task;
}
