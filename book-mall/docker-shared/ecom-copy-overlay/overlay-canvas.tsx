"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveLayerFontCss } from "./copy-fonts";
import { computeImageContainRect } from "./layout-coords";
import { layerPreviewTextExtras, layerPreviewTextShadow } from "./text-effects";
import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";

export type EcomCopyOverlayCanvasProps = {
  baseImageUrl: string | null;
  aspectClassName?: string;
  overlay: EcomCopyOverlay;
  onChange: (overlay: EcomCopyOverlay) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  emptyHint?: string;
  maxPreviewWidthPx?: number;
  /** 全屏工作台：按可用高度放大，不再固定 560px 小图 */
  fillWorkbench?: boolean;
  /** 外框样式（全屏工作台可加大阴影） */
  frameClassName?: string;
};

type ResizeMode = "edge-e" | "edge-s" | "corner";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function EcomCopyOverlayCanvas({
  baseImageUrl,
  aspectClassName = "aspect-[3/4]",
  overlay,
  onChange,
  selectedLayerId,
  onSelectLayer,
  emptyHint = "请先选择底图，再拖拽排版文字",
  maxPreviewWidthPx = 320,
  fillWorkbench = false,
  frameClassName = "",
}: EcomCopyOverlayCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({
    w: maxPreviewWidthPx,
    h: maxPreviewWidthPx * (4 / 3),
  });
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const contentRef = useRef({ x: 0, y: 0, w: 1, h: 1 });

  const content = useMemo(() => {
    const iw = imgNatural?.w ?? overlay.exportWidthPx;
    const ih = imgNatural?.h ?? Math.round(overlay.exportWidthPx * (4 / 3));
    return computeImageContainRect(frameSize.w, frameSize.h, iw, ih);
  }, [frameSize.h, frameSize.w, imgNatural, overlay.exportWidthPx]);

  contentRef.current = content;

  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    nx: number;
    ny: number;
  } | null>(null);
  const [resize, setResize] = useState<{
    id: string;
    mode: ResizeMode;
    startX: number;
    startY: number;
    maxWidthNorm: number;
    maxHeightNorm: number;
    fontSize: number;
  } | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setFrameSize({ w: r.width, h: r.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setImgNatural(null);
  }, [baseImageUrl]);

  const updateLayer = useCallback(
    (id: string, patch: Partial<EcomCopyOverlayLayer>) => {
      onChange({
        ...overlay,
        layers: overlay.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
    },
    [onChange, overlay],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const c = contentRef.current;
      const dx = (e.clientX - drag.startX) / Math.max(1, c.w);
      const dy = (e.clientY - drag.startY) / Math.max(1, c.h);
      updateLayer(drag.id, {
        nx: clamp(drag.nx + dx, 0, 1),
        ny: clamp(drag.ny + dy, 0, 1),
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, updateLayer]);

  useEffect(() => {
    if (!resize) return;
    const onMove = (e: PointerEvent) => {
      const c = contentRef.current;
      const dx = (e.clientX - resize.startX) / Math.max(1, c.w);
      const dy = (e.clientY - resize.startY) / Math.max(1, c.h);
      const layer = overlay.layers.find((l) => l.id === resize.id);
      const vertical = layer?.writingMode === "vertical";

      if (resize.mode === "edge-e") {
        updateLayer(resize.id, {
          maxWidthNorm: clamp(resize.maxWidthNorm + dx * 1.05, 0.08, 0.96),
        });
      } else if (resize.mode === "edge-s") {
        if (vertical) {
          updateLayer(resize.id, {
            maxHeightNorm: clamp(resize.maxHeightNorm + dy * 1.05, 0.12, 0.92),
          });
        } else {
          const scale = 1 + dy * 1.15;
          updateLayer(resize.id, {
            fontSize: clamp(Math.round(resize.fontSize * scale), 12, 120),
          });
        }
      } else {
        const scale = 1 + (dx + dy) * 0.55;
        updateLayer(resize.id, {
          maxWidthNorm: clamp(resize.maxWidthNorm * scale, 0.08, 0.96),
          maxHeightNorm: clamp(resize.maxHeightNorm * scale, 0.12, 0.92),
          fontSize: clamp(Math.round(resize.fontSize * scale), 12, 120),
        });
      }
    };
    const onUp = () => setResize(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [overlay.layers, resize, updateLayer]);

  const beginResize = (
    e: React.PointerEvent,
    layer: EcomCopyOverlayLayer,
    mode: ResizeMode,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectLayer(layer.id);
    setDrag(null);
    setResize({
      id: layer.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      maxWidthNorm: layer.maxWidthNorm ?? 0.88,
      maxHeightNorm: layer.maxHeightNorm ?? 0.55,
      fontSize: layer.fontSize,
    });
  };

  const scaleToExport = content.w / Math.max(1, overlay.exportWidthPx);

  return (
    <div
      className={`relative mx-auto overflow-visible rounded-xl border border-[#d2d2d7] bg-[#1d1d1f]/90 ${aspectClassName} ${frameClassName} ${
        fillWorkbench
          ? "h-full max-h-full w-auto max-w-full"
          : "w-full"
      }`}
      style={{
        maxWidth: fillWorkbench ? maxPreviewWidthPx : maxPreviewWidthPx,
        ...(fillWorkbench ? { height: "100%", maxHeight: "100%" } : {}),
      }}
    >
      <div ref={frameRef} className="absolute inset-0 overflow-visible">
        <div className="absolute inset-0 overflow-hidden rounded-[11px]">
          {baseImageUrl ? (
            <Image
              src={baseImageUrl}
              alt=""
              fill
              unoptimized
              className="object-contain"
              sizes={`${maxPreviewWidthPx}px`}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
                }
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[#86868b]">
              {emptyHint}
            </div>
          )}
        </div>
        {overlay.layers.map((layer) => {
          const isEmpty = !layer.text.trim();
          const selected = selectedLayerId === layer.id;
          if (isEmpty && !selected) return null;
          const align = layer.textAlign ?? "center";
          const vertical = layer.writingMode === "vertical";
          const fontPx = Math.max(10, layer.fontSize * scaleToExport);
          const boxW = (layer.maxWidthNorm ?? 0.88) * content.w;
          const boxH = vertical ? (layer.maxHeightNorm ?? 0.55) * content.h : undefined;
          const anchorX = content.x + layer.nx * content.w;
          const anchorY = content.y + layer.ny * content.h;
          const transform =
            align === "center"
              ? "translate(-50%, 0)"
              : align === "right"
                ? "translate(-100%, 0)"
                : undefined;
          const textFx = layerPreviewTextExtras(layer, scaleToExport);

          return (
            <div
              key={layer.id}
              className="absolute max-w-full"
              style={{
                left: anchorX,
                top: anchorY,
                maxWidth: boxW,
                maxHeight: boxH,
                transform,
              }}
            >
              <div
                className={`relative w-max max-w-full ${
                  vertical ? "inline-block" : "inline-block"
                } ${selected ? "outline outline-2 outline-[#0071e3] outline-offset-2" : ""} ${
                  isEmpty ? "outline-dashed outline-white/50" : ""
                }`}
                style={{
                  cursor: "move",
                  color: isEmpty ? "rgba(255,255,255,0.55)" : (layer.color ?? "#ffffff"),
                  fontFamily: resolveLayerFontCss(layer),
                  fontWeight: layer.fontWeight === "normal" ? 400 : 700,
                  fontSize: fontPx,
                  lineHeight: 1.25,
                  textAlign: align,
                  textShadow: layerPreviewTextShadow(layer, scaleToExport),
                  WebkitTextStroke: textFx.WebkitTextStroke,
                  backgroundColor: textFx.backgroundColor,
                  padding: textFx.padding,
                  borderRadius: textFx.borderRadius,
                  boxDecorationBreak: textFx.boxDecorationBreak,
                  whiteSpace: vertical ? "normal" : "pre-wrap",
                  wordBreak: vertical ? "keep-all" : "break-word",
                  overflowWrap: vertical ? "normal" : "anywhere",
                  writingMode: vertical ? "vertical-rl" : "horizontal-tb",
                  textOrientation: vertical ? "upright" : "mixed",
                  maxWidth: boxW,
                  maxHeight: boxH,
                }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).dataset.overlayHandle) return;
                  e.stopPropagation();
                  onSelectLayer(layer.id);
                  setResize(null);
                  setDrag({
                    id: layer.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    nx: layer.nx,
                    ny: layer.ny,
                  });
                }}
              >
                {isEmpty ? "在此输入文案" : layer.text}
                {selected ? (
                  <>
                    <div
                      data-overlay-handle="1"
                      title="拖动拉伸宽度"
                      className="absolute bottom-0 right-0 top-0 z-10 w-2 translate-x-1/2 cursor-ew-resize"
                      onPointerDown={(e) => beginResize(e, layer, "edge-e")}
                    />
                    <div
                      data-overlay-handle="1"
                      title={vertical ? "拖动拉伸列高" : "拖动调整字号"}
                      className="absolute bottom-0 left-0 right-0 z-10 h-2 translate-y-1/2 cursor-ns-resize"
                      onPointerDown={(e) => beginResize(e, layer, "edge-s")}
                    />
                    <div
                      data-overlay-handle="1"
                      title="拖动等比缩放"
                      className="absolute -bottom-px -right-px z-20 h-3 w-3 cursor-nwse-resize"
                      style={{
                        borderRight: "2px solid #0071e3",
                        borderBottom: "2px solid #0071e3",
                      }}
                      onPointerDown={(e) => beginResize(e, layer, "corner")}
                    />
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] text-white/80 drop-shadow">
        预览与合成对齐 · 拖边拉伸
      </p>
    </div>
  );
}
