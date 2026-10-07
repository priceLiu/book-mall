import { defaultCopyOverlayLayer, normalizeEcomCopyText } from "./defaults";
import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";

function clamp01(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function newOverlayLayerId(overlay: EcomCopyOverlay): string {
  if (!overlay.layers.some((l) => l.id === "main")) return "main";
  let n = overlay.layers.length + 1;
  while (overlay.layers.some((l) => l.id === `text-${n}`)) n += 1;
  return `text-${n}`;
}

export function layerListLabel(layer: EcomCopyOverlayLayer, index: number): string {
  const preview = layer.text.replace(/\s+/g, " ").trim().slice(0, 18);
  if (preview) return `文案 ${index + 1} · ${preview}`;
  return `文案 ${index + 1}（空）`;
}

export function addOverlayTextLayer(overlay: EcomCopyOverlay): {
  overlay: EcomCopyOverlay;
  layerId: string;
} {
  const id = newOverlayLayerId(overlay);
  const index = overlay.layers.length;
  const base = defaultCopyOverlayLayer("");
  const layer: EcomCopyOverlayLayer = {
    ...base,
    id,
    text: "",
    nx: 0.5,
    ny: clamp01(0.1 + index * 0.1, 0.12),
    fontSize: Math.max(20, 40 - index * 4),
    textAlign: index === 0 ? "center" : "left",
    maxWidthNorm: 0.88,
  };
  return {
    overlay: { ...overlay, layers: [...overlay.layers, layer] },
    layerId: id,
  };
}

export function removeOverlayLayer(overlay: EcomCopyOverlay, id: string): EcomCopyOverlay {
  if (overlay.layers.length <= 1) return overlay;
  return { ...overlay, layers: overlay.layers.filter((l) => l.id !== id) };
}

export function patchOverlayLayerText(
  overlay: EcomCopyOverlay,
  id: string,
  text: string,
): EcomCopyOverlay {
  const t = normalizeEcomCopyText(text);
  return {
    ...overlay,
    layers: overlay.layers.map((l) => (l.id === id ? { ...l, text: t } : l)),
  };
}

export function primarySlotCopyFromOverlay(overlay: EcomCopyOverlay): string {
  const main = overlay.layers.find((l) => l.id === "main");
  if (main?.text.trim()) return normalizeEcomCopyText(main.text);
  const parts = overlay.layers
    .map((l) => normalizeEcomCopyText(l.text))
    .filter(Boolean);
  return parts.join("\n");
}

export function overlayHasAnyCopy(overlay: EcomCopyOverlay): boolean {
  return overlay.layers.some((l) => normalizeEcomCopyText(l.text));
}
