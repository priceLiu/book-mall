export type ColorAdjustStroke = { x: number; y: number; r: number };

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
  /** 6 个色块各自的色相 / 饱和度 / 明度，顺序与高级调色 HSL 色块一致。 */
  hslBands?: Array<[number, number, number]>;
  cleanWhite?: boolean;
  recolorSource?: [number, number, number];
  recolorTarget?: [number, number, number];
  recolorTolerance?: number;
  protect?: ColorAdjustStroke[];
};

const NUM_KEYS = [
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

export function colorAdjustIsNeutral(adjust: ColorAdjust): boolean {
  for (const key of NUM_KEYS) {
    if ((adjust[key] ?? 0) !== 0) return false;
  }
  if (adjust.cleanWhite) return false;
  if (adjust.recolorSource && adjust.recolorTarget) return false;
  if (adjust.hslBands?.some((band) => band.some((n) => n !== 0))) return false;
  return true;
}

/** 拖动时的即时预览。松手后由像素结果替换。 */
export function colorAdjustPreviewCss(adjust: ColorAdjust): string {
  let bandHue = 0;
  let bandSat = 0;
  let bandLight = 0;
  for (const band of adjust.hslBands ?? []) {
    bandHue += band[0] ?? 0;
    bandSat += band[1] ?? 0;
    bandLight += band[2] ?? 0;
  }
  const splitSat = Math.max(0, adjust.splitHighlightSat ?? 0) + Math.max(0, adjust.splitShadowSat ?? 0);
  const brightness =
    100 +
    (adjust.brightness ?? 0) * 0.65 +
    (adjust.fill ?? 0) * 0.28 +
    (adjust.shadow ?? 0) * 0.18 +
    (adjust.highlight ?? 0) * 0.16 +
    (adjust.hslLight ?? 0) * 0.4 +
    bandLight * 0.35 -
    (adjust.vignette ?? 0) * 0.22;
  const contrast =
    100 +
    (adjust.contrast ?? 0) * 0.8 +
    (adjust.clarity ?? 0) * 0.22 +
    (adjust.sharpen ?? 0) * 0.12 +
    (adjust.grain ?? 0) * 0.1;
  const saturate =
    100 +
    (adjust.saturate ?? 0) * 0.9 +
    (adjust.hslSat ?? 0) * 0.8 +
    bandSat * 0.7 -
    (adjust.fade ?? 0) * 0.45 +
    splitSat * 0.35;
  const hue = (adjust.hue ?? 0) * 0.4 + bandHue * 0.28 - (adjust.temperature ?? 0) * 0.12 + (adjust.disperse ?? 0) * 0.06;
  const sepia = Math.max(0, (adjust.fade ?? 0) * 0.22 + Math.max(0, adjust.temperature ?? 0) * 0.12 + splitSat * 0.12);
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${Math.max(0, saturate)}%) hue-rotate(${hue}deg) sepia(${sepia}%)`;
}
