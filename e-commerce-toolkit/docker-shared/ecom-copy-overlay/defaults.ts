import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";
import { ECOM_COPY_OVERLAY_VERSION } from "./types";

export function defaultCopyOverlayLayer(text: string): EcomCopyOverlayLayer {
  return {
    id: "main",
    text: text.trim(),
    nx: 0.5,
    ny: 0.12,
    fontSize: 36,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
    maxWidthNorm: 0.88,
  };
}

export function defaultCopyOverlay(text: string, exportWidthPx = 750): EcomCopyOverlay {
  const layers = text.trim() ? [defaultCopyOverlayLayer(text)] : [];
  return {
    version: ECOM_COPY_OVERLAY_VERSION,
    exportWidthPx,
    layers,
  };
}

function clamp01(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function parseEcomCopyOverlay(raw: unknown): EcomCopyOverlay | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return undefined;
  const exportWidthPx = Math.max(
    320,
    Math.min(4096, Math.round(Number(o.exportWidthPx) || 750)),
  );
  const baseImageUrl =
    typeof o.baseImageUrl === "string" && o.baseImageUrl.trim()
      ? o.baseImageUrl.trim()
      : undefined;
  const layersRaw = Array.isArray(o.layers) ? o.layers : [];
  const layers = layersRaw.flatMap((item): EcomCopyOverlayLayer[] => {
    if (!item || typeof item !== "object") return [];
    const L = item as Record<string, unknown>;
    return [
      {
        id: typeof L.id === "string" && L.id.trim() ? L.id.trim() : "main",
        text: typeof L.text === "string" ? L.text : "",
        nx: clamp01(Number(L.nx), 0.5),
        ny: clamp01(Number(L.ny), 0.12),
        fontSize: Math.max(12, Math.min(120, Math.round(Number(L.fontSize) || 32))),
        color: typeof L.color === "string" ? L.color : "#ffffff",
        fontWeight: L.fontWeight === "normal" ? "normal" : "bold",
        textAlign:
          L.textAlign === "left" || L.textAlign === "right" ? L.textAlign : "center",
        maxWidthNorm: clamp01(Number(L.maxWidthNorm), 0.88),
      },
    ];
  });
  return { version: 1, exportWidthPx, baseImageUrl, layers };
}

export function syncOverlayMainLayerText(
  overlay: EcomCopyOverlay,
  text: string,
): EcomCopyOverlay {
  const t = text.trim();
  if (!t && overlay.layers.length === 0) return overlay;
  const layers = [...overlay.layers];
  const mainIdx = layers.findIndex((l) => l.id === "main");
  if (mainIdx >= 0) {
    layers[mainIdx] = { ...layers[mainIdx]!, text: t };
  } else if (t) {
    layers.unshift(defaultCopyOverlayLayer(t));
  }
  return { ...overlay, layers };
}

export function resolveOverlayForEditor(opts: {
  overlay?: EcomCopyOverlay | null;
  text: string;
  exportWidthPx: number;
  baseImageUrl?: string;
}): EcomCopyOverlay {
  const base = opts.overlay ?? defaultCopyOverlay(opts.text, opts.exportWidthPx);
  let next = syncOverlayMainLayerText(base, opts.text);
  if (opts.baseImageUrl?.trim()) {
    next = { ...next, baseImageUrl: opts.baseImageUrl.trim() };
  }
  return { ...next, exportWidthPx: opts.exportWidthPx };
}
