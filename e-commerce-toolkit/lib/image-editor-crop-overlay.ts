/** 舞台容器按原图等比缩放到 max 长边 */
export function imageEditorStageSizeFromNatural(
  naturalW: number,
  naturalH: number,
  maxEdge = 900,
): { width: number; height: number } {
  const w = Math.max(1, naturalW);
  const h = Math.max(1, naturalH);
  const edge = Math.max(w, h);
  const scale = Math.min(1, maxEdge / edge);
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

/**
 * 固定底图 object-contain 后，裁切框在画面上的位置与大小（随 canvasW/H 变，图不动）。
 */
export function imageEditorCropOverlayLayout(
  naturalW: number,
  naturalH: number,
  canvasW: number,
  canvasH: number,
  stageW: number,
  stageH: number,
  fitInside: boolean,
): { left: number; top: number; width: number; height: number } {
  const nw = Math.max(1, naturalW);
  const nh = Math.max(1, naturalH);
  const cw = Math.max(1, canvasW);
  const ch = Math.max(1, canvasH);

  const imgScale = Math.min(stageW / nw, stageH / nh);
  const imgW = nw * imgScale;
  const imgH = nh * imgScale;
  const imgLeft = (stageW - imgW) / 2;
  const imgTop = (stageH - imgH) / 2;

  const cropAspect = cw / ch;
  const imgAspect = nw / nh;

  let boxW = imgW;
  let boxH = imgH;

  if (!fitInside) {
    if (cropAspect >= imgAspect) {
      boxW = imgW;
      boxH = imgW / cropAspect;
      if (boxH > imgH) {
        boxH = imgH;
        boxW = boxH * cropAspect;
      }
    } else {
      boxH = imgH;
      boxW = imgH * cropAspect;
      if (boxW > imgW) {
        boxW = imgW;
        boxH = boxW / cropAspect;
      }
    }
  }

  return {
    left: imgLeft + (imgW - boxW) / 2,
    top: imgTop + (imgH - boxH) / 2,
    width: boxW,
    height: boxH,
  };
}

export function frameScaleFromCropBox(
  cropBox: HTMLElement | null,
  canvasW: number,
  canvasH: number,
): { sx: number; sy: number } {
  if (!cropBox) return { sx: 1, sy: 1 };
  const rect = cropBox.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { sx: 1, sy: 1 };
  return { sx: canvasW / rect.width, sy: canvasH / rect.height };
}