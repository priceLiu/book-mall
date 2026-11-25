import type { ImageEditorAdjustTab, ImageEditorToolId } from "@/lib/image-editor-types";
import type { ImageEditorShapeMaskId } from "@/lib/image-editor-shape-catalog";

export const IMAGE_EDITOR_SESSION_KEY = "ecom-image-editor-session-v1";
export const IMAGE_EDITOR_SESSION_IMAGE_MAX = 4 * 1024 * 1024;

export type ImageEditorSessionSnapshot = {
  v: 1;
  tool: ImageEditorToolId;
  adjustTab: ImageEditorAdjustTab;
  canvasW: number;
  canvasH: number;
  rotateDeg: number;
  flipH: boolean;
  flipV: boolean;
  shapeMask: ImageEditorShapeMaskId;
  losslessResize: boolean;
  lockAspect: boolean;
  correctionOpen: boolean;
  brightness: number;
  contrast: number;
  saturate: number;
  erasePrompt: string;
  correctVertical?: number;
  correctHorizontal?: number;
  correctCenter?: number;
  correctRotate?: number;
  imageUrl: string | null;
  imageOmitted?: boolean;
  textOverlayJson?: string | null;
  textExtrasJson?: string | null;
  selectedTextLayerId?: string | null;
};

export function readImageEditorSession(): ImageEditorSessionSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(IMAGE_EDITOR_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImageEditorSessionSnapshot;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeImageEditorSession(snapshot: ImageEditorSessionSnapshot): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const json = JSON.stringify(snapshot);
    if (json.length > IMAGE_EDITOR_SESSION_IMAGE_MAX * 1.35) {
      const slim: ImageEditorSessionSnapshot = {
        ...snapshot,
        imageUrl: null,
        imageOmitted: true,
      };
      sessionStorage.setItem(IMAGE_EDITOR_SESSION_KEY, JSON.stringify(slim));
      return;
    }
    sessionStorage.setItem(IMAGE_EDITOR_SESSION_KEY, json);
  } catch {
    try {
      const slim: ImageEditorSessionSnapshot = {
        ...snapshot,
        imageUrl: null,
        imageOmitted: true,
      };
      sessionStorage.setItem(IMAGE_EDITOR_SESSION_KEY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }
}

export async function persistableImageUrl(src: string): Promise<{
  url: string | null;
  omitted: boolean;
}> {
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    if (src.length <= IMAGE_EDITOR_SESSION_IMAGE_MAX) {
      return { url: src, omitted: false };
    }
    return { url: null, omitted: true };
  }
  if (src.startsWith("blob:")) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      if (dataUrl.length <= IMAGE_EDITOR_SESSION_IMAGE_MAX) {
        return { url: dataUrl, omitted: false };
      }
      return { url: null, omitted: true };
    } catch {
      return { url: null, omitted: true };
    }
  }
  return { url: src, omitted: false };
}