"use client";

import { Trash2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  ImageMaskCanvas,
  type ImageMaskCanvasHandle,
} from "@/components/image-processing/image-mask-canvas";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { normalizedBbox } from "@/lib/image-layer-coords";
import { IMAGE_LAYER_MAX_BBOXES } from "@/lib/image-layer-constants";
import { getLayerCanvasStyle } from "@/lib/image-layer-placement";
import type { ImageLayerStackItem } from "@/lib/image-layer-types";
import type {
  ImageLayerCanvasToolMode,
  ImageLayerSelectionSubTool,
} from "@/lib/image-layer-tool-mode";
import { cn } from "@/lib/utils";

type Props = {
  sourcePreviewUrl: string | null;
  background: ImageLayerStackItem | null;
  layers: ImageLayerStackItem[];
  selectedLayerId: string | null;
  toolMode: ImageLayerCanvasToolMode;
  selectionSubTool: ImageLayerSelectionSubTool;
  retouchUsesBbox: boolean;
  brushSize: number;
  showTransparentMask: boolean;
  generating?: boolean;
  generatingLabel?: string;
  generatingProgress?: number | null;
  removeDisabled?: boolean;
  onRemoveSource?: () => void;
  onSelectLayer: (id: string | null) => void;
  onLayerMove: (id: string, offsetX: number, offsetY: number) => void;
  pendingBboxes?: Array<[number, number, number, number]>;
  onBboxesDrawn: (bboxes: Array<[number, number, number, number]>) => void;
  onBboxLimitReached?: () => void;
  onDisplayDimsChange?: (dims: { w: number; h: number }) => void;
  onHasMaskChange?: (has: boolean) => void;
  className?: string;
};

export type ImageLayerCanvasHandle = {
  undoLastBbox: () => void;
  clearAllBboxes: () => void;
  clearMask: () => void;
  getMaskDataUrl: () => string | null;
  getBbox: () => [number, number, number, number] | null;
  getNaturalSize: () => { w: number; h: number } | null;
};

export const ImageLayerCanvas = forwardRef<ImageLayerCanvasHandle, Props>(
  function ImageLayerCanvas(
    {
      sourcePreviewUrl,
      background,
      layers,
      selectedLayerId,
      toolMode,
      selectionSubTool,
      retouchUsesBbox,
      brushSize,
      showTransparentMask,
      generating = false,
      generatingLabel,
      generatingProgress,
      removeDisabled = false,
      onRemoveSource,
      onSelectLayer,
      onLayerMove,
      pendingBboxes = [],
      onBboxesDrawn,
      onBboxLimitReached,
      onDisplayDimsChange,
      onHasMaskChange,
      className,
    },
    ref,
  ) {
    const paneRef = useRef<HTMLDivElement>(null);
    const previewImgRef = useRef<HTMLImageElement>(null);
    const [paneBox, setPaneBox] = useState<{ w: number; h: number } | null>(null);
    const maskRef = useRef<ImageMaskCanvasHandle>(null);

    useEffect(() => {
      const el = paneRef.current;
      if (!el) return;
      const update = () => {
        const w = Math.max(0, Math.floor(el.clientWidth));
        const h = Math.max(0, Math.floor(el.clientHeight));
        setPaneBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const fitStyle =
      paneBox && paneBox.w > 0 && paneBox.h > 0
        ? { maxWidth: paneBox.w, maxHeight: paneBox.h }
        : undefined;
    const dragRef = useRef<{
      id: string;
      startX: number;
      startY: number;
      baseX: number;
      baseY: number;
    } | null>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const [layerNaturalDims, setLayerNaturalDims] = useState<
      Record<string, { w: number; h: number }>
    >({});

    const flatImageUrl = background?.url ?? sourcePreviewUrl;
    const showLayers = Boolean(background) && toolMode === "layer-view";

    const reportDisplayDims = useCallback(
      (img: HTMLImageElement) => {
        const w = img.clientWidth || img.naturalWidth;
        const h = img.clientHeight || img.naturalHeight;
        if (w > 0 && h > 0) {
          onDisplayDimsChange?.({ w, h });
        }
      },
      [onDisplayDimsChange],
    );

    useEffect(() => {
      const img = previewImgRef.current;
      if (img && img.clientWidth > 0) reportDisplayDims(img);
    }, [paneBox, reportDisplayDims]);

    const syncBboxesToParent = useCallback(() => {
      const natural = maskRef.current?.getNaturalSize();
      const pxBboxes = maskRef.current?.getBboxes() ?? [];
      if (!natural || natural.w <= 0 || natural.h <= 0 || pxBboxes.length === 0) {
        onBboxesDrawn([]);
        return;
      }
      if (pxBboxes.length > IMAGE_LAYER_MAX_BBOXES) {
        onBboxLimitReached?.();
        return;
      }
      onBboxesDrawn(
        pxBboxes.map((b) =>
          normalizedBbox(b[0], b[1], b[2], b[3], natural.w, natural.h),
        ),
      );
    }, [onBboxLimitReached, onBboxesDrawn]);

    const handleMaskChange = useCallback(
      (has: boolean) => {
        if (toolMode === "decompose-bbox") {
          syncBboxesToParent();
        } else {
          onHasMaskChange?.(has);
        }
      },
      [onHasMaskChange, syncBboxesToParent, toolMode],
    );

    useImperativeHandle(
      ref,
      () => ({
        undoLastBbox: () => {
          maskRef.current?.undoLastBbox();
          syncBboxesToParent();
        },
        clearAllBboxes: () => {
          onBboxesDrawn([]);
          maskRef.current?.clearBboxes();
          onHasMaskChange?.(false);
        },
        clearMask: () => {
          maskRef.current?.clearMask();
          onBboxesDrawn([]);
          onHasMaskChange?.(false);
        },
        getMaskDataUrl: () => maskRef.current?.getMaskDataUrl() ?? null,
        getBbox: () => maskRef.current?.getBbox() ?? null,
        getNaturalSize: () => maskRef.current?.getNaturalSize() ?? null,
      }),
      [onBboxesDrawn, onHasMaskChange, syncBboxesToParent],
    );

    const onLayerPointerDown = (
      e: React.PointerEvent,
      layer: ImageLayerStackItem,
    ) => {
      if (toolMode !== "layer-view" || generating) return;
      e.stopPropagation();
      onSelectLayer(layer.id);
      dragRef.current = {
        id: layer.id,
        startX: e.clientX,
        startY: e.clientY,
        baseX: layer.offsetX ?? 0,
        baseY: layer.offsetY ?? 0,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onLayerPointerMove = (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      onLayerMove(drag.id, drag.baseX + dx, drag.baseY + dy);
    };

    const onLayerPointerUp = () => {
      dragRef.current = null;
    };

    const removeButton =
      onRemoveSource && !removeDisabled && !generating ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-[#ff3b30]/30 bg-white/95 text-[#ff3b30] shadow-sm transition hover:border-[#ff3b30] hover:bg-[#fff5f5]"
          title="清除操作结果"
          aria-label="清除操作结果"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveSource();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null;

    const generatingOverlay = generating ? (
      <EcomMediaGeneratingBusy
        label={generatingLabel}
        progress={generatingProgress}
        className="absolute inset-0 z-20 h-full w-full rounded-xl"
      />
    ) : null;

    if (!flatImageUrl) {
      return null;
    }

    const useMaskCanvas =
      toolMode === "decompose-bbox" ||
      toolMode === "retouch" ||
      toolMode === "erase";

    const maskMode =
      toolMode === "decompose-bbox"
        ? "bbox"
        : toolMode === "erase"
          ? selectionSubTool === "bbox"
            ? "bbox"
            : "mask"
          : retouchUsesBbox || selectionSubTool === "bbox"
            ? "bbox"
            : "mask";

    const bboxSelection = toolMode === "decompose-bbox" ? "multi" : "single";

    return (
      <div
        ref={paneRef}
        className={cn(
          "relative flex h-full min-h-0 min-w-0 w-full items-center justify-center overflow-hidden",
          !useMaskCanvas && "bg-[#f3f4f6]",
          className,
        )}
      >
        {useMaskCanvas ? (
          <>
            {removeButton}
            <ImageMaskCanvas
              key={`${flatImageUrl}-${toolMode}-${maskMode}-${bboxSelection}`}
              ref={maskRef}
              imageDataUrl={flatImageUrl}
              brushSize={brushSize}
              showTransparentMask={showTransparentMask}
              maskTool={selectionSubTool === "eraser" ? "eraser" : "brush"}
              mode={maskMode}
              bboxSelection={bboxSelection}
              maxBboxes={IMAGE_LAYER_MAX_BBOXES}
              initialNormalizedBboxes={
                toolMode === "decompose-bbox" && pendingBboxes.length
                  ? pendingBboxes
                  : undefined
              }
              onMaskChange={handleMaskChange}
              onBboxLimitReached={onBboxLimitReached}
              hideFooter
              maxCssSize={paneBox}
              className="h-full w-full"
            />
            {generatingOverlay}
          </>
        ) : (
        <div
          className="relative max-h-full max-w-full"
          style={fitStyle}
          onPointerDown={() => {
            if (background && showLayers) {
              onSelectLayer(background.id);
              return;
            }
            onSelectLayer(null);
          }}
        >
          <div
            className={cn(
              "relative inline-block max-h-full max-w-full rounded-xl shadow-md",
              showLayers &&
                selectedLayerId === background?.id &&
                "ring-2 ring-[#2563eb] ring-offset-1",
            )}
          >
            {removeButton}
            <img
              ref={previewImgRef}
              src={flatImageUrl}
              alt="底图"
              className="block h-auto w-auto max-h-full max-w-full select-none object-contain"
              style={fitStyle}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setDims({ w: img.naturalWidth, h: img.naturalHeight });
                reportDisplayDims(img);
              }}
            />
            {showLayers
              ? layers.map((layer) => {
                  const natural = layerNaturalDims[layer.id];
                  const placement =
                    natural && dims.w > 0 && dims.h > 0
                      ? getLayerCanvasStyle(
                          layer,
                          natural.w,
                          natural.h,
                          dims.w,
                          dims.h,
                          layer.offsetX ?? 0,
                          layer.offsetY ?? 0,
                        )
                      : {
                          className:
                            "absolute left-0 top-0 h-auto max-w-full select-none",
                          style: {
                            transform: `translate(${layer.offsetX ?? 0}px, ${layer.offsetY ?? 0}px)`,
                          },
                        };
                  return (
                    <img
                      key={layer.id}
                      src={layer.url}
                      alt={layer.name ?? "图层"}
                      draggable={false}
                      className={cn(
                        placement.className,
                        generating ? "pointer-events-none" : "cursor-move",
                        selectedLayerId === layer.id &&
                          "ring-2 ring-[#2563eb] ring-offset-1",
                      )}
                      style={placement.style}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setLayerNaturalDims((prev) => ({
                          ...prev,
                          [layer.id]: { w: img.naturalWidth, h: img.naturalHeight },
                        }));
                      }}
                      onPointerDown={(e) => onLayerPointerDown(e, layer)}
                      onPointerMove={onLayerPointerMove}
                      onPointerUp={onLayerPointerUp}
                      onPointerCancel={onLayerPointerUp}
                    />
                  );
                })
              : null}
            {generatingOverlay}
          </div>
        </div>
        )}
      </div>
    );
  },
);
