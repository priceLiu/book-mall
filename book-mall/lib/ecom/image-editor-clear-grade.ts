import sharp from "sharp";

import { IMAGE_EDITOR_FILTER_RECIPES } from "@/lib/ecom/image-editor-filter-recipes";
import { imageEditorFilterPrompt, imageEditorFilterPromptLabel } from "@/lib/ecom/image-editor-filter-prompts";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 4096;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(0.985, n));
}

/** 暗部打开、黑位按住、高光不裁死。 */
function clearCurve(x: number): number {
  if (x <= 0.035) return x * 0.9;
  const lift = 0.22 * Math.pow(1 - x, 1.2) * Math.pow(Math.max(x, 0), 0.45);
  const y = x + lift;
  return clamp01((y - 0.48) * 1.02 + 0.5);
}

/**
 * 清透：灰雾处把白平衡往中性冷收，再按曲线提起暗部和中间调。
 * 饱和色（商品色、肤色）几乎不改色相。
 */
export function gradeClearPixel(r0: number, g0: number, b0: number): [number, number, number] {
  let r = r0 / 255;
  let g = g0 / 255;
  let b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = max <= 1e-4 ? 0 : (max - min) / max;
  const haze = (1 - sat) * (0.25 + 0.75 * l);

  r *= 1 - 0.12 * haze;
  g *= 1 - 0.04 * haze;
  b *= 1 + 0.16 * haze;

  const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const scale = l2 > 1e-4 ? clearCurve(l2) / l2 : 1;
  return [
    clampByte(r * scale * 255),
    clampByte(g * scale * 255),
    clampByte(b * scale * 255),
  ];
}

function lumaAt(data: Uint8Array | Uint8ClampedArray | Buffer, offset: number): number {
  return 0.2126 * data[offset]! + 0.7152 * data[offset + 1]! + 0.0722 * data[offset + 2]!;
}

/** 轻微局部对比，均匀色块不会被改色。 */
function applyClearClarity(
  data: Uint8Array | Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  amount = 0.42,
): void {
  const n = width * height;
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = lumaAt(data, i * 4);
  const blur = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += luma[yy * width + xx]!;
          count += 1;
        }
      }
      blur[y * width + x] = sum / count;
    }
  }
  for (let i = 0; i < n; i++) {
    const base = luma[i]!;
    if (base < 1) continue;
    const next = Math.max(0, Math.min(255, base + amount * (base - blur[i]!)));
    const scale = next / base;
    if (Math.abs(scale - 1) < 0.004) continue;
    const o = i * 4;
    data[o] = clampByte(data[o]! * scale);
    data[o + 1] = clampByte(data[o + 1]! * scale);
    data[o + 2] = clampByte(data[o + 2]! * scale);
  }
}

export function gradeClearRgba(
  data: Uint8Array | Uint8ClampedArray | Buffer,
  width: number,
  height: number,
): void {
  const n = width * height;
  if (width < 1 || height < 1 || data.length < n * 4) {
    throw new Error("图片数据长度不足");
  }
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const [r, g, b] = gradeClearPixel(data[o]!, data[o + 1]!, data[o + 2]!);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
  applyClearClarity(data, width, height);
}

export type LocalRecipe = {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  sepia?: number;
  /** 正数偏暖，负数偏冷 */
  temperature?: number;
  clarity?: number;
  shadowLift?: number;
  highlightRoll?: number;
  /** 只提亮或压暗低饱和区域 */
  neutralBrightness?: number;
  cleanWhite?: boolean;
};

const LOCAL_GRADE_RECIPES: Record<string, LocalRecipe> = {
  vivid: { contrast: 1.12, saturate: 1.65 },
  dehaze: { brightness: 1.04, contrast: 1.24, saturate: 1.12, clarity: 0.45 },
  texture: { contrast: 1.16, saturate: 1.08, clarity: 0.75 },
  sharpen: { contrast: 1.14, saturate: 1.04, clarity: 0.95 },
  aqua: { temperature: -0.2, saturate: 1.22, contrast: 1.06, brightness: 1.03 },
  hyper: { saturate: 1.9, contrast: 1.16 },
  soft: { brightness: 1.08, contrast: 0.74, saturate: 0.9 },
  natural: { contrast: 1.06, saturate: 0.88, temperature: -0.04 },
  fade: { brightness: 1.08, contrast: 0.82, saturate: 0.62, sepia: 0.18 },
  lift: { brightness: 1.2, contrast: 0.94, shadowLift: 0.08 },
  darken: { brightness: 0.76, contrast: 1.06 },
  "contrast-up": { contrast: 1.32, saturate: 1.06 },
  "contrast-down": { contrast: 0.7, brightness: 1.04 },
  warm: { temperature: 0.22, saturate: 1.06 },
  cool: { temperature: -0.22, saturate: 1.02 },
  "highlight-up": { brightness: 1.14, contrast: 0.9 },
  "shadow-open": { shadowLift: 0.24, contrast: 1.04 },
  "highlight-roll": { highlightRoll: 0.45, contrast: 1.06 },
  "skin-protect": { saturate: 0.86, temperature: 0.08, contrast: 0.98 },
  "brand-color": { saturate: 1.5, contrast: 1.1 },
  cream: { brightness: 1.06, contrast: 0.86, saturate: 0.88, sepia: 0.16, temperature: 0.08 },
  film: { brightness: 1.05, contrast: 0.84, saturate: 0.72, sepia: 0.24 },
  "cool-white": { temperature: -0.2, contrast: 1.12, saturate: 0.9 },
  "warm-food": { temperature: 0.24, saturate: 1.28, contrast: 1.08 },
  muted: { saturate: 0.42, contrast: 1.06 },
  "bg-light": { neutralBrightness: 1.28 },
  "bg-dark": { neutralBrightness: 0.62 },
  "product-true": { saturate: 0.92, contrast: 1.06 },
  "warm-white": { temperature: 0.14, brightness: 1.04 },
  "cool-white-balance": { temperature: -0.16, brightness: 1.04 },
  "white-bg": { cleanWhite: true },
  food: { temperature: 0.16, saturate: 1.35, contrast: 1.08 },
  fabric: { contrast: 1.12, saturate: 1.1, clarity: 0.6 },
  "metal-glass": { contrast: 1.22, saturate: 1.08, clarity: 0.4, highlightRoll: 0.15 },
  gift: { contrast: 1.1, saturate: 1.18, temperature: 0.06 },
  ...IMAGE_EDITOR_FILTER_RECIPES,
};

function channel(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** 调色预设的像素结果。清透走单独曲线，其余按配方，保证和原图能看出差别。 */
export function gradeNamedPixel(id: string, r0: number, g0: number, b0: number): [number, number, number] {
  if (id === "clear") return gradeClearPixel(r0, g0, b0);
  if (id === "grayscale") {
    const l = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
    return [clampByte(l), clampByte(l), clampByte(l)];
  }
  if (id === "invert") {
    return [clampByte(255 - r0), clampByte(255 - g0), clampByte(255 - b0)];
  }
  const recipe = LOCAL_GRADE_RECIPES[id];
  if (!recipe) throw new Error("未知调色");
  let r = r0 / 255;
  let g = g0 / 255;
  let b = b0 / 255;
  const l0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max <= 1e-4 ? 0 : (max - min) / max;

  if (recipe.brightness) {
    r *= recipe.brightness;
    g *= recipe.brightness;
    b *= recipe.brightness;
  }
  if (recipe.contrast) {
    const c = recipe.contrast;
    r = (r - 0.5) * c + 0.5;
    g = (g - 0.5) * c + 0.5;
    b = (b - 0.5) * c + 0.5;
  }
  if (recipe.saturate != null && recipe.saturate !== 1) {
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = recipe.saturate;
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    b = l + (b - l) * s;
  }
  if (recipe.sepia) {
    const a = recipe.sepia;
    const sr = r * 0.393 + g * 0.769 + b * 0.189;
    const sg = r * 0.349 + g * 0.686 + b * 0.168;
    const sb = r * 0.272 + g * 0.534 + b * 0.131;
    r = r + (sr - r) * a;
    g = g + (sg - g) * a;
    b = b + (sb - b) * a;
  }
  if (recipe.temperature) {
    const t = recipe.temperature;
    r *= 1 + 0.35 * t;
    g *= 1 + 0.06 * t;
    b *= 1 - 0.4 * t;
  }
  if (recipe.shadowLift && l0 < 0.5) {
    const lift = recipe.shadowLift * (1 - l0 / 0.5);
    r += lift;
    g += lift;
    b += lift;
  }
  if (recipe.highlightRoll && l0 > 0.62) {
    const k = recipe.highlightRoll * ((l0 - 0.62) / 0.38);
    r = r + (0.78 - r) * k;
    g = g + (0.78 - g) * k;
    b = b + (0.78 - b) * k;
  }
  if (recipe.neutralBrightness && sat < 0.22) {
    r *= recipe.neutralBrightness;
    g *= recipe.neutralBrightness;
    b *= recipe.neutralBrightness;
  }
  if (recipe.cleanWhite && sat < 0.14 && l0 > 0.7) {
    r = r + (1 - r) * 0.65;
    g = g + (1 - g) * 0.65;
    b = b + (1 - b) * 0.65;
  }
  return [clampByte(channel(r) * 255), clampByte(channel(g) * 255), clampByte(channel(b) * 255)];
}

/** 每个 gradeId 必须在提示词表中有对应条目，与前端所选滤镜一致。 */
export function assertImageEditorGradePrompt(gradeId: string): void {
  if (!imageEditorFilterPrompt(gradeId)) throw new Error(`未知调色：${gradeId}`);
}

export function imageEditorGradeDisplayLabel(gradeId: string): string {
  return imageEditorFilterPromptLabel(gradeId) ?? gradeId;
}

export function gradeLocalRgba(
  data: Uint8Array | Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  gradeId: string,
): void {
  assertImageEditorGradePrompt(gradeId);
  if (gradeId === "clear") {
    gradeClearRgba(data, width, height);
    return;
  }
  if (gradeId !== "grayscale" && gradeId !== "invert" && !LOCAL_GRADE_RECIPES[gradeId]) throw new Error("未知调色");
  const n = width * height;
  if (width < 1 || height < 1 || data.length < n * 4) {
    throw new Error("图片数据长度不足");
  }
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const [r, g, b] = gradeNamedPixel(gradeId, data[o]!, data[o + 1]!, data[o + 2]!);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
  const clarity = LOCAL_GRADE_RECIPES[gradeId]?.clarity;
  if (clarity && clarity > 0) applyClearClarity(data, width, height, clarity);
}

export type ColorAdjust = {
  fill?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  clarity?: number;
  sharpen?: number;
  highlight?: number;
  shadow?: number;
  fade?: number;
  temperature?: number;
  tint?: number;
  vignette?: number;
  grain?: number;
  disperse?: number;
  splitHighlight?: number;
  splitShadow?: number;
  splitHighlightSat?: number;
  splitShadowSat?: number;
  splitHighlightRgb?: [number, number, number];
  splitShadowRgb?: [number, number, number];
  hue?: number;
  hslSat?: number;
  hslLight?: number;
  /** 6 色块的色相 / 饱和度 / 明度，顺序：红、黄、紫、橙、绿、蓝。 */
  hslBands?: Array<[number, number, number]>;
  cleanWhite?: boolean;
  recolorSource?: [number, number, number];
  recolorTarget?: [number, number, number];
  recolorTolerance?: number;
  /** 换色时要保住原色的笔触，坐标相对图片宽高，r 相对宽度。 */
  protect?: Array<{ x: number; y: number; r: number }>;
};

const ADJUST_NUM_KEYS = [
  "fill",
  "brightness",
  "contrast",
  "saturate",
  "clarity",
  "sharpen",
  "highlight",
  "shadow",
  "fade",
  "temperature",
  "tint",
  "vignette",
  "grain",
  "disperse",
  "splitHighlight",
  "splitShadow",
  "splitHighlightSat",
  "splitShadowSat",
  "hue",
  "hslSat",
  "hslLight",
  "recolorTolerance",
] as const satisfies ReadonlyArray<keyof ColorAdjust>;

/** 与前端 HSL 色块同一顺序。 */
const HSL_BAND_HUES = [0, 55, 295, 32, 125, 215];

function clampUnit(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function readRgb(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const nums = value.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  return nums.map((n) => clampUnit(Math.round(n), 0, 255)) as [number, number, number];
}

export function parseColorAdjust(raw: string): ColorAdjust {
  if (raw.length > 8000) throw new Error("调色参数无效");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("调色参数无效");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("调色参数无效");
  const src = data as Record<string, unknown>;
  const out: ColorAdjust = {};
  for (const key of ADJUST_NUM_KEYS) {
    const value = src[key];
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("调色参数无效");
    out[key] = value;
  }
  if (src.cleanWhite === true) out.cleanWhite = true;
  const source = readRgb(src.recolorSource);
  const target = readRgb(src.recolorTarget);
  if (source && target) {
    out.recolorSource = source;
    out.recolorTarget = target;
  }
  const highlightRgb = readRgb(src.splitHighlightRgb);
  const shadowRgb = readRgb(src.splitShadowRgb);
  if (highlightRgb) out.splitHighlightRgb = highlightRgb;
  if (shadowRgb) out.splitShadowRgb = shadowRgb;
  if (Array.isArray(src.hslBands)) {
    const bands: Array<[number, number, number]> = [];
    for (const row of src.hslBands.slice(0, 6)) {
      if (!Array.isArray(row) || row.length !== 3) throw new Error("调色参数无效");
      const nums = row.map((n) => Number(n));
      if (nums.some((n) => !Number.isFinite(n))) throw new Error("调色参数无效");
      bands.push(nums.map((n) => clampUnit(Math.round(n), -100, 100)) as [number, number, number]);
    }
    while (bands.length < 6) bands.push([0, 0, 0]);
    if (bands.some((band) => band.some((n) => n !== 0))) out.hslBands = bands;
  }
  if (Array.isArray(src.protect)) {
    const strokes: Array<{ x: number; y: number; r: number }> = [];
    for (const row of src.protect.slice(0, 80)) {
      if (!row || typeof row !== "object") continue;
      const stroke = row as Record<string, unknown>;
      const x = Number(stroke.x);
      const y = Number(stroke.y);
      const r = Number(stroke.r);
      if (![x, y, r].every((n) => Number.isFinite(n))) continue;
      strokes.push({
        x: clampUnit(x, 0, 1),
        y: clampUnit(y, 0, 1),
        r: clampUnit(r, 0.002, 0.25),
      });
    }
    if (strokes.length > 0) out.protect = strokes;
  }
  return out;
}

export function colorAdjustIsNeutral(adjust: ColorAdjust): boolean {
  for (const key of ADJUST_NUM_KEYS) {
    if ((adjust[key] ?? 0) !== 0) return false;
  }
  if (adjust.cleanWhite) return false;
  if (adjust.recolorSource && adjust.recolorTarget) return false;
  if (adjust.hslBands?.some((band) => band.some((n) => n !== 0))) return false;
  return true;
}

function signed(value: number | undefined): number {
  return clampUnit(value ?? 0, -100, 100) / 100;
}

function positive(value: number | undefined): number {
  return clampUnit(value ?? 0, 0, 100) / 100;
}

function hueShift(r: number, g: number, b: number, deg: number): [number, number, number] {
  const a = (deg * Math.PI) / 180;
  const u = Math.cos(a);
  const w = Math.sin(a);
  return [
    r * (0.213 + u * 0.787 - w * 0.213) + g * (0.715 - u * 0.715 - w * 0.715) + b * (0.072 - u * 0.072 + w * 0.928),
    r * (0.213 - u * 0.213 + w * 0.143) + g * (0.715 + u * 0.285 + w * 0.14) + b * (0.072 - u * 0.072 - w * 0.283),
    r * (0.213 - u * 0.213 - w * 0.787) + g * (0.715 - u * 0.715 + w * 0.715) + b * (0.072 + u * 0.928 + w * 0.072),
  ];
}

function rgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 1e-4) return -1;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function hslBandWeight(pixelHue: number, center: number): number {
  let d = Math.abs(pixelHue - center) % 360;
  if (d > 180) d = 360 - d;
  const half = 22;
  if (d >= half) return 0;
  return 1 - d / half;
}

function tintToward(
  r: number,
  g: number,
  b: number,
  l0: number,
  rgb: [number, number, number] | undefined,
  sat: number | undefined,
  side: "highlight" | "shadow",
): [number, number, number] {
  const amount = positive(sat);
  if (!rgb || amount <= 0) return [r, g, b];
  const gate = side === "highlight" ? (l0 > 0.58 ? (l0 - 0.58) / 0.42 : 0) : l0 < 0.42 ? (0.42 - l0) / 0.42 : 0;
  if (gate <= 0) return [r, g, b];
  const w = gate * amount * 0.72;
  const tr = rgb[0] / 255;
  const tg = rgb[1] / 255;
  const tb = rgb[2] / 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const tl = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb;
  const scale = tl > 1e-4 ? l / tl : 1;
  return [r + (tr * scale - r) * w, g + (tg * scale - g) * w, b + (tb * scale - b) * w];
}

function hash01(index: number): number {
  let x = Math.imul(index + 1, 374761393);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (((x ^ (x >>> 16)) >>> 0) & 65535) / 65535;
}

function applySpatialAdjust(
  data: Uint8Array | Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  adjust: ColorAdjust,
): void {
  const vignette = signed(adjust.vignette);
  const grain = positive(adjust.grain);
  const disperse = positive(adjust.disperse);
  if (!vignette && !grain && !disperse) return;
  if (disperse) {
    const maxShift = Math.max(1, Math.round(disperse * 8));
    const rowR = new Uint8Array(width);
    const rowB = new Uint8Array(width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        rowR[x] = data[o]!;
        rowB[x] = data[o + 2]!;
      }
      for (let x = 0; x < width; x++) {
        const dx = x / Math.max(1, width - 1) - 0.5;
        const shift = Math.round(dx * maxShift * 2);
        const xr = Math.max(0, Math.min(width - 1, x - shift));
        const xb = Math.max(0, Math.min(width - 1, x + shift));
        const o = (y * width + x) * 4;
        data[o] = rowR[xr]!;
        data[o + 2] = rowB[xb]!;
      }
    }
  }
  if (!vignette && !grain) return;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let r = data[o]!;
      let g = data[o + 1]!;
      let b = data[o + 2]!;
      if (vignette) {
        const dx = (x / Math.max(1, width - 1) - 0.5) * 2;
        const dy = (y / Math.max(1, height - 1) - 0.5) * 2;
        const falloff = Math.max(0, Math.min(1, (Math.hypot(dx, dy) - 0.45) / 0.95));
        const gain = 1 - falloff * vignette * 0.92;
        r *= gain;
        g *= gain;
        b *= gain;
      }
      if (grain) {
        const noise = (hash01(y * width + x) - 0.5) * grain * 70;
        r += noise;
        g += noise;
        b += noise;
      }
      data[o] = clampByte(r);
      data[o + 1] = clampByte(g);
      data[o + 2] = clampByte(b);
    }
  }
}

export function gradeAdjustPixel(adjust: ColorAdjust, r0: number, g0: number, b0: number): [number, number, number] {
  let r = r0 / 255;
  let g = g0 / 255;
  let b = b0 / 255;
  const l0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const max0 = Math.max(r, g, b);
  const min0 = Math.min(r, g, b);
  const sat0 = max0 <= 1e-4 ? 0 : (max0 - min0) / max0;

  const fill = signed(adjust.fill);
  if (fill > 0 && l0 < 0.72) {
    const lift = fill * 0.48 * (1 - l0 / 0.72);
    r += lift;
    g += lift;
    b += lift;
  } else if (fill < 0) {
    const k = 1 + fill * 0.42;
    r *= k;
    g *= k;
    b *= k;
  }
  const brightness = signed(adjust.brightness);
  if (brightness) {
    const m = 1 + brightness * 0.7;
    r *= m;
    g *= m;
    b *= m;
  }
  const light = signed(adjust.hslLight);
  if (light) {
    const m = 1 + light * 0.55;
    r *= m;
    g *= m;
    b *= m;
  }
  const contrast = signed(adjust.contrast);
  if (contrast) {
    const c = 1 + contrast * 0.9;
    r = (r - 0.5) * c + 0.5;
    g = (g - 0.5) * c + 0.5;
    b = (b - 0.5) * c + 0.5;
  }
  const saturate = signed(adjust.saturate) + signed(adjust.hslSat);
  if (saturate) {
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = Math.max(0, 1 + saturate * 1.35);
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    b = l + (b - l) * s;
  }
  const temperature = signed(adjust.temperature);
  if (temperature) {
    r *= 1 + 0.48 * temperature;
    b *= 1 - 0.48 * temperature;
  }
  const tint = signed(adjust.tint);
  if (tint) {
    g *= 1 + 0.38 * tint;
    r *= 1 - 0.12 * tint;
    b *= 1 - 0.12 * tint;
  }
  const highlight = signed(adjust.highlight);
  if (highlight && l0 > 0.55) {
    const k = ((l0 - 0.55) / 0.45) * highlight * 0.5;
    r += k;
    g += k;
    b += k;
  }
  const shadow = signed(adjust.shadow);
  if (shadow && l0 < 0.5) {
    const k = (1 - l0 / 0.5) * shadow * 0.42;
    r += k;
    g += k;
    b += k;
  }
  const fade = signed(adjust.fade);
  if (fade > 0) {
    const lift = fade * 0.24;
    r = r * (1 - fade * 0.18) + lift;
    g = g * (1 - fade * 0.18) + lift;
    b = b * (1 - fade * 0.22) + lift * 0.82;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = 1 - fade * 0.5;
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    b = l + (b - l) * s;
  } else if (fade < 0) {
    const k = -fade;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = 1 + k * 0.55;
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    b = l + (b - l) * s;
    const c = 1 + k * 0.22;
    r = (r - 0.5) * c + 0.5;
    g = (g - 0.5) * c + 0.5;
    b = (b - 0.5) * c + 0.5;
  }
  const splitH = signed(adjust.splitHighlight);
  if (splitH && l0 > 0.62) {
    const k = ((l0 - 0.62) / 0.38) * splitH * 0.28;
    r += k;
    b -= k;
  }
  const splitS = signed(adjust.splitShadow);
  if (splitS && l0 < 0.4) {
    const k = (1 - l0 / 0.4) * splitS * 0.24;
    r += k;
    b -= k;
  }
  [r, g, b] = tintToward(r, g, b, l0, adjust.splitHighlightRgb, adjust.splitHighlightSat, "highlight");
  [r, g, b] = tintToward(r, g, b, l0, adjust.splitShadowRgb, adjust.splitShadowSat, "shadow");
  if (adjust.hslBands) {
    const sourceHue = rgbHue(r0 / 255, g0 / 255, b0 / 255);
    if (sourceHue >= 0 && sat0 > 0.06) {
      for (let band = 0; band < HSL_BAND_HUES.length; band++) {
        const row = adjust.hslBands[band];
        if (!row) continue;
        const weight = hslBandWeight(sourceHue, HSL_BAND_HUES[band]!);
        if (weight <= 0) continue;
        const [bandHue, bandSat, bandLight] = row;
        if (bandHue) [r, g, b] = hueShift(r, g, b, signed(bandHue) * 48 * weight);
        if (bandSat) {
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const s = Math.max(0, 1 + signed(bandSat) * 1.2 * weight);
          r = l + (r - l) * s;
          g = l + (g - l) * s;
          b = l + (b - l) * s;
        }
        if (bandLight) {
          const m = 1 + signed(bandLight) * 0.5 * weight;
          r *= m;
          g *= m;
          b *= m;
        }
      }
    }
  }
  const hue = signed(adjust.hue);
  if (hue) {
    [r, g, b] = hueShift(r, g, b, hue * 40);
  }
  if (adjust.cleanWhite && sat0 < 0.16 && l0 > 0.62) {
    r = r + (1 - r) * 0.75;
    g = g + (1 - g) * 0.75;
    b = b + (1 - b) * 0.75;
  }
  if (adjust.recolorSource && adjust.recolorTarget) {
    const [sr, sg, sb] = adjust.recolorSource;
    const [tr, tg, tb] = adjust.recolorTarget;
    const tol = positive(adjust.recolorTolerance);
    const dist = Math.hypot(r0 - sr, g0 - sg, b0 - sb) / 441.67;
    const gate = 0.05 + tol * 0.72;
    if (dist < gate) {
      const w = 1 - dist / gate;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const tl = 0.2126 * (tr / 255) + 0.7152 * (tg / 255) + 0.0722 * (tb / 255);
      const scale = tl > 1e-4 ? l / tl : 1;
      r = r + ((tr / 255) * scale - r) * w;
      g = g + ((tg / 255) * scale - g) * w;
      b = b + ((tb / 255) * scale - b) * w;
    }
  }
  return [clampByte(channel(r) * 255), clampByte(channel(g) * 255), clampByte(channel(b) * 255)];
}

function rasterProtect(width: number, height: number, strokes: ColorAdjust["protect"]): Uint8Array | null {
  if (!strokes || strokes.length === 0) return null;
  const mask = new Uint8Array(width * height);
  for (const stroke of strokes) {
    const cx = stroke.x * width;
    const cy = stroke.y * height;
    const rad = Math.max(1, stroke.r * width);
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(width - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const y1 = Math.min(height - 1, Math.ceil(cy + rad));
    const rad2 = rad * rad;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= rad2) mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

export function gradeAdjustRgba(
  data: Uint8Array | Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  adjust: ColorAdjust,
): void {
  const n = width * height;
  if (width < 1 || height < 1 || data.length < n * 4) throw new Error("图片数据长度不足");
  const protect = rasterProtect(width, height, adjust.protect);
  const pixelAdjust = protect ? { ...adjust, protect: undefined } : adjust;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (protect?.[i]) continue;
    const [r, g, b] = gradeAdjustPixel(pixelAdjust, data[o]!, data[o + 1]!, data[o + 2]!);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
  const clarity = signed(adjust.clarity) * 0.85 + signed(adjust.sharpen) * 1.15;
  if (Math.abs(clarity) > 0.03) applyClearClarity(data, width, height, clarity);
  applySpatialAdjust(data, width, height, adjust);
}

export function isClearGradeSourceUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "aliyuncs.com" || host.endsWith(".aliyuncs.com")) return true;
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim();
  if (!base) return false;
  try {
    return new URL(base).hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function renderClearGradeJpeg(
  input: Buffer,
  gradeId = "clear",
  adjust?: ColorAdjust | null,
): Promise<Buffer> {
  if (input.byteLength < 32) throw new Error("图片内容为空");
  if (input.byteLength > MAX_BYTES) throw new Error("图片过大");
  const meta = await sharp(input, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height) throw new Error("无法读取图片");
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (Math.max(meta.width, meta.height) > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (adjust && !colorAdjustIsNeutral(adjust)) gradeAdjustRgba(data, info.width, info.height, adjust);
  else gradeLocalRgba(data, info.width, info.height, gradeId);
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
}
