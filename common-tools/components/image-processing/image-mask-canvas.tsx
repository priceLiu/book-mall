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

export type MaskBrushType = "round" | "square" | "soft" | "eraser";

export const MASK_BRUSH_OPTIONS: Array<{
  id: MaskBrushType;
  label: string;
  hint: string;
}> = [
  { id: "round", label: "圆头", hint: "平滑连续涂抹" },
  { id: "square", label: "方头", hint: "直角硬边" },
  { id: "soft", label: "软边", hint: "羽化过渡" },
  { id: "eraser", label: "橡皮", hint: "擦除涂抹" },
];

export type ImageMaskCanvasHandle = {
  getMaskDataUrl: () => string | null;
};

type Props = {
  imageDataUrl: string;
  brushSize: number;
  brushType?: MaskBrushType;
  showTransparentMask: boolean;
  onMaskChange?: (hasMask: boolean) => void;
  className?: string;
};

type Point = { x: number; y: number };

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

function applyDisplayBrushStyle(
  ctx: CanvasRenderingContext2D,
  brushType: MaskBrushType,
  brushSize: number,
  showTransparentMask: boolean,
) {
  const color = showTransparentMask
    ? "rgba(34, 197, 94, 0.55)"
    : "rgba(34, 197, 94, 0.75)";

  if (brushType === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.shadowBlur = 0;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (brushType === "soft") {
      ctx.shadowBlur = Math.max(4, brushSize * 0.35);
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }
  }

  ctx.lineWidth = brushSize;
  ctx.lineCap = brushType === "square" ? "square" : "round";
  ctx.lineJoin = brushType === "square" ? "miter" : "round";
}

function applyMaskBrushStyle(
  ctx: CanvasRenderingContext2D,
  brushType: MaskBrushType,
  brushSize: number,
) {
  if (brushType === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.shadowBlur = 0;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    if (brushType === "soft") {
      ctx.shadowBlur = Math.max(4, brushSize * 0.35);
      ctx.shadowColor = "#ffffff";
    } else {
      ctx.shadowBlur = 0;
    }
  }

  ctx.lineWidth = brushSize;
  ctx.lineCap = brushType === "square" ? "square" : "round";
  ctx.lineJoin = brushType === "square" ? "miter" : "round";
}

function resetCtxState(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStrokeSegment(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

export const ImageMaskCanvas = forwardRef<ImageMaskCanvasHandle, Props>(
  function ImageMaskCanvas(
    {
      imageDataUrl,
      brushSize,
      brushType = "round",
      showTransparentMask,
      onMaskChange,
      className,
    },
    ref,
  ) {
    const imageRef = useRef<HTMLImageElement>(null);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const lastPointRef = useRef<Point | null>(null);
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

    useEffect(() => {
      lastPointRef.current = null;
    }, [imageDataUrl, brushType]);

    const paintAt = useCallback(
      (clientX: number, clientY: number, isStart: boolean) => {
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

        const point: Point = { x, y };
        const maskPoint: Point = { x: x * scaleX, y: y * scaleY };
        const maskBrushSize = brushSize * scaleX;

        applyDisplayBrushStyle(dctx, brushType, brushSize, showTransparentMask);
        applyMaskBrushStyle(mctx, brushType, maskBrushSize);

        const last = lastPointRef.current;
        if (isStart || !last) {
          drawDot(dctx, x, y, brushSize / 2);
          drawDot(mctx, maskPoint.x, maskPoint.y, maskBrushSize / 2);
        } else {
          drawStrokeSegment(dctx, last, point);
          drawStrokeSegment(mctx, { x: last.x * scaleX, y: last.y * scaleY }, maskPoint);
        }

        resetCtxState(dctx);
        resetCtxState(mctx);
        lastPointRef.current = point;
        onMaskChange?.(true);
      },
      [brushSize, brushType, onMaskChange, showTransparentMask],
    );

    const endStroke = useCallback(() => {
      setDrawing(false);
      lastPointRef.current = null;
    }, []);

    const clearMask = () => {
      const display = displayCanvasRef.current;
      const mask = maskCanvasRef.current;
      display?.getContext("2d")?.clearRect(0, 0, display.width, display.height);
      mask?.getContext("2d")?.clearRect(0, 0, mask.width, mask.height);
      lastPointRef.current = null;
      onMaskChange?.(false);
    };

    const cursorClass =
      brushType === "eraser" ? "cursor-cell" : "cursor-crosshair";

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
            className={cn(
              "absolute inset-0 h-full w-full touch-none",
              cursorClass,
            )}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrawing(true);
              paintAt(e.clientX, e.clientY, true);
            }}
            onPointerMove={(e) => {
              if (!drawing) return;
              e.preventDefault();
              paintAt(e.clientX, e.clientY, false);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
              endStroke();
            }}
            onPointerCancel={endStroke}
            onPointerLeave={() => {
              if (drawing) endStroke();
            }}
          />
          <canvas ref={maskCanvasRef} className="hidden" aria-hidden />
        </div>
        <p className="mt-2 text-center text-xs text-[#6e6e73]">
          按住并拖动涂抹要修改的区域；可选用圆头 / 方头 / 软边 / 橡皮。
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
  brushType,
  onBrushTypeChange,
  showTransparentMask,
  onToggleTransparentMask,
  onClearImage,
}: {
  brushSize: number;
  onBrushSizeChange: (v: number) => void;
  brushType: MaskBrushType;
  onBrushTypeChange: (v: MaskBrushType) => void;
  showTransparentMask: boolean;
  onToggleTransparentMask: () => void;
  onClearImage: () => void;
}) {
  return (
    <div className="mb-3 space-y-3 rounded-lg border border-[#e5e5ea] bg-white px-3 py-3 text-sm sm:px-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <label className="flex w-full min-w-0 items-center gap-3 sm:min-w-[180px] sm:flex-1">
          <span className="shrink-0 text-[#1d1d1f]">画笔尺寸</span>
          <input
            type="range"
            min={4}
            max={120}
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
          透明蒙版
        </button>
        <button
          type="button"
          onClick={onClearImage}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 sm:ml-auto"
        >
          <X className="h-3.5 w-3.5" />
          新图像
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-[#6e6e73]">画笔类型</span>
        {MASK_BRUSH_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.hint}
            onClick={() => onBrushTypeChange(opt.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              brushType === opt.id
                ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                : "border-[#e5e5ea] text-[#1d1d1f] hover:border-[#86868b]",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
