"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  ImageMaskCanvas,
  type ImageMaskCanvasHandle,
} from "@/components/image-processing/image-mask-canvas";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { normalizedBbox } from "@/lib/image-layer-coords";
import { getLayerCanvasStyle } from "@/lib/image-layer-placement";
import type { ImageLayerStackItem } from "@/lib/image-layer-types";
import { cn } from "@/lib/utils";

type Props = {
  sourcePreviewUrl: string | null;
  background: ImageLayerStackItem | null;
  layers: ImageLayerStackItem[];
  selectedLayerId: string | null;
  drawBboxMode: boolean;
  generating?: boolean;
  generatingLabel?: string;
  generatingProgress?: number | null;
  removeDisabled?: boolean;
  onRemoveSource?: () => void;
  onSelectLayer: (id: string | null) => void;
  onLayerMove: (id: string, offsetX: number, offsetY: number) => void;
  onBboxDrawn: (bbox: [number, number, number, number] | null) => void;
  onDisplayDimsChange?: (dims: { w: number; h: number }) => void;
  className?: string;
};

export function ImageLayerCanvas({
  sourcePreviewUrl,
  background,
  layers,
  selectedLayerId,
  drawBboxMode,
  generating = false,
  generatingLabel,
  generatingProgress,
  removeDisabled = false,
  onRemoveSource,
  onSelectLayer,
  onLayerMove,
  onBboxDrawn,
  onDisplayDimsChange,
  className,
}: Props) {
  const maskRef = useRef<ImageMaskCanvasHandle>(null);
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

  const displayUrl = background?.url ?? sourcePreviewUrl;
  const showLayers = Boolean(background);

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

  const handleBboxChange = useCallback(() => {
    const pxBbox = maskRef.current?.getBbox();
    if (!pxBbox || dims.w <= 0 || dims.h <= 0) {
      onBboxDrawn(null);
      return;
    }
    onBboxDrawn(normalizedBbox(pxBbox[0], pxBbox[1], pxBbox[2], pxBbox[3], dims.w, dims.h));
  }, [dims.h, dims.w, onBboxDrawn]);

  const onLayerPointerDown = (
    e: React.PointerEvent,
    layer: ImageLayerStackItem,
  ) => {
    if (drawBboxMode || generating) return;
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
        title="删除图片"
        aria-label="删除图片"
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

  if (!displayUrl) {
    return null;
  }

  if (drawBboxMode || !showLayers) {
    return (
      <div className={cn("relative w-full min-w-0", className)}>
        {removeButton}
        <ImageMaskCanvas
          ref={maskRef}
          imageDataUrl={displayUrl}
          brushSize={24}
          showTransparentMask={false}
          mode="bbox"
          onMaskChange={handleBboxChange}
          className="w-full"
        />
        {generatingOverlay}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full min-w-0 bg-[#f3f4f6] p-4", className)}>
      <div
        className="relative mx-auto w-fit max-w-full"
        onPointerDown={() => onSelectLayer(null)}
      >
        <div className="relative inline-block max-w-full rounded-xl shadow-md">
          {removeButton}
          <img
            src={displayUrl}
            alt="底图"
            className="block h-auto max-w-full select-none"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
              reportDisplayDims(img);
            }}
          />
          {layers.map((layer) => {
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
                    className: "absolute left-0 top-0 h-auto max-w-full select-none",
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
                  selectedLayerId === layer.id && "ring-2 ring-[#2563eb] ring-offset-1",
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
          })}
          {generatingOverlay}
        </div>
      </div>
    </div>
  );
}
