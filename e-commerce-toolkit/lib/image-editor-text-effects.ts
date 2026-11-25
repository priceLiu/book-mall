import type { CSSProperties } from "react";

import type { EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

import {
  patchImageEditorTextExtras,
  patchImageEditorTextLayer,
  type ImageEditorTextDocument,
  type ImageEditorTextLayerExtras,
  type ImageEditorTextStroke,
} from "@/lib/image-editor-text";

export type ImageEditorTextEffectGroup = "basic" | "flower";

type SolidFill = { kind: "solid"; color: string };
type LinearFill = { kind: "linear"; image: string };
type EffectFill = SolidFill | LinearFill;

type EffectPaint = {
  fill: EffectFill;
  /** 描边半径，相对字号 */
  ring?: { radius: number; color: string };
  /** 立体厚度，每步偏移相对字号 */
  extrude?: { steps: number; dx: number; dy: number; color: string };
  drop?: { x: number; y: number; blur: number; color: string };
  glow?: { blur: number; color: string };
};

export type ImageEditorTextEffectPreset = {
  id: string;
  group: ImageEditorTextEffectGroup;
  vip?: boolean;
  paint: EffectPaint;
  layer: Partial<EcomCopyOverlayLayer>;
};

function fxLayer(
  color: string,
  opts?: { stroke?: string; extrude?: string; glow?: string },
): Partial<EcomCopyOverlayLayer> {
  return {
    color,
    strokeWidth: opts?.stroke ? 2 : 0,
    strokeColor: opts?.stroke,
    shadowBlur: opts?.extrude ? 1 : 0,
    shadowOffsetX: opts?.extrude ? 3 : 0,
    shadowOffsetY: opts?.extrude ? 4 : 0,
    shadowColor: opts?.extrude,
    shadowOpacity: opts?.extrude ? 1 : 0,
    glowBlur: opts?.glow ? 16 : 0,
    glowColor: opts?.glow,
    glowOpacity: opts?.glow ? 0.9 : 0,
    textBgEnabled: false,
  };
}

function ringShadows(radiusPx: number, color: string): string[] {
  const parts: string[] = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = (Math.cos(a) * radiusPx).toFixed(2);
    const y = (Math.sin(a) * radiusPx).toFixed(2);
    parts.push(`${x}px ${y}px 0 ${color}`);
  }
  return parts;
}

function paintToCss(paint: EffectPaint, fontPx: number): CSSProperties {
  const shadows: string[] = [];
  if (paint.ring) shadows.push(...ringShadows(Math.max(0.6, paint.ring.radius * fontPx), paint.ring.color));
  if (paint.extrude) {
    const { steps, dx, dy, color } = paint.extrude;
    for (let i = 1; i <= steps; i++) {
      shadows.push(`${(dx * fontPx * i).toFixed(2)}px ${(dy * fontPx * i).toFixed(2)}px 0 ${color}`);
    }
  }
  if (paint.drop) {
    const d = paint.drop;
    shadows.push(
      `${(d.x * fontPx).toFixed(2)}px ${(d.y * fontPx).toFixed(2)}px ${Math.max(0, d.blur * fontPx).toFixed(2)}px ${d.color}`,
    );
  }
  if (paint.glow) {
    const blur = Math.max(1, paint.glow.blur * fontPx);
    shadows.push(`0 0 ${blur.toFixed(2)}px ${paint.glow.color}`);
    shadows.push(`0 0 ${(blur * 1.6).toFixed(2)}px ${paint.glow.color}`);
  }
  const textShadow = shadows.length ? shadows.join(", ") : undefined;
  if (paint.fill.kind === "solid") {
    return { color: paint.fill.color, textShadow };
  }
  return {
    color: "transparent",
    backgroundImage: paint.fill.image,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow,
  };
}

const CLEAR_FX: Partial<EcomCopyOverlayLayer> = {
  strokeWidth: 0,
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowOpacity: 0,
  glowBlur: 0,
  glowOpacity: 0,
  textBgEnabled: false,
};

export const IMAGE_EDITOR_TEXT_EFFECTS: ImageEditorTextEffectPreset[] = [
  { id: "none", group: "basic", paint: { fill: { kind: "solid", color: "#111111" } }, layer: { ...CLEAR_FX } },
  {
    id: "gold-block",
    group: "basic",
    paint: {
      fill: { kind: "solid", color: "#ffe14a" },
      ring: { radius: 0.035, color: "#1a1a1a" },
      extrude: { steps: 4, dx: 0.04, dy: 0.055, color: "#1a1a1a" },
    },
    layer: fxLayer("#ffe14a", { stroke: "#1a1a1a", extrude: "#1a1a1a" }),
  },
  {
    id: "pink-gloss",
    group: "basic",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #ffffff 0%, #ffd0e6 42%, #ff7eb3 100%)" },
      ring: { radius: 0.04, color: "#1c1c1c" },
      extrude: { steps: 3, dx: 0.035, dy: 0.05, color: "#242424" },
    },
    layer: fxLayer("#ff7eb3", { stroke: "#1c1c1c", extrude: "#242424" }),
  },
  {
    id: "cyan-pop",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #b8fff4 0%, #2ee6c7 55%, #12c4b4 100%)" },
      ring: { radius: 0.03, color: "#0c3d44" },
      extrude: { steps: 4, dx: 0.02, dy: 0.06, color: "#0e6e78" },
    },
    layer: fxLayer("#2ee6c7", { stroke: "#0c3d44", extrude: "#0e6e78" }),
  },
  {
    id: "sunset-block",
    group: "flower",
    vip: true,
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #ffd7a8 0%, #ff8a4a 48%, #ff5a2a 100%)" },
      ring: { radius: 0.028, color: "#7a3418" },
      extrude: { steps: 4, dx: 0.03, dy: 0.055, color: "#e36a32" },
    },
    layer: fxLayer("#ff8a4a", { stroke: "#7a3418", extrude: "#e36a32" }),
  },
  {
    id: "amber-3d",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #fff0a8 0%, #ffd24a 40%, #ffb703 100%)" },
      ring: { radius: 0.03, color: "#8a5a00" },
      extrude: { steps: 4, dx: 0.045, dy: 0.05, color: "#f0a000" },
    },
    layer: fxLayer("#ffb703", { stroke: "#8a5a00", extrude: "#f0a000" }),
  },
  {
    id: "sky-flat",
    group: "flower",
    paint: {
      fill: { kind: "solid", color: "#3aa0ff" },
      ring: { radius: 0.05, color: "#ffffff" },
      extrude: { steps: 2, dx: 0.015, dy: 0.04, color: "#2b7fd4" },
    },
    layer: fxLayer("#3aa0ff", { stroke: "#ffffff", extrude: "#2b7fd4" }),
  },
  {
    id: "ice",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #ffffff 0%, #d7ebff 100%)" },
      drop: { x: 0, y: 0.04, blur: 0.12, color: "rgba(126,182,255,0.85)" },
      glow: { blur: 0.22, color: "rgba(186,220,255,0.95)" },
    },
    layer: fxLayer("#d7ebff", { glow: "#d7ebff" }),
  },
  {
    id: "scarlet",
    group: "flower",
    paint: {
      fill: { kind: "solid", color: "#ff3b3b" },
      ring: { radius: 0.04, color: "#ffffff" },
      extrude: { steps: 3, dx: 0.04, dy: 0.045, color: "#d21c1c" },
    },
    layer: fxLayer("#ff3b3b", { stroke: "#ffffff", extrude: "#d21c1c" }),
  },
  {
    id: "neon-pink",
    group: "flower",
    vip: true,
    paint: {
      fill: { kind: "solid", color: "#ffffff" },
      glow: { blur: 0.28, color: "#ff4fd8" },
    },
    layer: fxLayer("#ffffff", { glow: "#ff4fd8" }),
  },
  {
    id: "magenta-ink",
    group: "flower",
    vip: true,
    paint: {
      fill: { kind: "solid", color: "#ff4fa3" },
      ring: { radius: 0.055, color: "#1a1020" },
    },
    layer: fxLayer("#ff4fa3", { stroke: "#1a1020" }),
  },
  {
    id: "tangerine",
    group: "flower",
    vip: true,
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #ffd0a0 0%, #ff8c32 100%)" },
      extrude: { steps: 4, dx: 0.015, dy: 0.06, color: "#f07a18" },
    },
    layer: fxLayer("#ff8c32", { extrude: "#f07a18" }),
  },
  {
    id: "cream",
    group: "flower",
    paint: {
      fill: { kind: "solid", color: "#ffe7a8" },
      extrude: { steps: 2, dx: 0.01, dy: 0.04, color: "#e6c36a" },
      glow: { blur: 0.2, color: "rgba(255,236,180,0.95)" },
    },
    layer: fxLayer("#ffe7a8", { extrude: "#e6c36a", glow: "#ffe7a8" }),
  },
  {
    id: "mint",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #eafff2 0%, #7dffa8 55%, #5ee6c0 100%)" },
      drop: { x: 0.02, y: 0.05, blur: 0.02, color: "rgba(40,140,90,0.35)" },
      glow: { blur: 0.16, color: "rgba(184,255,208,0.9)" },
    },
    layer: fxLayer("#7dffa8", { glow: "#b8ffd0" }),
  },
  {
    id: "blush-metal",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(160deg, #fff5f8 0%, #ffb3d0 45%, #ff6fa8 100%)" },
      ring: { radius: 0.04, color: "#2a1020" },
      extrude: { steps: 3, dx: 0.04, dy: 0.05, color: "#ff7ab8" },
    },
    layer: fxLayer("#ff6fa8", { stroke: "#2a1020", extrude: "#ff7ab8" }),
  },
  {
    id: "bubblegum",
    group: "flower",
    paint: {
      fill: { kind: "solid", color: "#ff8eb8" },
      ring: { radius: 0.05, color: "#ffffff" },
      extrude: { steps: 2, dx: 0.02, dy: 0.04, color: "#ffb3d0" },
    },
    layer: fxLayer("#ff8eb8", { stroke: "#ffffff", extrude: "#ffb3d0" }),
  },
  {
    id: "gold-vip",
    group: "flower",
    vip: true,
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #fff6c8 0%, #ffd15c 42%, #e6a317 100%)" },
      ring: { radius: 0.04, color: "#1a1a1a" },
      extrude: { steps: 3, dx: 0.03, dy: 0.05, color: "#8a6a12" },
    },
    layer: fxLayer("#ffd15c", { stroke: "#1a1a1a", extrude: "#8a6a12" }),
  },
  {
    id: "aqua",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #f4fffe 0%, #b7fff4 100%)" },
      extrude: { steps: 3, dx: 0.02, dy: 0.05, color: "#8ee8e0" },
      glow: { blur: 0.14, color: "rgba(190,255,248,0.9)" },
    },
    layer: fxLayer("#b7fff4", { extrude: "#8ee8e0", glow: "#b7fff4" }),
  },
  {
    id: "hot",
    group: "flower",
    paint: {
      fill: { kind: "solid", color: "#ff4d8d" },
      ring: { radius: 0.035, color: "#ffffff" },
      extrude: { steps: 3, dx: 0.02, dy: 0.055, color: "#ff8eb0" },
    },
    layer: fxLayer("#ff4d8d", { stroke: "#ffffff", extrude: "#ff8eb0" }),
  },
  {
    id: "jade",
    group: "flower",
    paint: {
      fill: { kind: "linear", image: "linear-gradient(180deg, #ffffff 0%, #e8fff4 70%, #b8ffd8 100%)" },
      extrude: { steps: 3, dx: 0.015, dy: 0.05, color: "#5ddeb0" },
    },
    layer: fxLayer("#e8fff4", { extrude: "#5ddeb0" }),
  },
  {
    id: "pearl",
    group: "flower",
    vip: true,
    paint: {
      fill: { kind: "solid", color: "#ffffff" },
      ring: { radius: 0.04, color: "#9fd4ff" },
      glow: { blur: 0.2, color: "rgba(185,226,255,0.95)" },
    },
    layer: fxLayer("#ffffff", { stroke: "#9fd4ff", glow: "#b9e2ff" }),
  },
];

const byId = new Map(IMAGE_EDITOR_TEXT_EFFECTS.map((item) => [item.id, item]));

export function imageEditorTextEffect(id: string | undefined): ImageEditorTextEffectPreset | undefined {
  if (!id) return byId.get("none");
  return byId.get(id);
}

export type ImageEditorTextEffectStyle = {
  fill: CSSProperties;
  /** 渐变字的立体层：单独铺在填充下面，避免 background-clip 把阴影裁掉 */
  underlayShadow?: string;
};

export function imageEditorTextEffectStyle(
  id: string | undefined,
  fontPx: number,
): ImageEditorTextEffectStyle | null {
  if (!id || id === "none") return null;
  const preset = byId.get(id);
  if (!preset) return null;
  const built = paintToCss(preset.paint, Math.max(10, fontPx));
  if (preset.paint.fill.kind === "linear") {
    const { textShadow, ...fill } = built;
    return { fill, underlayShadow: typeof textShadow === "string" ? textShadow : undefined };
  }
  return { fill: built };
}

export function shadowPoseFromOffsets(x: number, y: number): { angle: number; distance: number } {
  const distance = Math.hypot(x, y);
  if (distance < 0.5) return { angle: -90, distance: 0 };
  return {
    angle: Math.round((Math.atan2(-y, x) * 180) / Math.PI),
    distance: Math.round(distance),
  };
}

export const IMAGE_EDITOR_MAX_STROKES = 3;

const STROKE_COLORS = ["#1e3a8a", "#c4a574", "#e23b2f"];

export function readImageEditorStrokes(
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras | undefined,
): ImageEditorTextStroke[] {
  if (extras?.strokes && extras.strokes.length > 0) return extras.strokes.slice(0, IMAGE_EDITOR_MAX_STROKES);
  if ((layer.strokeWidth ?? 0) > 0 || extras?.strokeHidden) {
    return [
      {
        width: Math.max(1, Math.round(layer.strokeWidth ?? 8)),
        color: layer.strokeColor || STROKE_COLORS[0],
        opacity: extras?.strokeOpacity ?? 100,
        hidden: Boolean(extras?.strokeHidden),
      },
    ];
  }
  return [];
}

export function commitImageEditorStrokes(strokes: ImageEditorTextStroke[]): {
  layer: Partial<EcomCopyOverlayLayer>;
  extras: Partial<ImageEditorTextLayerExtras>;
} {
  const list = strokes.slice(0, IMAGE_EDITOR_MAX_STROKES);
  if (list.length === 0) {
    return { layer: { strokeWidth: 0 }, extras: { strokes: undefined, strokeHidden: false } };
  }
  const first = list[0];
  return {
    layer: { strokeWidth: Math.max(1, Math.round(first.width)), strokeColor: first.color },
    extras: {
      strokes: list.length > 1 ? list : undefined,
      strokeOpacity: first.opacity,
      strokeHidden: Boolean(first.hidden),
    },
  };
}

export function nextImageEditorStroke(index: number): ImageEditorTextStroke {
  return { width: 14, color: STROKE_COLORS[index] ?? STROKE_COLORS[0], opacity: 100 };
}

/** 弹层里改第一条描边时，同步到多描边列表。 */
export function reconcileStrokePatch(
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras,
  patch: { layer?: Partial<EcomCopyOverlayLayer>; extras?: Partial<ImageEditorTextLayerExtras> },
): { layer?: Partial<EcomCopyOverlayLayer>; extras?: Partial<ImageEditorTextLayerExtras> } {
  if (patch.extras && Object.prototype.hasOwnProperty.call(patch.extras, "strokes")) return patch;
  const list = extras.strokes;
  if (!list || list.length < 2) {
    if (patch.layer?.strokeWidth === 0) {
      return { ...patch, extras: { ...patch.extras, strokes: undefined } };
    }
    return patch;
  }
  if (patch.layer?.strokeWidth === 0) {
    return { ...patch, extras: { ...patch.extras, strokes: undefined, strokeHidden: false } };
  }
  const first = { ...list[0] };
  if (patch.layer?.strokeWidth != null) first.width = patch.layer.strokeWidth;
  if (patch.layer?.strokeColor) first.color = patch.layer.strokeColor;
  if (patch.extras?.strokeOpacity != null) first.opacity = patch.extras.strokeOpacity;
  if (patch.extras?.strokeHidden != null) first.hidden = patch.extras.strokeHidden;
  return { ...patch, extras: { ...patch.extras, strokes: [first, ...list.slice(1)] } };
}

export function shadowOffsetsFromPose(angle: number, distance: number): { shadowOffsetX: number; shadowOffsetY: number } {
  const rad = (angle * Math.PI) / 180;
  return {
    shadowOffsetX: Math.round(distance * Math.cos(rad)),
    shadowOffsetY: Math.round(-distance * Math.sin(rad)),
  };
}

function withAlpha(color: string, opacity: number): string {
  const alpha = Math.max(0, Math.min(1, opacity));
  const hex = color.trim();
  const full = /^#[0-9a-fA-F]{3}$/.test(hex)
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  if (/^#[0-9a-fA-F]{6}$/.test(full)) {
    const n = Number.parseInt(full.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  return color;
}

export type ImageEditorTextAdjustStyle = {
  fill: CSSProperties;
  boxBackgroundColor?: string;
  boxPadding?: string;
  boxRadius?: string;
};

/** 调节面板改过的参数：按描边 / 投影 / 外发光 / 背景画到画布上 */
export function imageEditorTextAdjustStyle(
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras | undefined,
  exportScale: number,
): ImageEditorTextAdjustStyle {
  const scale = Math.max(exportScale, 0.48);
  const shadows: string[] = [];
  const strokeRings: Array<{ radius: number; color: string }> = [];
  let strokeRadius = 0;
  for (const stroke of readImageEditorStrokes(layer, extras)) {
    if (stroke.hidden || stroke.width <= 0) continue;
    strokeRadius += Math.max(1, stroke.width) * scale;
    strokeRings.push({
      radius: strokeRadius,
      color: withAlpha(stroke.color, (stroke.opacity ?? 100) / 100),
    });
  }
  for (const ring of strokeRings.reverse()) {
    shadows.push(...ringShadows(ring.radius, ring.color));
  }
  if ((layer.glowBlur ?? 0) > 0 && !extras?.glowHidden) {
    const blur = Math.max(1, (layer.glowBlur ?? 0) * scale);
    const color = withAlpha(layer.glowColor ?? "#ffffff", layer.glowOpacity ?? 0.9);
    shadows.push(`0 0 ${blur.toFixed(1)}px ${color}`, `0 0 ${(blur * 1.45).toFixed(1)}px ${color}`);
  }
  const pose = shadowPoseFromOffsets(layer.shadowOffsetX ?? 0, layer.shadowOffsetY ?? 0);
  const angle = extras?.shadowAngle ?? pose.angle;
  const distance = extras?.shadowDistance ?? pose.distance;
  const offset = shadowOffsetsFromPose(angle, distance);
  const ox = offset.shadowOffsetX * scale;
  const oy = offset.shadowOffsetY * scale;
  const blur = Math.max(0, (layer.shadowBlur ?? 0) * scale);
  const shadowOn =
    !extras?.shadowHidden && (blur > 0.4 || Math.hypot(ox, oy) > 0.4 || (layer.shadowBlur ?? 0) > 0);
  if (shadowOn) {
    shadows.push(
      `${ox.toFixed(1)}px ${oy.toFixed(1)}px ${blur.toFixed(1)}px ${withAlpha(layer.shadowColor ?? "#000000", layer.shadowOpacity ?? 1)}`,
    );
  }
  const fill: CSSProperties = {
    color: withAlpha(layer.color ?? "#ffffff", (extras?.fillOpacity ?? 100) / 100),
    textShadow: shadows.length ? shadows.join(", ") : undefined,
  };
  if (!layer.textBgEnabled || extras?.bgHidden) return { fill };
  const pad = Math.max(2, Math.round((layer.textBgPaddingPx ?? 10) * exportScale));
  const radius = Math.max(0, Math.round((layer.textBgRadiusPx ?? 8) * exportScale));
  return {
    fill,
    boxBackgroundColor: withAlpha(layer.textBgColor ?? "#000000", layer.textBgOpacity ?? 1),
    boxPadding: `${pad}px`,
    boxRadius: `${radius}px`,
  };
}

export function applyImageEditorTextEffect(
  doc: ImageEditorTextDocument,
  layerId: string,
  effectId: string,
): ImageEditorTextDocument {
  const preset = byId.get(effectId) ?? byId.get("none")!;
  const layerPatch = preset.id === "none" ? { ...CLEAR_FX } : { ...CLEAR_FX, ...preset.layer };
  const pose = shadowPoseFromOffsets(layerPatch.shadowOffsetX ?? 0, layerPatch.shadowOffsetY ?? 0);
  let next = patchImageEditorTextLayer(doc, layerId, layerPatch);
  next = patchImageEditorTextExtras(next, layerId, {
    effectId: preset.id === "none" ? undefined : preset.id,
    flowerId: undefined,
    fillOpacity: 100,
    strokeOpacity: 100,
    strokeHidden: false,
    strokes: undefined,
    shadowHidden: false,
    glowHidden: false,
    bgHidden: false,
    shadowAngle: pose.angle,
    shadowDistance: pose.distance,
  });
  return next;
}
