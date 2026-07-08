"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser, Grid3x3, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImageMaskCanvasHandle = {
  getMaskDataUrl: () => string | null;
};

type Props = {
  imageDataUrl: string;
  brushSize: number;
  showTransparentMask: boolean;
  onMaskChange?: (hasMask: boolean) => void;
  className?: string;
};

function exportMaskDataUrl(maskCanvas: HTMLCanvasElement | null): string | null {
  if (!maskCanvas || maskCanvas.width === 0) return null;
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return null;
  const pixels = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  let hasPaint = false;
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i] > 10) hasPaint = true;
  }
  if (!hasPaint) return null;

  const out = document.createElement("canvas");
  out.width = maskCanvas.width;
  out.height = maskCanvas.height;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.fillStyle = "#000000";
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(maskCanvas, 0, 0);
  return out.toDataURL("image/png");
}

export const ImageMaskCanvas = forwardRef<ImageMaskCanvasHandle, Props>(
  function ImageMaskCanvas(
    { imageDataUrl, brushSize, showTransparentMask, onMaskChange, className },
    ref,
  ) {
    const imageRef = useRef<HTMLImageElement>(null);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState(false);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    useImperativeHandle(ref, () => ({
      getMaskDataUrl: () => exportMaskDataUrl(maskCanvasRef.current),
    }));

    const syncCanvasSize = useCallback(() => {
      const img = imageRef.current;
      const display = displayCanvasRef.current;
      const mask = maskCanvasRef.current;
      if (!img || !display || !mask || !img.naturalWidth) return;
      const w = img.clientWidth;
      const h = img.clientHeight;
      if (w <= 0 || h <= 0) return;
      display.width = w;
      display.height = h;
      mask.width = img.naturalWidth;
      mask.height = img.naturalHeight;
      setDims({ w, h });
    }, []);

    useEffect(() => {
      syncCanvasSize();
      window.addEventListener("resize", syncCanvasSize);
      return () => window.removeEventListener("resize", syncCanvasSize);
    }, [imageDataUrl, syncCanvasSize]);

    const paint = useCallback(
      (clientX: number, clientY: number) => {
        const display = displayCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!display || !mask) return;
        const rect = display.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const scaleX = mask.width / display.width;
        const scaleY = mask.height / display.height;

        const dctx = display.getContext("2d");
        const mctx = mask.getContext("2d");
        if (!dctx || !mctx) return;

        dctx.fillStyle = showTransparentMask
          ? "rgba(34, 197, 94, 0.55)"
          : "rgba(34, 197, 94, 0.75)";
        dctx.beginPath();
        dctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        dctx.fill();

        mctx.fillStyle = "#ffffff";
        mctx.beginPath();
        mctx.arc(x * scaleX, y * scaleY, (brushSize / 2) * scaleX, 0, Math.PI * 2);
        mctx.fill();
        onMaskChange?.(true);
      },
      [brushSize, onMaskChange, showTransparentMask],
    );

    const clearMask = () => {
      const display = displayCanvasRef.current;
      const mask = maskCanvasRef.current;
      display?.getContext("2d")?.clearRect(0, 0, display.width, display.height);
      mask?.getContext("2d")?.clearRect(0, 0, mask.width, mask.height);
      onMaskChange?.(false);
    };

    return (
      <div className={cn("w-full", className)}>
        <div
          className="relative w-full overflow-hidden rounded-xl border border-[#e5e5ea] bg-[#fafafa]"
          style={{
            aspectRatio: dims.w && dims.h ? `${dims.w}/${dims.h}` : undefined,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageDataUrl}
            alt="待修图"
            className="block h-auto w-full select-none"
            draggable={false}
            onLoad={syncCanvasSize}
          />
          <canvas
            ref={displayCanvasRef}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrawing(true);
              paint(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!drawing) return;
              paint(e.clientX, e.clientY);
            }}
            onPointerUp={() => setDrawing(false)}
            onPointerLeave={() => setDrawing(false)}
          />
          <canvas ref={maskCanvasRef} className="hidden" aria-hidden />
        </div>
        <p className="mt-2 text-center text-xs text-[#6e6e73]">
          点击并拖动鼠标，涂抹到您想要更改的区域。
        </p>
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={clearMask}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#6e6e73] hover:bg-[#f0f0f5]"
          >
            <Eraser className="h-3.5 w-3.5" />
            清除涂抹
          </button>
        </div>
      </div>
    );
  },
);

export function MaskToolbar({
  brushSize,
  onBrushSizeChange,
  showTransparentMask,
  onToggleTransparentMask,
  onClearImage,
}: {
  brushSize: number;
  onBrushSizeChange: (v: number) => void;
  showTransparentMask: boolean;
  onToggleTransparentMask: () => void;
  onClearImage: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e5ea] bg-white px-3 py-3 text-sm sm:gap-4 sm:px-4">
      <label className="flex w-full min-w-0 items-center gap-3 sm:min-w-[180px] sm:flex-1">
        <span className="shrink-0 text-[#1d1d1f]">画笔尺寸</span>
        <input
          type="range"
          min={8}
          max={80}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="h-1.5 flex-1 accent-[#0071e3]"
        />
        <span className="w-8 text-right text-xs text-[#6e6e73]">{brushSize}</span>
      </label>
      <button
        type="button"
        onClick={onToggleTransparentMask}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs",
          showTransparentMask
            ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
            : "border-[#e5e5ea] text-[#1d1d1f]",
        )}
      >
        <Grid3x3 className="h-3.5 w-3.5" />
        透明面膜
      </button>
      <button
        type="button"
        onClick={onClearImage}
        className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
      >
        <X className="h-3.5 w-3.5" />
        新图像
      </button>
    </div>
  );
}
