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

export function layerPreviewTextShadow(
  layer: EcomCopyOverlayLayer,
  scale: number,
): string | undefined {
  const parts: string[] = [];
  const glow = resolveLayerGlow(layer);
  if (glow) {
    const blur = Math.max(2, glow.blur * scale);
    parts.push(`0 0 ${blur}px ${rgbaCss(glow.color, glow.opacity)}`);
    parts.push(`0 0 ${blur * 1.4}px ${rgbaCss(glow.color, glow.opacity * 0.6)}`);
  }
  const sh = resolveLayerShadow(layer);
  if (sh) {
    const ox = sh.offsetX * scale;
    const oy = sh.offsetY * scale;
    const blur = Math.max(1, sh.blur * scale);
    const c = rgbaCss(sh.color, sh.opacity);
    parts.push(`${ox}px ${oy}px ${blur}px ${c}`);
  }
  return parts.length ? parts.join(", ") : undefined;
}

export type LayerPreviewTextExtras = {
  WebkitTextStroke?: string;
  backgroundColor?: string;
  padding?: string;
  borderRadius?: string;
  boxDecorationBreak?: "clone";
};

export function layerPreviewTextExtras(
  layer: EcomCopyOverlayLayer,
  scale: number,
): LayerPreviewTextExtras {
  const extras: LayerPreviewTextExtras = {};
  const stroke = resolveLayerStroke(layer);
  if (stroke) {
    const w = Math.max(0.5, stroke.width * scale);
    extras.WebkitTextStroke = `${w}px ${stroke.color}`;
  }
  const bg = resolveLayerTextBg(layer);
  if (bg) {
    extras.backgroundColor = rgbaCss(bg.color, bg.opacity);
    extras.padding = `${bg.paddingPx * scale}px`;
    extras.borderRadius = `${bg.radiusPx * scale}px`;
    extras.boxDecorationBreak = "clone";
  }
  return extras;
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
