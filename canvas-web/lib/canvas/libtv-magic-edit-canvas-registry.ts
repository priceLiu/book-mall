"use client";

import type { ImageLocalEditCanvasHandle } from "@/components/canvas/inpaint/image-local-edit-canvas";
import type { ImageCropCanvasHandle } from "@/components/canvas/inpaint/image-crop-canvas";
import type { ImageExpandCanvasHandle } from "@/components/canvas/inpaint/image-expand-canvas";

const selectionRegistry = new Map<string, ImageLocalEditCanvasHandle>();
const cropRegistry = new Map<string, ImageCropCanvasHandle>();
const expandRegistry = new Map<string, ImageExpandCanvasHandle>();

export function registerInpaintCanvas(
  nodeId: string,
  handle: ImageLocalEditCanvasHandle,
): () => void {
  selectionRegistry.set(nodeId, handle);
  return () => {
    if (selectionRegistry.get(nodeId) === handle) selectionRegistry.delete(nodeId);
  };
}

export function getInpaintCanvasHandle(
  nodeId: string,
): ImageLocalEditCanvasHandle | undefined {
  return selectionRegistry.get(nodeId);
}

export function registerCropCanvas(
  nodeId: string,
  handle: ImageCropCanvasHandle,
): () => void {
  cropRegistry.set(nodeId, handle);
  return () => {
    if (cropRegistry.get(nodeId) === handle) cropRegistry.delete(nodeId);
  };
}

export function getCropCanvasHandle(
  nodeId: string,
): ImageCropCanvasHandle | undefined {
  return cropRegistry.get(nodeId);
}

export function registerExpandCanvas(
  nodeId: string,
  handle: ImageExpandCanvasHandle,
): () => void {
  expandRegistry.set(nodeId, handle);
  return () => {
    if (expandRegistry.get(nodeId) === handle) expandRegistry.delete(nodeId);
  };
}

export function getExpandCanvasHandle(
  nodeId: string,
): ImageExpandCanvasHandle | undefined {
  return expandRegistry.get(nodeId);
}
