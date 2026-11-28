export type ImageEditorOutpaintRatioId =
  | "original"
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

export const IMAGE_EDITOR_OUTPAINT_RATIO_TILES: Array<{
  id: ImageEditorOutpaintRatioId;
  label: string;
  previewW: number;
  previewH: number;
}> = [
  { id: "original", label: "原比例", previewW: 4, previewH: 3 },
  { id: "1:1", label: "1:1", previewW: 1, previewH: 1 },
  { id: "3:2", label: "3:2", previewW: 3, previewH: 2 },
  { id: "2:3", label: "2:3", previewW: 2, previewH: 3 },
  { id: "4:3", label: "4:3", previewW: 4, previewH: 3 },
  { id: "3:4", label: "3:4", previewW: 3, previewH: 4 },
  { id: "16:9", label: "16:9", previewW: 16, previewH: 9 },
  { id: "9:16", label: "9:16", previewW: 9, previewH: 16 },
];

export const IMAGE_EDITOR_OUTPAINT_SCALE_MIN = 100;
export const IMAGE_EDITOR_OUTPAINT_SCALE_MAX = 300;
export const IMAGE_EDITOR_OUTPAINT_SCALE_DEFAULT = 125;

export const IMAGE_EDITOR_OUTPAINT_MODEL = "image-out-painting";

export function clampOutpaintScalePercent(value: number): number {
  return Math.min(IMAGE_EDITOR_OUTPAINT_SCALE_MAX, Math.max(IMAGE_EDITOR_OUTPAINT_SCALE_MIN, Math.round(value) || 100));
}

export function buildImageEditorOutpaintParameters(
  ratioId: ImageEditorOutpaintRatioId,
  scalePercent: number,
): Record<string, unknown> {
  const limit_image_size = true;
  if (ratioId === "original") {
    const s = clampOutpaintScalePercent(scalePercent) / 100;
    return {
      expand_mode: "scale",
      x_scale: s,
      y_scale: s,
      limit_image_size,
    };
  }
  return {
    expand_mode: "ratio",
    output_ratio: ratioId,
    angle: "0",
    limit_image_size,
  };
}

function parseRatioPair(ratio: string): [number, number] {
  const [a, b] = ratio.split(":").map((x) => Number(x));
  if (!a || !b) return [1, 1];
  return [a, b];
}

/** 预览区：外框为扩图后画布，内框为原图尺寸（居中）。 */
export function computeImageEditorOutpaintPreviewLayout(
  naturalW: number,
  naturalH: number,
  ratioId: ImageEditorOutpaintRatioId,
  scalePercent: number,
): { frameW: number; frameH: number; imgW: number; imgH: number } {
  if (naturalW <= 0 || naturalH <= 0) {
    return { frameW: 1, frameH: 1, imgW: 1, imgH: 1 };
  }
  const scale = clampOutpaintScalePercent(scalePercent) / 100;
  if (ratioId === "original") {
    return {
      frameW: naturalW * scale,
      frameH: naturalH * scale,
      imgW: naturalW,
      imgH: naturalH,
    };
  }
  const [rw, rh] = parseRatioPair(ratioId);
  const targetAspect = rw / rh;
  const imageAspect = naturalW / naturalH;
  let frameW: number;
  let frameH: number;
  if (targetAspect >= imageAspect) {
    frameH = naturalH;
    frameW = frameH * targetAspect;
  } else {
    frameW = naturalW;
    frameH = frameW / targetAspect;
  }
  frameW *= scale;
  frameH *= scale;
  return { frameW, frameH, imgW: naturalW, imgH: naturalH };
}