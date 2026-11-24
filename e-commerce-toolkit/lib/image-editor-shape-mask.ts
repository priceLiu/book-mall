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

/** 在已有 ctx.save() 内调用：按形状裁剪，随后可继续绘制 */
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