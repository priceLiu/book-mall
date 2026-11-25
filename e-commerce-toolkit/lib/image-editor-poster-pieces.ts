/** 把一张卖点贴纸拆成可单独移动的块。拼回去时位置仍按原图像素。 */

export const IMAGE_EDITOR_POSTER_EM = 7.2;

export type PosterPieceRect = { x: number; y: number; w: number; h: number };

export type ImageEditorPosterPiece = PosterPieceRect & {
  src: string;
  imgW: number;
  imgH: number;
};

const NEAR_WHITE = 242;

function isBackgroundPixel(pixels: Uint8ClampedArray, offset: number): boolean {
  if (pixels[offset + 3] < 16) return true;
  return pixels[offset] > NEAR_WHITE && pixels[offset + 1] > NEAR_WHITE && pixels[offset + 2] > NEAR_WHITE;
}

/** 从四周把透明和近白底挖掉，剩下的是勾、字和色块。 */
function backgroundMask(width: number, height: number, pixels: Uint8ClampedArray): Uint8Array {
  const bg = new Uint8Array(width * height);
  const queue: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (bg[p] || !isBackgroundPixel(pixels, p * 4)) return;
    bg[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x += 1) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (queue.length) {
    const p = queue.pop() as number;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0 && !bg[p - 1] && isBackgroundPixel(pixels, (p - 1) * 4)) {
      bg[p - 1] = 1;
      queue.push(p - 1);
    }
    if (x + 1 < width && !bg[p + 1] && isBackgroundPixel(pixels, (p + 1) * 4)) {
      bg[p + 1] = 1;
      queue.push(p + 1);
    }
    if (y > 0 && !bg[p - width] && isBackgroundPixel(pixels, (p - width) * 4)) {
      bg[p - width] = 1;
      queue.push(p - width);
    }
    if (y + 1 < height && !bg[p + width] && isBackgroundPixel(pixels, (p + width) * 4)) {
      bg[p + width] = 1;
      queue.push(p + width);
    }
  }
  return bg;
}

function rowBands(width: number, height: number, pixels: Uint8ClampedArray, bg: Uint8Array): Array<[number, number]> {
  const rows = new Int32Array(height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (!bg[p] && pixels[p * 4 + 3] >= 16) rows[y] += 1;
    }
  }
  let y0 = 0;
  while (y0 < height && rows[y0] === 0) y0 += 1;
  let y1 = height - 1;
  while (y1 > y0 && rows[y1] === 0) y1 -= 1;
  if (y0 > y1) return [[0, height - 1]];
  const minGap = Math.max(3, Math.round((y1 - y0 + 1) * 0.045));
  const bands: Array<[number, number]> = [];
  let start = -1;
  for (let y = y0; y <= y1; y += 1) {
    if (rows[y] > 0) {
      if (start < 0) start = y;
      continue;
    }
    if (start < 0) continue;
    let gapEnd = y;
    while (gapEnd <= y1 && rows[gapEnd] === 0) gapEnd += 1;
    if (gapEnd - y >= minGap || gapEnd > y1) {
      bands.push([start, y - 1]);
      start = gapEnd > y1 ? -1 : gapEnd;
      y = gapEnd - 1;
    }
  }
  if (start >= 0) bands.push([start, y1]);
  return bands.length ? bands : [[y0, y1]];
}

/** 一行里如果勾和文字之间有空档，就左右切开。切片铺满这一行，拼回去不丢白底。 */
function splitBand(
  width: number,
  pixels: Uint8ClampedArray,
  bg: Uint8Array,
  y0: number,
  y1: number,
): PosterPieceRect[] {
  const height = y1 - y0 + 1;
  const full: PosterPieceRect = { x: 0, y: y0, w: width, h: height };
  const cols = new Int32Array(width);
  let minX = width;
  let maxX = -1;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (bg[p] || pixels[p * 4 + 3] < 16) continue;
      cols[x] += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < minX) return [full];
  const span = maxX - minX + 1;
  const gaps: { x: number; len: number }[] = [];
  let gapStart = -1;
  for (let x = minX; x <= maxX; x += 1) {
    if (cols[x] === 0) {
      if (gapStart < 0) gapStart = x;
    } else if (gapStart >= 0) {
      gaps.push({ x: gapStart, len: x - gapStart });
      gapStart = -1;
    }
  }
  const zone = gaps.filter((gap) => {
    const at = (gap.x - minX) / span;
    return gap.len >= 4 && at >= 0.08 && at <= 0.46;
  });
  if (!zone.length || span < 24) return [full];
  const widest = Math.max(...zone.map((gap) => gap.len));
  const chosen = zone.filter((gap) => gap.len >= widest * 0.75).sort((a, b) => a.x - b.x)[0];
  const cut = chosen.x + Math.floor(chosen.len / 2);
  if (cut < 8 || width - cut < 8) return [full];
  return [
    { x: 0, y: y0, w: cut, h: height },
    { x: cut, y: y0, w: width - cut, h: height },
  ];
}

/** 没有空档的单块，按左侧低密度处切开，保证能取消组合。 */
function forceSplit(
  width: number,
  pixels: Uint8ClampedArray,
  bg: Uint8Array,
  rect: PosterPieceRect,
): PosterPieceRect[] {
  const cols = new Int32Array(width);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const p = y * width + x;
      if (!bg[p] && pixels[p * 4 + 3] >= 16) cols[x] += 1;
    }
  }
  const from = rect.x + Math.max(6, Math.round(rect.w * 0.12));
  const to = rect.x + Math.min(rect.w - 7, Math.round(rect.w * 0.42));
  let cut = rect.x + Math.round(rect.w * 0.28);
  let best = Number.POSITIVE_INFINITY;
  if (to > from) {
    for (let x = from; x <= to; x += 1) {
      if (cols[x] < best) {
        best = cols[x];
        cut = x;
      }
    }
  }
  const left = { x: rect.x, y: rect.y, w: Math.max(8, cut - rect.x), h: rect.h };
  const rightX = left.x + left.w;
  const right = { x: rightX, y: rect.y, w: rect.x + rect.w - rightX, h: rect.h };
  if (right.w < 8) return [rect];
  return [left, right];
}

/** 行与行之间的空白对半切开，上下两块接在一起仍是原图。 */
function tileRowBands(height: number, bands: Array<[number, number]>): Array<[number, number]> {
  if (!bands.length) return [[0, Math.max(0, height - 1)]];
  const tiles: Array<[number, number]> = [];
  let cursor = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const y1 =
      index === bands.length - 1 ? height - 1 : Math.floor((bands[index][1] + bands[index + 1][0]) / 2);
    if (y1 >= cursor) tiles.push([cursor, y1]);
    cursor = y1 + 1;
  }
  return tiles.length ? tiles : [[0, height - 1]];
}

export function posterPieceRects(width: number, height: number, pixels: Uint8ClampedArray): PosterPieceRect[] {
  if (width < 2 || height < 2 || pixels.length < width * height * 4) {
    return [{ x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height) }];
  }
  const bg = backgroundMask(width, height, pixels);
  const pieces = tileRowBands(height, rowBands(width, height, pixels, bg)).flatMap(([y0, y1]) =>
    splitBand(width, pixels, bg, y0, y1),
  );
  if (pieces.length >= 2) return pieces;
  return forceSplit(width, pixels, bg, { x: 0, y: 0, w: width, h: height });
}

export type SellingPosterIconBox = { x: number; y: number; w: number; h: number };

export type SellingPosterIcon = SellingPosterIconBox & { src: string };

export type SellingPosterRow = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 有底色条时才画色块 */
  bar: boolean;
  barColor: string;
  textColor: string;
  pill: boolean;
  icon: SellingPosterIcon | null;
};

export type SellingPosterDraft = Omit<SellingPosterRow, "icon"> & { icon: SellingPosterIconBox | null };

export type SellingPosterModel = {
  imgW: number;
  imgH: number;
  rows: SellingPosterRow[];
};

function hexColor(r: number, g: number, b: number): string {
  const part = (n: number) => n.toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function colorDist(r: number, g: number, b: number, rgb: [number, number, number]): number {
  return Math.abs(r - rgb[0]) + Math.abs(g - rgb[1]) + Math.abs(b - rgb[2]);
}

/** 每一行拆成色块、勾和文字的位置。文字本身不进图片。 */
export function analyzeSellingPoster(width: number, height: number, pixels: Uint8ClampedArray): SellingPosterDraft[] {
  if (width < 2 || height < 2) return [];
  const bg = backgroundMask(width, height, pixels);
  const bands = rowBands(width, height, pixels, bg);
  const rows = bands.length ? bands : ([[0, height - 1]] as Array<[number, number]>);
  return rows.map(([y0, y1]) => {
    const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
    let minX = width;
    let maxX = -1;
    let minY = y1;
    let maxY = y0;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x;
        const o = p * 4;
        if (bg[p] || pixels[o + 3] < 16) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const r = pixels[o] >> 4;
        const g = pixels[o + 1] >> 4;
        const b = pixels[o + 2] >> 4;
        const key = (r << 8) | (g << 4) | b;
        const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        bin.n += 1;
        bin.r += pixels[o];
        bin.g += pixels[o + 1];
        bin.b += pixels[o + 2];
        bins.set(key, bin);
      }
    }
    if (maxX < minX) {
      return {
        x: 0,
        y: y0,
        w: width,
        h: y1 - y0 + 1,
        bar: false,
        barColor: "#f5c451",
        textColor: "#1d1d1f",
        pill: false,
        icon: null,
      };
    }
    let top: { n: number; r: number; g: number; b: number } | null = null;
    for (const bin of bins.values()) if (!top || bin.n > top.n) top = bin;
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const fill = top ? top.n / Math.max(1, boxW * boxH) : 0;
    const barRgb: [number, number, number] = top
      ? [Math.round(top.r / top.n), Math.round(top.g / top.n), Math.round(top.b / top.n)]
      : [245, 196, 81];
    const barLum = (barRgb[0] * 3 + barRgb[1] * 6 + barRgb[2]) / 10;
    const bar = Boolean(top && fill > 0.38 && boxW > 24 && barLum < 235);
    const cols = new Int32Array(width);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const o = (y * width + x) * 4;
        if (pixels[o + 3] < 16 || bg[y * width + x]) continue;
        cols[x] += 1;
      }
    }
    const gaps: { x: number; len: number }[] = [];
    let gapStart = -1;
    for (let x = minX; x <= maxX; x += 1) {
      if (cols[x] === 0) {
        if (gapStart < 0) gapStart = x;
      } else if (gapStart >= 0) {
        gaps.push({ x: gapStart, len: x - gapStart });
        gapStart = -1;
      }
    }
    const span = boxW;
    const zone = gaps.filter((gap) => gap.len >= 4 && (gap.x - minX) / span >= 0.08 && (gap.x - minX) / span <= 0.46);
    const cut = zone.length
      ? zone.sort((a, b) => b.len - a.len || a.x - b.x)[0].x
      : minX + Math.round(span * 0.28);
    let iconMinX = cut;
    let iconMaxX = minX;
    let iconMinY = maxY;
    let iconMaxY = minY;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x < cut; x += 1) {
        const o = (y * width + x) * 4;
        if (pixels[o + 3] < 16 || bg[y * width + x]) continue;
        if (bar && colorDist(pixels[o], pixels[o + 1], pixels[o + 2], barRgb) < 70) continue;
        if (x < iconMinX) iconMinX = x;
        if (x > iconMaxX) iconMaxX = x;
        if (y < iconMinY) iconMinY = y;
        if (y > iconMaxY) iconMaxY = y;
      }
    }
    const icon =
      iconMaxX > iconMinX && iconMaxY > iconMinY
        ? { x: iconMinX, y: iconMinY, w: iconMaxX - iconMinX + 1, h: iconMaxY - iconMinY + 1 }
        : boxW > 80
          ? { x: minX, y: minY, w: Math.max(12, Math.round(span * 0.22)), h: boxH }
          : null;
    let textR = 0;
    let textG = 0;
    let textB = 0;
    let textN = 0;
    const textFrom = Math.max(cut, minX + Math.round(span * 0.34));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = textFrom; x <= maxX; x += 1) {
        const o = (y * width + x) * 4;
        if (pixels[o + 3] < 16 || bg[y * width + x]) continue;
        if (bar && colorDist(pixels[o], pixels[o + 1], pixels[o + 2], barRgb) < 70) continue;
        textR += pixels[o];
        textG += pixels[o + 1];
        textB += pixels[o + 2];
        textN += 1;
      }
    }
    const lum = (barRgb[0] * 3 + barRgb[1] * 6 + barRgb[2]) / 10;
    const textColor = textN > 8 ? hexColor(Math.round(textR / textN), Math.round(textG / textN), Math.round(textB / textN)) : lum > 170 ? "#1d1d1f" : "#ffffff";
    return {
      x: minX,
      y: minY,
      w: boxW,
      h: boxH,
      bar,
      barColor: hexColor(barRgb[0], barRgb[1], barRgb[2]),
      textColor,
      pill: bar && boxH / boxW < 0.55,
      icon,
    };
  });
}

function loadPosterImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("poster"));
    image.src = src;
  });
}

/** 读本地贴纸，按空档拆成至少两块，每块是一张小图。 */
export async function splitImageEditorPoster(src: string): Promise<ImageEditorPosterPiece[]> {
  const image = await loadPosterImage(src);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 2 || height < 2) return [];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return posterPieceRects(width, height, pixels).map((rect) => {
    const crop = document.createElement("canvas");
    crop.width = rect.w;
    crop.height = rect.h;
    const cropCtx = crop.getContext("2d");
    cropCtx?.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    return { ...rect, src: crop.toDataURL("image/png"), imgW: width, imgH: height };
  });
}

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 卖点贴纸拆成可编辑的色块、勾和文字。勾单独抠出来。 */
export async function buildSellingPosterGroup(src: string): Promise<SellingPosterModel | null> {
  const image = await loadPosterImage(src);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 2 || height < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const drafts = analyzeSellingPoster(width, height, pixels);
  const rows: SellingPosterRow[] = drafts.map((row) => {
    if (!row.icon) return { ...row, icon: null };
    const icon = row.icon;
    const crop = document.createElement("canvas");
    crop.width = icon.w;
    crop.height = icon.h;
    const cropCtx = crop.getContext("2d");
    if (!cropCtx) return { ...row, icon: null };
    cropCtx.drawImage(canvas, icon.x, icon.y, icon.w, icon.h, 0, 0, icon.w, icon.h);
    const barRgb = parseHex(row.barColor);
    const bitmap = cropCtx.getImageData(0, 0, icon.w, icon.h);
    const data = bitmap.data;
    const barLum = (barRgb[0] * 3 + barRgb[1] * 6 + barRgb[2]) / 10;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const nearBar = row.bar && colorDist(data[i], data[i + 1], data[i + 2], barRgb) < 70;
      const nearWhite = data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242 && barLum > 170;
      if (nearBar || nearWhite) data[i + 3] = 0;
    }
    cropCtx.putImageData(bitmap, 0, 0);
    return { ...row, icon: { ...icon, src: crop.toDataURL("image/png") } };
  });
  return { imgW: width, imgH: height, rows };
}
