import type { EcomCopyOverlayLayer } from "./types";

export type ResolvedLayerShadow = {
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
  opacity: number;
};

export type ResolvedLayerGlow = {
  blur: number;
  color: string;
  opacity: number;
};

export type ResolvedLayerStroke = {
  width: number;
  color: string;
};

export type ResolvedLayerTextBg = {
  color: string;
  opacity: number;
  paddingPx: number;
  radiusPx: number;
};

/** 仅 shadowBlur > 0 时启用（不再默认隐式投影） */
export function resolveLayerShadow(layer: EcomCopyOverlayLayer): ResolvedLayerShadow | null {
  const blur = layer.shadowBlur;
  if (blur == null || blur <= 0) return null;
  return {
    blur,
    offsetX: layer.shadowOffsetX ?? 0,
    offsetY: layer.shadowOffsetY ?? 3,
    color: layer.shadowColor?.trim() || "#000000",
    opacity: layer.shadowOpacity ?? 0.65,
  };
}

export function resolveLayerGlow(layer: EcomCopyOverlayLayer): ResolvedLayerGlow | null {
  const blur = layer.glowBlur;
  if (blur == null || blur <= 0) return null;
  return {
    blur,
    color: layer.glowColor?.trim() || "#ffffff",
    opacity: layer.glowOpacity ?? 0.75,
  };
}

export function resolveLayerStroke(layer: EcomCopyOverlayLayer): ResolvedLayerStroke | null {
  const width = layer.strokeWidth;
  if (width == null || width <= 0) return null;
  return {
    width,
    color: layer.strokeColor?.trim() || "#000000",
  };
}

export function resolveLayerTextBg(layer: EcomCopyOverlayLayer): ResolvedLayerTextBg | null {
  if (!layer.textBgEnabled) return null;
  const color = layer.textBgColor?.trim() || "#000000";
  return {
    color,
    opacity: layer.textBgOpacity ?? 0.45,
    paddingPx: layer.textBgPaddingPx ?? 10,
    radiusPx: layer.textBgRadiusPx ?? 6,
  };
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return "0,0,0";
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function rgbaCss(hex: string, opacity: number): string {
  const rgb = hex.startsWith("#") ? hex : "#000000";
  return `rgba(${hexToRgb(rgb)}, ${opacity})`;
}

/** 画布预览略放大特效，避免缩小底图时几乎看不见 */
export function previewFxScale(exportScale: number): number {
  return Math.max(exportScale, 0.48);
}

function strokeAsTextShadowParts(stroke: ResolvedLayerStroke, scale: number): string[] {
  const w = Math.max(1, Math.round(stroke.width * scale));
  const c = stroke.color;
  const parts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const dx = Math.round(Math.cos(a) * w);
    const dy = Math.round(Math.sin(a) * w);
    parts.push(`${dx}px ${dy}px 0 ${c}`);
  }
  return parts;
}

function buildPreviewTextShadowParts(layer: EcomCopyOverlayLayer, scale: number): string[] {
  const parts: string[] = [];
  const stroke = resolveLayerStroke(layer);
  if (stroke) parts.push(...strokeAsTextShadowParts(stroke, scale));

  const glow = resolveLayerGlow(layer);
  if (glow) {
    const blur = Math.max(2, glow.blur * scale);
    parts.push(`0 0 ${blur}px ${rgbaCss(glow.color, glow.opacity)}`);
    parts.push(`0 0 ${blur * 1.35}px ${rgbaCss(glow.color, glow.opacity * 0.55)}`);
  }
  const sh = resolveLayerShadow(layer);
  if (sh) {
    const ox = sh.offsetX * scale;
    const oy = sh.offsetY * scale;
    const blur = Math.max(1, sh.blur * scale);
    parts.push(`${ox}px ${oy}px ${blur}px ${rgbaCss(sh.color, sh.opacity)}`);
  }
  return parts;
}

export function layerPreviewTextShadow(
  layer: EcomCopyOverlayLayer,
  scale: number,
): string | undefined {
  const parts = buildPreviewTextShadowParts(layer, previewFxScale(scale));
  return parts.length ? parts.join(", ") : undefined;
}

export type LayerPreviewCanvasFx = {
  textShadow?: string;
  boxBackgroundColor?: string;
  boxPadding?: string;
  boxRadius?: string;
};

export function layerPreviewCanvasFx(
  layer: EcomCopyOverlayLayer,
  exportScale: number,
): LayerPreviewCanvasFx {
  const shadowScale = previewFxScale(exportScale);
  const parts = buildPreviewTextShadowParts(layer, shadowScale);
  const bg = resolveLayerTextBg(layer);
  const layoutScale = exportScale;
  return {
    textShadow: parts.length ? parts.join(", ") : undefined,
    ...(bg
      ? {
          boxBackgroundColor: rgbaCss(bg.color, bg.opacity),
          boxPadding: `${Math.max(2, Math.round(bg.paddingPx * layoutScale))}px`,
          boxRadius: `${Math.max(2, Math.round(bg.radiusPx * layoutScale))}px`,
        }
      : {}),
  };
}

/** @deprecated use layerPreviewCanvasFx */
export type LayerPreviewTextExtras = LayerPreviewCanvasFx;

/** @deprecated use layerPreviewCanvasFx */
export function layerPreviewTextExtras(
  layer: EcomCopyOverlayLayer,
  scale: number,
): LayerPreviewCanvasFx {
  return layerPreviewCanvasFx(layer, scale);
}

export function layerSvgEffectFilterDef(layer: EcomCopyOverlayLayer, filterId: string): string {
  const sh = resolveLayerShadow(layer);
  const glow = resolveLayerGlow(layer);
  if (!sh && !glow) return "";
  let inner = "";
  if (glow) {
    const std = Math.max(0.5, glow.blur / 2);
    inner += `<feDropShadow dx="0" dy="0" stdDeviation="${std}" flood-color="${glow.color}" flood-opacity="${glow.opacity}"/>`;
  }
  if (sh) {
    const std = Math.max(0.5, sh.blur / 2);
    inner += `<feDropShadow dx="${sh.offsetX}" dy="${sh.offsetY}" stdDeviation="${std}" flood-color="${sh.color}" flood-opacity="${sh.opacity}"/>`;
  }
  return `<filter id="${filterId}" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB">${inner}</filter>`;
}

/** @deprecated use layerSvgEffectFilterDef */
export function layerSvgShadowFilterDef(layer: EcomCopyOverlayLayer, filterId: string): string {
  return layerSvgEffectFilterDef(layer, filterId);
}

export function layerSvgEffectFilterAttr(layer: EcomCopyOverlayLayer, filterId: string): string {
  return resolveLayerShadow(layer) || resolveLayerGlow(layer)
    ? ` filter="url(#${filterId})"`
    : "";
}

/** @deprecated */
export function layerSvgShadowFilterAttr(layer: EcomCopyOverlayLayer, filterId: string): string {
  return layerSvgEffectFilterAttr(layer, filterId);
}

export function layerSvgStrokeAttrs(layer: EcomCopyOverlayLayer): string {
  const stroke = resolveLayerStroke(layer);
  if (!stroke) return "";
  return ` stroke="${stroke.color}" stroke-width="${stroke.width}" paint-order="stroke fill"`;
}
