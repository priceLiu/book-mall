import type { ImageEditorShapeMaskId } from "@/lib/image-editor-shape-catalog";

export type ImageEditorTransform = {
  canvasW: number;
  canvasH: number;
  rotateDeg: number;
  flipH: boolean;
  flipV: boolean;
  shapeMask: ImageEditorShapeMaskId;
  fitInside: boolean;
  filterStyle?: string;
};

export function normalizeRotateDeg(deg: number): number {
  const d = ((deg % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

export function stepRotateDeg(deg: number, delta: number): number {
  return normalizeRotateDeg(deg + delta);
}