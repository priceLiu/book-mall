/** 将自然像素 bbox 转为万相/擦除用的黑白蒙版 data URL */
export function bboxToMaskDataUrl(
  bbox: [number, number, number, number],
  naturalW: number,
  naturalH: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = naturalW;
  canvas.height = naturalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建蒙版画布");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, naturalW, naturalH);
  ctx.fillStyle = "#ffffff";

  const x1 = Math.max(0, Math.min(bbox[0], bbox[2]));
  const y1 = Math.max(0, Math.min(bbox[1], bbox[3]));
  const x2 = Math.min(naturalW, Math.max(bbox[0], bbox[2]));
  const y2 = Math.min(naturalH, Math.max(bbox[1], bbox[3]));
  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);
  ctx.fillRect(x1, y1, w, h);
  return canvas.toDataURL("image/png");
}
