import {
  getImageEditorShapeDef,
  svgMaskDataUrl,
  type ImageEditorShapeMaskId,
} from "@/lib/image-editor-shape-catalog";

export type { ImageEditorShapeMaskId } from "@/lib/image-editor-shape-catalog";
export {
  IMAGE_EDITOR_SHAPE_CATALOG,
  IMAGE_EDITOR_SHAPE_MASK_ORDER,
  getImageEditorShapeDef,
} from "@/lib/image-editor-shape-catalog";

/** 与预览 SVG `preserveAspectRatio="xMidYMid meet"` 相同的形状裁切 */
export function clipPathForImageEditorShapeMeet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shape: ImageEditorShapeMaskId,
) {
  if (shape === "none") return;
  const def = getImageEditorShapeDef(shape);
  if (!def?.pathD) return;
  const s = Math.min(w / 100, h / 100);
  ctx.translate((w - 100 * s) / 2, (h - 100 * s) / 2);
  ctx.scale(s, s);
  ctx.clip(new Path2D(def.pathD));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** 铺满画布拉伸形状（非预览路径） */
export function clipPathForImageEditorShape(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shape: ImageEditorShapeMaskId,
) {
  if (shape === "none") return;
  const def = getImageEditorShapeDef(shape);
  if (!def?.pathD) return;
  ctx.scale(w / 100, h / 100);
  ctx.clip(new Path2D(def.pathD));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** 预览用 CSS mask（与导出蒙版一致） */
export function cssMaskStyleForImageEditorShape(
  shape: ImageEditorShapeMaskId,
): { maskImage: string; WebkitMaskImage: string } | undefined {
  if (shape === "none") return undefined;
  const def = getImageEditorShapeDef(shape);
  if (!def?.pathD) return undefined;
  const url = svgMaskDataUrl(def.pathD);
  return { maskImage: url, WebkitMaskImage: url };
}

/** @deprecated 使用 cssMaskStyleForImageEditorShape */
export function cssClipPathForImageEditorShape(shape: ImageEditorShapeMaskId): string | undefined {
  void shape;
  return undefined;
}