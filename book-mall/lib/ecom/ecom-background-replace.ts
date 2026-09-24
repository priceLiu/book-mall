import sharp from "sharp";

import { bboxTag } from "@/lib/ecom/ecom-image-layer-prompt";

/** 百炼万相 · 图像背景生成（换场景）。须先抠出真透明主体。 */
export const WANX_BACKGROUND_GENERATION_MODEL = "wanx-background-generation-v2";
/** 火山 Seedream 5.0 Pro · 原图整图换景（可框选或纯提示词）。 */
export const SEEDREAM_BACKGROUND_REPLACE_MODEL = "doubao-seedream-5-0-pro";

export const BACKGROUND_REPLACE_MODEL_KEYS = [
  SEEDREAM_BACKGROUND_REPLACE_MODEL,
  WANX_BACKGROUND_GENERATION_MODEL,
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
  if (isWanxBackgroundReplaceModel(k)) return WANX_BACKGROUND_GENERATION_MODEL;
  if (isSeedreamBackgroundReplaceModel(k)) return SEEDREAM_BACKGROUND_REPLACE_MODEL;
  throw new Error("换背景仅支持火山 Seedream 5.0 Pro 或万相背景生成");
}

export function buildSeedreamBackgroundReplacePrompt(opts: {
  scene: string;
  bbox?: [number, number, number, number];
}): string {
  const scene = opts.scene.trim();
  if (!scene) throw new Error("请填写场景描述");
  if (opts.bbox) {
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
export async function hasMeaningfulTransparency(buf: Buffer): Promise<boolean> {
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
  return transparent / total >= BACKGROUND_REPLACE_MIN_ALPHA_RATIO;
}

function pixelIsNearWhite(r: number, g: number, b: number): boolean {
  return r >= 240 && g >= 240 && b >= 240;
}

function pixelIsCheckerGray(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 200 && min >= 120 && max - min <= 28;
}

function pixelIsFakeBackdrop(r: number, g: number, b: number): boolean {
  return pixelIsNearWhite(r, g, b) || pixelIsCheckerGray(r, g, b);
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

function oppositeBackdropTone(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): boolean {
  return (
    (pixelIsNearWhite(a.r, a.g, a.b) && pixelIsCheckerGray(b.r, b.g, b.b)) ||
    (pixelIsCheckerGray(a.r, a.g, a.b) && pixelIsNearWhite(b.r, b.g, b.b))
  );
}

export type FakeBackdropKind = "none" | "solid-white" | "checkerboard";

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

/** qwen 抠图常把透明画成白底或灰白棋盘，而不是真 alpha。 */
export function detectFakeBackdropKind(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): FakeBackdropKind {
  if (width < 2 || height < 2 || channels < 3) return "none";
  let white = 0;
  let gray = 0;
  let edge = 0;
  walkEdgePixels(width, height, (x, y) => {
    const p = rgbaAt(data, width, channels, x, y);
    edge += 1;
    if (pixelIsNearWhite(p.r, p.g, p.b)) white += 1;
    else if (pixelIsCheckerGray(p.r, p.g, p.b)) gray += 1;
  });
  const whiteRatio = white / Math.max(1, edge);
  const grayRatio = gray / Math.max(1, edge);
  if (whiteRatio >= 0.08 && grayRatio >= 0.08) return "checkerboard";
  if (whiteRatio >= 0.45) return "solid-white";
  return "none";
}

/** 顶边灰白交替的中位 run，用来估计棋盘格边长。 */
export function detectCheckerCellSize(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): number {
  const runs: number[] = [];
  let prev: "white" | "gray" | "other" | null = null;
  let run = 0;
  const tone = (x: number, y: number) => {
    const p = rgbaAt(data, width, channels, x, y);
    if (pixelIsNearWhite(p.r, p.g, p.b)) return "white" as const;
    if (pixelIsCheckerGray(p.r, p.g, p.b)) return "gray" as const;
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
 * 棋盘格只抠相邻灰白格，避免把人物白裤子整块吃掉。
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
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  if (kind === "checkerboard") {
    const cell = detectCheckerCellSize(data, width, height, channels);
    const dist = new Int32Array(width * height);
    dist.fill(-1);
    const queue: number[] = [];
    const enqueueGray = (x: number, y: number) => {
      const idx = y * width + x;
      if (dist[idx] !== -1) return;
      const p = rgbaAt(out, width, channels, x, y);
      if (!pixelIsCheckerGray(p.r, p.g, p.b)) return;
      dist[idx] = 0;
      queue.push(idx);
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) enqueueGray(x, y);
    }
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head]!;
      head += 1;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const d = dist[idx]!;
      if (d >= cell) continue;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (dist[nidx] !== -1) continue;
        const n = rgbaAt(out, width, channels, nx, ny);
        if (!pixelIsFakeBackdrop(n.r, n.g, n.b)) continue;
        dist[nidx] = d + 1;
        queue.push(nidx);
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = rgbaAt(out, width, channels, x, y);
        if (!pixelIsFakeBackdrop(p.r, p.g, p.b)) continue;
        const idx = y * width + x;
        const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        if (onEdge || pixelIsCheckerGray(p.r, p.g, p.b) || (dist[idx] ?? -1) >= 0) {
          out[p.i + 3] = 0;
        }
      }
    }
  } else {
    const seen = new Uint8Array(width * height);
    const queue: number[] = [];
    const push = (x: number, y: number) => {
      const idx = y * width + x;
      if (seen[idx]) return;
      const p = rgbaAt(out, width, channels, x, y);
      if (!pixelIsNearWhite(p.r, p.g, p.b)) return;
      seen[idx] = 1;
      queue.push(idx);
    };
    for (let x = 0; x < width; x += 1) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      push(0, y);
      push(width - 1, y);
    }
    while (queue.length) {
      const idx = queue.pop()!;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const i = idx * channels;
      out[i + 3] = 0;
      for (const [dx, dy] of neighbors) {
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
