/** 宫格单元 · 像素裁切矩形（与 canvas / sharp 共用算法） */

export function gridSplitCellExtractRect(
  imgW: number,
  imgH: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
): { left: number; top: number; width: number; height: number } {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const cl = Math.max(0, Math.min(c - 1, Math.floor(col)));
  const rw = Math.max(0, Math.min(r - 1, Math.floor(row)));
  const w = imgW;
  const h = imgH;
  const regionX = cl / c;
  const regionY = rw / r;
  const regionW = 1 / c;
  const regionH = 1 / r;
  const left = Math.max(0, Math.round(regionX * w));
  const top = Math.max(0, Math.round(regionY * h));
  const width = Math.min(w - left, Math.max(1, Math.round(regionW * w)));
  const height = Math.min(h - top, Math.max(1, Math.round(regionH * h)));
  return { left, top, width, height };
}

export function gridSplitCellAspectRatio(
  imgW: number,
  imgH: number,
  cols: number,
  rows: number,
): number {
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  return imgW / c / (imgH / r);
}
