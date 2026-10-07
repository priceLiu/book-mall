import { normalizeCopyFontPresetId } from "./copy-fonts";
import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";
import { ECOM_COPY_OVERLAY_VERSION } from "./types";

/** 统一换行符，仅去掉首尾空白；保留中间换行供排版与合成 */
export function normalizeEcomCopyText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\s+|\s+$/g, "");
}

/** 打开排版编辑器时：优先 main 层已存文案（含多行），与 slotCopy 对齐 */
export function resolveEditorCopyText(
  slotCopy: string,
  overlay?: EcomCopyOverlay | null,
): string {
  const main = overlay?.layers.find((l) => l.id === "main")?.text;
  if (main?.trim()) return normalizeEcomCopyText(main);
  return normalizeEcomCopyText(slotCopy);
}

export function defaultCopyOverlayLayer(text: string): EcomCopyOverlayLayer {
  return {
    id: "main",
    text: normalizeEcomCopyText(text),
    nx: 0.5,
    ny: 0.12,
    fontSize: 36,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
    maxWidthNorm: 0.88,
    maxHeightNorm: 0.55,
    writingMode: "horizontal",
  };
}

export function defaultCopyOverlay(text: string, exportWidthPx = 750): EcomCopyOverlay {
  const layers = normalizeEcomCopyText(text) ? [defaultCopyOverlayLayer(text)] : [];
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
        fontFamily: normalizeCopyFontPresetId(L.fontFamily),
        textAlign:
          L.textAlign === "left" || L.textAlign === "right" ? L.textAlign : "center",
        maxWidthNorm: clamp01(Number(L.maxWidthNorm), 0.88),
        maxHeightNorm: clamp01(Number(L.maxHeightNorm), 0.55),
        writingMode: L.writingMode === "vertical" ? "vertical" : "horizontal",
        ...(Number.isFinite(Number(L.shadowBlur))
          ? { shadowBlur: Math.max(0, Math.min(48, Math.round(Number(L.shadowBlur)))) }
          : {}),
        ...(typeof L.shadowColor === "string" ? { shadowColor: L.shadowColor } : {}),
        ...(Number.isFinite(Number(L.shadowOffsetX))
          ? { shadowOffsetX: Math.round(Number(L.shadowOffsetX)) }
          : {}),
        ...(Number.isFinite(Number(L.shadowOffsetY))
          ? { shadowOffsetY: Math.round(Number(L.shadowOffsetY)) }
          : {}),
        ...(Number.isFinite(Number(L.shadowOpacity))
          ? {
              shadowOpacity: Math.max(0, Math.min(1, Number(L.shadowOpacity))),
            }
          : {}),
        ...(Number.isFinite(Number(L.glowBlur))
          ? { glowBlur: Math.max(0, Math.min(48, Math.round(Number(L.glowBlur)))) }
          : {}),
        ...(typeof L.glowColor === "string" ? { glowColor: L.glowColor } : {}),
        ...(Number.isFinite(Number(L.glowOpacity))
          ? { glowOpacity: Math.max(0, Math.min(1, Number(L.glowOpacity))) }
          : {}),
        ...(Number.isFinite(Number(L.strokeWidth))
          ? { strokeWidth: Math.max(0, Math.min(16, Math.round(Number(L.strokeWidth)))) }
          : {}),
        ...(typeof L.strokeColor === "string" ? { strokeColor: L.strokeColor } : {}),
        ...(L.textBgEnabled === true ? { textBgEnabled: true } : {}),
        ...(typeof L.textBgColor === "string" ? { textBgColor: L.textBgColor } : {}),
        ...(Number.isFinite(Number(L.textBgOpacity))
          ? { textBgOpacity: Math.max(0, Math.min(1, Number(L.textBgOpacity))) }
          : {}),
        ...(Number.isFinite(Number(L.textBgPaddingPx))
          ? {
              textBgPaddingPx: Math.max(0, Math.min(48, Math.round(Number(L.textBgPaddingPx)))),
            }
          : {}),
        ...(Number.isFinite(Number(L.textBgRadiusPx))
          ? {
              textBgRadiusPx: Math.max(0, Math.min(32, Math.round(Number(L.textBgRadiusPx)))),
            }
          : {}),
        ...(Number.isFinite(Number(L.layoutTextWidthNorm))
          ? {
              layoutTextWidthNorm: Math.max(
                0.01,
                Math.min(1, Number(L.layoutTextWidthNorm)),
              ),
            }
          : {}),
        ...(Number.isFinite(Number(L.layoutBoxWidthNorm))
          ? {
              layoutBoxWidthNorm: Math.max(
                0.01,
                Math.min(1, Number(L.layoutBoxWidthNorm)),
              ),
            }
          : {}),
        ...(Number.isFinite(Number(L.layoutBoxHeightNorm))
          ? {
              layoutBoxHeightNorm: Math.max(
                0.01,
                Math.min(1, Number(L.layoutBoxHeightNorm)),
              ),
            }
          : {}),
        ...(Number.isFinite(Number(L.layoutTextHeightNorm))
          ? {
              layoutTextHeightNorm: Math.max(
                0.01,
                Math.min(1, Number(L.layoutTextHeightNorm)),
              ),
            }
          : {}),
        ...(Number.isFinite(Number(L.layoutBoxWidthPx))
          ? {
              layoutBoxWidthPx: Math.max(
                1,
                Math.min(4096, Math.round(Number(L.layoutBoxWidthPx))),
              ),
            }
          : {}),
        ...(Number.isFinite(Number(L.layoutBoxHeightPx))
          ? {
              layoutBoxHeightPx: Math.max(
                1,
                Math.min(4096, Math.round(Number(L.layoutBoxHeightPx))),
              ),
            }
          : {}),
      },
    ];
  });
  return { version: 1, exportWidthPx, baseImageUrl, layers };
}

export function syncOverlayMainLayerText(
  overlay: EcomCopyOverlay,
  text: string,
): EcomCopyOverlay {
  const t = normalizeEcomCopyText(text);
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
  const exportWidthPx = opts.exportWidthPx;
  const baseImageUrl = opts.baseImageUrl?.trim();

  if (opts.overlay?.layers && opts.overlay.layers.length > 0) {
    let next: EcomCopyOverlay = {
      ...opts.overlay,
      version: 1,
      exportWidthPx,
      layers: opts.overlay.layers.map((l) => ({ ...l })),
    };
    if (baseImageUrl) next = { ...next, baseImageUrl };
    return next;
  }

  let next = defaultCopyOverlay(opts.text, exportWidthPx);
  next = syncOverlayMainLayerText(next, opts.text);
  if (next.layers.length === 0) {
    next = { ...next, layers: [defaultCopyOverlayLayer(opts.text)] };
  }
  if (baseImageUrl) next = { ...next, baseImageUrl };
  return next;
}
