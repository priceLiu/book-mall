import sharp from "sharp";

import { bboxTag } from "@/lib/ecom/ecom-image-layer-prompt";

/** 百炼万相 · 图像背景生成（换场景）。须先抠出真透明主体。 */
export const WANX_BACKGROUND_GENERATION_MODEL = "wanx-background-generation-v2";
/** 火山 Seedream 5.0 Pro · 原图整图换景（可框选或纯提示词）。 */
export const SEEDREAM_BACKGROUND_REPLACE_MODEL = "doubao-seedream-5-0-pro";

export const BACKGROUND_REPLACE_MODEL_KEYS = [
  SEEDREAM_BACKGROUND_REPLACE_MODEL,
] as const;

export type BackgroundReplaceModelKey =
  (typeof BACKGROUND_REPLACE_MODEL_KEYS)[number];

export function isWanxBackgroundReplaceModel(modelKey: string): boolean {
  return modelKey.trim() === WANX_BACKGROUND_GENERATION_MODEL;
}

export function isSeedreamBackgroundReplaceModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    k === SEEDREAM_BACKGROUND_REPLACE_MODEL ||
    k === "doubao-seedream-5-0-pro-260628"
  );
}

export function resolveBackgroundReplaceModel(
  modelKey?: string,
): BackgroundReplaceModelKey {
  const k = modelKey?.trim() || SEEDREAM_BACKGROUND_REPLACE_MODEL;
  if (isSeedreamBackgroundReplaceModel(k) || isWanxBackgroundReplaceModel(k)) {
    return SEEDREAM_BACKGROUND_REPLACE_MODEL;
  }
  throw new Error("换背景仅支持火山 Seedream 5.0 Pro");
}

/** `@图1框选` / `@图2框选`（官方 chip）以及兼容 `@图片1` / `@图片2`。 */
const BOX_MENTION_TEST = /@(?:图[12]框选|图片[12])/;

export function sceneUsesBackgroundReplaceMentions(scene: string): boolean {
  const text = scene.trim();
  return BOX_MENTION_TEST.test(text) || text.includes("<bbox>");
}

function expandOneBoxMention(
  kind: "1" | "2",
  token: string,
  opts: {
    bbox?: [number, number, number, number];
    refBbox?: [number, number, number, number];
  },
): string {
  if (kind === "1") {
    if (!opts.bbox) {
      throw new Error(`场景描述引用了 ${token}，请先在右侧画布框选图 1 主体`);
    }
    return `图 1 ${bboxTag(opts.bbox)}`;
  }
  if (!opts.refBbox) {
    throw new Error(`场景描述引用了 ${token}，请先在参考图上框选图 2 区域`);
  }
  return `图 2 ${bboxTag(opts.refBbox)}`;
}

/** `@图1框选` → `图 1 <bbox>…</bbox>`；`@图2框选` → `图 2 <bbox>…</bbox>`。 */
export function expandBackgroundReplaceMentions(
  scene: string,
  opts: {
    bbox?: [number, number, number, number];
    refBbox?: [number, number, number, number];
  },
): string {
  return scene.replace(/@(?:图([12])框选|图片([12]))/g, (token, a?: string, b?: string) =>
    expandOneBoxMention((a ?? b) === "2" ? "2" : "1", token, opts),
  );
}

export function buildSeedreamBackgroundReplacePrompt(opts: {
  scene?: string;
  bbox?: [number, number, number, number];
  hasRefImage?: boolean;
  refBbox?: [number, number, number, number];
}): string {
  const raw = opts.scene?.trim() ?? "";
  const hasRef = opts.hasRefImage === true;
  if (!raw && !hasRef) {
    throw new Error("请填写场景描述，或上传一张参考图");
  }

  if (sceneUsesBackgroundReplaceMentions(raw)) {
    return expandBackgroundReplaceMentions(raw, opts);
  }

  const scene = raw;
  if (hasRef && opts.bbox && opts.refBbox) {
    return `将图 1 ${bboxTag(opts.bbox)} 的主体放到图 2 ${bboxTag(opts.refBbox)} 位置${
      scene ? `，${scene}` : ""
    }`;
  }
  if (hasRef && opts.bbox) {
    const sceneBit = scene ? `替换成${scene}` : "替换成图 2 的场景";
    return `把图 1 ${bboxTag(opts.bbox)} 区域${sceneBit}，模特人物与服装完全保持不变，以图 2 为场景参考，光影与场景统一`;
  }
  if (hasRef) {
    const sceneBit = scene ? `背景换成${scene}` : "背景换成图 2 的场景";
    return `保留图 1 人物与服装完全不变，${sceneBit}，以图 2 为场景与构图参考，不要改变模特姿态和五官`;
  }
  if (opts.bbox) {
    if (!scene) throw new Error("请填写场景描述");
    return `把图 1 ${bboxTag(opts.bbox)} 区域替换成${scene}，模特人物与服装完全保持不变，光影与场景统一`;
  }
  return `保留人物与服装完全不变，背景换成${scene}，光影与场景统一，不要改变模特姿态和五官`;
}

/**
 * 万相官方：base 须 RGBA，且 longest side **小于** 2048
 *（报错：longer image size should less 2048 pixels）。
 */
export const BACKGROUND_REPLACE_MAX_LONG_EDGE = 2048;
export const BACKGROUND_REPLACE_MIN_ALPHA_RATIO = 0.01;
/** 万相要在透明区画场景；抠图假棋盘若只打出 1% 透明，看起来仍像没换。 */
export const WANX_CUTOUT_MIN_ALPHA_RATIO = 0.12;

/** JPEG / RGB PNG → RGBA PNG，并压到最长边 < 2048。 */
export async function toRgbaPngBuffer(buf: Buffer): Promise<Buffer> {
  if (!buf.byteLength) throw new Error("主体图为空");
  const maxEdge = BACKGROUND_REPLACE_MAX_LONG_EDGE - 1;
  return sharp(buf, { failOn: "none" })
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/** 万相只在透明像素上画新场景；整图 ensureAlpha 仍是全不透明，看起来就像没换。 */
export async function hasMeaningfulTransparency(
  buf: Buffer,
  minRatio = BACKGROUND_REPLACE_MIN_ALPHA_RATIO,
): Promise<boolean> {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels ?? 4;
  if (channels < 4 || !info.width || !info.height) return false;
  const total = info.width * info.height;
  let transparent = 0;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i]! < 250) transparent += 1;
  }
  return transparent / total >= minRatio;
}

/** 透明像素里是否还带着 RGB（万相有时只改了颜色、没把 alpha 填实）。 */
export async function transparentHolesHaveRgb(buf: Buffer): Promise<boolean> {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels ?? 4;
  if (channels < 4) return false;
  let holes = 0;
  let withRgb = 0;
  for (let i = 0; i < data.length; i += channels) {
    if ((data[i + 3] ?? 0) >= 250) continue;
    holes += 1;
    if ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0) > 24) {
      withRgb += 1;
    }
  }
  return holes > 0 && withRgb / holes >= 0.35;
}

export async function dropAlphaKeepRgb(buf: Buffer): Promise<Buffer> {
  return sharp(buf, { failOn: "none" }).removeAlpha().png().toBuffer();
}

/** 把残余透明洞用邻近不透明像素填实，避免换背景后还露出棋盘格。 */
export async function fillTransparentHolesFromNeighbors(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const channels = info.channels ?? 4;
  if (!width || !height || channels < 4) return buf;

  const out = Buffer.from(data);
  const queue: number[] = [];
  const seen = new Uint8Array(width * height);
  const enqueue = (x: number, y: number) => {
    const idx = y * width + x;
    if (seen[idx]) return;
    if (out[idx * channels + 3]! >= 250) return;
    seen[idx] = 1;
    queue.push(idx);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (out[i + 3]! >= 250) continue;
      let border = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (out[(ny * width + nx) * channels + 3]! >= 250) {
          border = true;
          break;
        }
      }
      if (border) enqueue(x, y);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head]!;
    head += 1;
    const x = idx % width;
    const y = Math.floor(idx / width);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = (ny * width + nx) * channels;
      if (out[ni + 3]! < 250) continue;
      r += out[ni] ?? 0;
      g += out[ni + 1] ?? 0;
      b += out[ni + 2] ?? 0;
      n += 1;
    }
    const i = idx * channels;
    if (n > 0) {
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
    }
    out[i + 3] = 255;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      enqueue(nx, ny);
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** 万相结果必须是不透明成图，不能把抠图窟窿留给画布棋盘格。 */
export async function sealWanxBackgroundResult(buf: Buffer): Promise<{
  buf: Buffer;
  needsSecondPass: boolean;
}> {
  if (!(await hasMeaningfulTransparency(buf))) {
    return { buf: await dropAlphaKeepRgb(buf), needsSecondPass: false };
  }
  if (await transparentHolesHaveRgb(buf)) {
    return { buf: await dropAlphaKeepRgb(buf), needsSecondPass: false };
  }
  return { buf, needsSecondPass: true };
}

function pixelLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pixelChroma(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function pixelIsNearWhite(r: number, g: number, b: number): boolean {
  if (r >= 228 && g >= 228 && b >= 228) return true;
  return pixelLuminance(r, g, b) >= 198;
}

function pixelIsCheckerGray(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 200 && min >= 120 && max - min <= 28;
}

/** 灰格 + qwen 常画的褐红马赛克格（不是绿/蓝衣服）。 */
function pixelIsDarkMosaicTile(r: number, g: number, b: number): boolean {
  if (pixelIsCheckerGray(r, g, b)) return true;
  const lum = pixelLuminance(r, g, b);
  const chroma = pixelChroma(r, g, b);
  if (lum < 24 || lum > 205) return false;
  if (g > r + 16 && g > b + 16 && chroma > 36) return false;
  if (b > r + 16 && b > g + 16 && chroma > 40) return false;
  return chroma <= 88;
}

function pixelIsLightBackdrop(r: number, g: number, b: number): boolean {
  return pixelIsNearWhite(r, g, b);
}

function rgbaAt(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number; i: number } {
  const i = (y * width + x) * channels;
  return {
    r: data[i] ?? 0,
    g: data[i + 1] ?? 0,
    b: data[i + 2] ?? 0,
    a: data[i + 3] ?? 0,
    i,
  };
}

const FOUR_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function hasLuminanceFlip(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  y: number,
  opts?: { opaqueOnly?: boolean },
): boolean {
  const p = rgbaAt(data, width, channels, x, y);
  const lum = pixelLuminance(p.r, p.g, p.b);
  for (const [dx, dy] of FOUR_NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const n = rgbaAt(data, width, channels, nx, ny);
    if (opts?.opaqueOnly && n.a < 250) continue;
    if (Math.abs(lum - pixelLuminance(n.r, n.g, n.b)) >= 50) return true;
  }
  return false;
}

function isMosaicDarkCell(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  y: number,
): boolean {
  const p = rgbaAt(data, width, channels, x, y);
  return (
    pixelIsDarkMosaicTile(p.r, p.g, p.b) &&
    hasLuminanceFlip(data, width, height, channels, x, y)
  );
}

function similarTileColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) <= 48;
}

/**
 * 主洪水之后，残余马赛克常与人物断开。保留最大连通域和黑鞋，其余岛打穿。
 */
function cleanupResidualMosaic(
  out: Buffer,
  width: number,
  height: number,
  channels: number,
): void {
  const total = width * height;
  const label = new Int32Array(total);
  const sizes: number[] = [0];
  const minLum: number[] = [255];
  let next = 0;
  const queue: number[] = [];

  for (let start = 0; start < total; start += 1) {
    const sx = start % width;
    const sy = Math.floor(start / width);
    const sp = rgbaAt(out, width, channels, sx, sy);
    if (sp.a < 250 || label[start] !== 0) continue;
    next += 1;
    sizes[next] = 0;
    minLum[next] = 255;
    label[start] = next;
    queue.length = 0;
    queue.push(start);
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head]!;
      head += 1;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const p = rgbaAt(out, width, channels, x, y);
      sizes[next] += 1;
      minLum[next] = Math.min(minLum[next]!, pixelLuminance(p.r, p.g, p.b));
      for (const [dx, dy] of FOUR_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (label[nidx] !== 0) continue;
        if (rgbaAt(out, width, channels, nx, ny).a < 250) continue;
        label[nidx] = next;
        queue.push(nidx);
      }
    }
  }

  let keep = 1;
  for (let i = 2; i <= next; i += 1) {
    if ((sizes[i] ?? 0) > (sizes[keep] ?? 0)) keep = i;
  }
  const drop = new Uint8Array(next + 1);
  for (let i = 1; i <= next; i += 1) {
    if (i === keep) continue;
    const darkAccessory = (minLum[i] ?? 255) <= 42;
    if (darkAccessory) continue;
    drop[i] = 1;
  }
  for (let i = 0; i < total; i += 1) {
    const id = label[i] ?? 0;
    if (id && drop[id]) out[i * channels + 3] = 0;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = rgbaAt(out, width, channels, x, y);
      if (p.a < 250) continue;
      if (
        !pixelIsDarkMosaicTile(p.r, p.g, p.b) &&
        !pixelIsLightBackdrop(p.r, p.g, p.b)
      ) {
        continue;
      }
      let holes = 0;
      for (const [dx, dy] of FOUR_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          holes += 1;
          continue;
        }
        if (rgbaAt(out, width, channels, nx, ny).a < 250) holes += 1;
      }
      if (holes >= 3) out[p.i + 3] = 0;
    }
  }
}

export type FakeBackdropKind = "none" | "solid-white" | "checkerboard" | "mosaic";

function walkEdgePixels(
  width: number,
  height: number,
  visit: (x: number, y: number) => void,
): void {
  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    visit(0, y);
    visit(width - 1, y);
  }
}

/** qwen 抠图常把透明画成白底、灰白棋盘或褐红马赛克，而不是真 alpha。 */
export function detectFakeBackdropKind(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): FakeBackdropKind {
  if (width < 2 || height < 2 || channels < 3) return "none";
  let white = 0;
  let gray = 0;
  let dark = 0;
  let flips = 0;
  let edge = 0;
  walkEdgePixels(width, height, (x, y) => {
    const p = rgbaAt(data, width, channels, x, y);
    if (p.a < 250) return;
    edge += 1;
    if (pixelIsLightBackdrop(p.r, p.g, p.b)) white += 1;
    else if (pixelIsCheckerGray(p.r, p.g, p.b)) {
      gray += 1;
      dark += 1;
    } else if (pixelIsDarkMosaicTile(p.r, p.g, p.b)) {
      dark += 1;
    }
    if (hasLuminanceFlip(data, width, height, channels, x, y)) flips += 1;
  });
  if (edge < 8) return "none";
  const denom = Math.max(1, edge);
  const whiteRatio = white / denom;
  const grayRatio = gray / denom;
  const darkRatio = dark / denom;
  const flipRatio = flips / denom;
  if (whiteRatio >= 0.08 && grayRatio >= 0.08) return "checkerboard";
  if (flipRatio >= 0.2 && (whiteRatio >= 0.08 || darkRatio >= 0.08)) return "mosaic";
  if (whiteRatio >= 0.08 && darkRatio >= 0.08) return "mosaic";
  if (whiteRatio >= 0.45) return "solid-white";
  return "none";
}

/** 顶边明暗交替的中位 run，用来估计棋盘/马赛克格边长。 */
export function detectCheckerCellSize(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): number {
  const runs: number[] = [];
  let prev: "light" | "dark" | "other" | null = null;
  let run = 0;
  const tone = (x: number, y: number) => {
    const p = rgbaAt(data, width, channels, x, y);
    if (pixelIsLightBackdrop(p.r, p.g, p.b)) return "light" as const;
    if (pixelIsDarkMosaicTile(p.r, p.g, p.b)) return "dark" as const;
    return "other" as const;
  };
  const flush = () => {
    if (prev && prev !== "other" && run >= 2) runs.push(run);
    run = 0;
  };
  for (let x = 0; x < width; x += 1) {
    const t = tone(x, 0);
    if (t === prev) run += 1;
    else {
      flush();
      prev = t;
      run = 1;
    }
  }
  flush();
  if (!runs.length) return 8;
  runs.sort((a, b) => a - b);
  return Math.max(4, Math.min(48, runs[Math.floor(runs.length / 2)] ?? 8));
}

/**
 * 把抠图假背景打成真透明，供万相在透明区画新场景。
 * 从边缘的暗格洪水填充；浅色格只扩一格，避免吃掉白裤子。
 */
export async function knockOutFakeBackdrop(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const channels = info.channels ?? 4;
  if (!width || !height || channels < 4) return buf;

  const kind = detectFakeBackdropKind(data, width, height, channels);
  if (kind === "none") return buf;

  const out = Buffer.from(data);

  if (kind === "checkerboard" || kind === "mosaic") {
    const cell = detectCheckerCellSize(data, width, height, channels);
    const dist = new Int32Array(width * height);
    dist.fill(-1);
    const queue: number[] = [];
    const enqueueDark = (x: number, y: number) => {
      const idx = y * width + x;
      if (dist[idx] !== -1) return;
      const p = rgbaAt(out, width, channels, x, y);
      if (!pixelIsDarkMosaicTile(p.r, p.g, p.b)) return;
      dist[idx] = 0;
      queue.push(idx);
    };
    walkEdgePixels(width, height, enqueueDark);
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head]!;
      head += 1;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const d = dist[idx]!;
      const cur = rgbaAt(out, width, channels, x, y);
      for (const [dx, dy] of FOUR_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (dist[nidx] !== -1) continue;
        const n = rgbaAt(out, width, channels, nx, ny);
        if (isMosaicDarkCell(out, width, height, channels, nx, ny)) {
          dist[nidx] = 0;
          queue.push(nidx);
          continue;
        }
        if (
          pixelIsDarkMosaicTile(n.r, n.g, n.b) &&
          similarTileColor(cur, n) &&
          d < cell
        ) {
          dist[nidx] = d + 1;
          queue.push(nidx);
          continue;
        }
        if (!pixelIsLightBackdrop(n.r, n.g, n.b) || d >= cell) continue;
        dist[nidx] = d + 1;
        queue.push(nidx);
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = rgbaAt(out, width, channels, x, y);
        const idx = y * width + x;
        const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        const visited = (dist[idx] ?? -1) >= 0;
        if (visited) {
          out[p.i + 3] = 0;
          continue;
        }
        if (
          onEdge &&
          (pixelIsLightBackdrop(p.r, p.g, p.b) ||
            isMosaicDarkCell(out, width, height, channels, x, y))
        ) {
          out[p.i + 3] = 0;
        }
      }
    }
    cleanupResidualMosaic(out, width, height, channels);
  } else {
    const seen = new Uint8Array(width * height);
    const queue: number[] = [];
    const push = (x: number, y: number) => {
      const idx = y * width + x;
      if (seen[idx]) return;
      const p = rgbaAt(out, width, channels, x, y);
      if (!pixelIsLightBackdrop(p.r, p.g, p.b)) return;
      seen[idx] = 1;
      queue.push(idx);
    };
    walkEdgePixels(width, height, push);
    while (queue.length) {
      const idx = queue.pop()!;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const i = idx * channels;
      out[i + 3] = 0;
      for (const [dx, dy] of FOUR_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        push(nx, ny);
      }
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** 抠图结果常带白底；四角近白时把近白像素打成透明，供万相画新场景。 */
export async function knockOutNearWhiteBackdrop(buf: Buffer): Promise<Buffer> {
  return knockOutFakeBackdrop(buf);
}

export const BACKGROUND_REPLACE_EDGE_MAX = 10;
export const BACKGROUND_REPLACE_N_MAX = 4;

export type BackgroundReplaceEdgeItem = {
  url: string;
  prompt?: string;
};

export type BackgroundReplaceInput = {
  baseImageUrl: string;
  modelKey?: string;
  refPrompt?: string;
  refImageUrl?: string;
  negRefPrompt?: string;
  foregroundEdges?: BackgroundReplaceEdgeItem[];
  backgroundEdges?: BackgroundReplaceEdgeItem[];
  n?: number;
  modelVersion?: "v2" | "v3";
  noiseLevel?: number;
  refPromptWeight?: number;
  bbox?: [number, number, number, number];
  /** 图 2 参考图上的官方 0～999 框（玩法 C）。 */
  refBbox?: [number, number, number, number];
  /** 万相第二步：入参已是抠好的透明底，跳过抠图。 */
  subjectAlreadyCutout?: boolean;
};

export function buildBackgroundReplaceRequest(input: BackgroundReplaceInput): {
  model: string;
  input: Record<string, unknown>;
  parameters: Record<string, unknown>;
} {
  const base = input.baseImageUrl.trim();
  if (!base) throw new Error("缺少主体图（透明底 PNG）");

  const refPrompt = input.refPrompt?.trim() ?? "";
  const refImageUrl = input.refImageUrl?.trim() ?? "";
  if (!refPrompt && !refImageUrl) {
    throw new Error("请填写场景描述，或上传一张引导图");
  }

  const fg = (input.foregroundEdges ?? []).filter((e) => e.url.trim());
  const bg = (input.backgroundEdges ?? []).filter((e) => e.url.trim());
  if (fg.length + bg.length > BACKGROUND_REPLACE_EDGE_MAX) {
    throw new Error(`前景+背景边缘元素合计最多 ${BACKGROUND_REPLACE_EDGE_MAX} 张`);
  }

  const n = Math.min(
    BACKGROUND_REPLACE_N_MAX,
    Math.max(1, Math.round(input.n ?? 1)),
  );
  const modelVersion = input.modelVersion === "v2" ? "v2" : "v3";

  const bodyInput: Record<string, unknown> = { base_image_url: base };
  if (refPrompt) bodyInput.ref_prompt = refPrompt.slice(0, 120);
  if (refImageUrl) bodyInput.ref_image_url = refImageUrl;
  if (input.negRefPrompt?.trim()) {
    bodyInput.neg_ref_prompt = input.negRefPrompt.trim().slice(0, 120);
  }
  if (fg.length || bg.length) {
    const reference_edge: Record<string, unknown> = {};
    if (fg.length) {
      reference_edge.foreground_edge = fg.map((e) => e.url.trim());
      reference_edge.foreground_edge_prompt = fg.map((e) => e.prompt?.trim() ?? "");
    }
    if (bg.length) {
      reference_edge.background_edge = bg.map((e) => e.url.trim());
      reference_edge.background_edge_prompt = bg.map((e) => e.prompt?.trim() ?? "");
    }
    bodyInput.reference_edge = reference_edge;
  }

  const parameters: Record<string, unknown> = { n, model_version: modelVersion };
  if (refImageUrl) {
    const noise = input.noiseLevel;
    if (typeof noise === "number" && Number.isFinite(noise)) {
      parameters.noise_level = Math.max(0, Math.min(999, Math.round(noise)));
    }
  }
  if (refPrompt && refImageUrl && typeof input.refPromptWeight === "number") {
    parameters.ref_prompt_weight = Math.max(0, Math.min(1, input.refPromptWeight));
  }

  return {
    model: WANX_BACKGROUND_GENERATION_MODEL,
    input: bodyInput,
    parameters,
  };
}
