"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Eraser, Grid3x3, X } from "lucide-react";
import { pointerEventToCanvasBitmap } from "@/lib/image-mask-canvas-coords";
import {
  checkerboardPattern,
  MASK_OVERLAY_SOLID,
} from "@/lib/image-mask-selection-visual";
import { cn } from "@/lib/utils";

type DisplayRect = { x1: number; y1: number; x2: number; y2: number };

export type ImageMaskCanvasHandle = {
  getMaskDataUrl: () => string | null;
  getBbox: () => [number, number, number, number] | null;
  getBboxes: () => Array<[number, number, number, number]>;
  getNaturalSize: () => { w: number; h: number } | null;
  clearBboxes: () => void;
  clearMask: () => void;
  undoLastBbox: () => void;
};

type MaskPaintTool = "brush" | "eraser";

type Props = {
  imageDataUrl: string;
  brushSize: number;
  showTransparentMask: boolean;
  /** 笔刷 / 橡皮（仅 mode=mask） */
  maskTool?: MaskPaintTool;
  /** mask 笔刷涂抹；bbox 框选（wan2.7-image-pro / 图片分层） */
  mode?: "mask" | "bbox";
  /** bbox 模式：single 单框；multi 连续多框 */
  bboxSelection?: "single" | "multi";
  maxBboxes?: number;
  /** 0～999 归一化坐标，用于恢复已保存的框 */
  initialNormalizedBboxes?: Array<[number, number, number, number]>;
  onMaskChange?: (hasMask: boolean) => void;
  onBboxLimitReached?: () => void;
  /** 隐藏画布下方撤销/清除按钮（操作区在侧栏时） */
  hideFooter?: boolean;
  /** 限制显示尺寸（按父级可见区域等比适配，不撑满列宽） */
  maxCssSize?: { w: number; h: number } | null;
  className?: string;
};

const MIN_BBOX_PX = 8;

type Point = { x: number; y: number };

function resetCtxState(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
}

function applyDisplayBrushStyle(
  ctx: CanvasRenderingContext2D,
  maskTool: MaskPaintTool,
  brushSize: number,
  showTransparentMask: boolean,
) {
  if (maskTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.shadowBlur = 0;
  } else {
    ctx.globalCompositeOperation = "source-over";
    const color = showTransparentMask
      ? checkerboardPattern(ctx)
      : MASK_OVERLAY_SOLID;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowBlur = 0;
  }
  ctx.lineWidth = brushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function applyMaskBrushStyle(
  ctx: CanvasRenderingContext2D,
  maskTool: MaskPaintTool,
  brushSize: number,
) {
  if (maskTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
  }
  ctx.lineWidth = brushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 0;
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStrokeSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function rebuildMaskOverlayFromMaskCanvas(
  display: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  showTransparentMask: boolean,
) {
  const dctx = display.getContext("2d");
  if (!dctx || display.width <= 0 || display.height <= 0) return;

  dctx.clearRect(0, 0, display.width, display.height);
  if (mask.width <= 0 || mask.height <= 0) return;

  const scaled = document.createElement("canvas");
  scaled.width = display.width;
  scaled.height = display.height;
  const sctx = scaled.getContext("2d");
  if (!sctx) return;
  sctx.drawImage(mask, 0, 0, display.width, display.height);

  dctx.save();
  dctx.fillStyle = showTransparentMask
    ? checkerboardPattern(dctx)
    : MASK_OVERLAY_SOLID;
  dctx.fillRect(0, 0, display.width, display.height);
  dctx.globalCompositeOperation = "destination-in";
  dctx.drawImage(scaled, 0, 0);
  dctx.restore();
  resetCtxState(dctx);
}

function normalizeDisplayRect(rect: DisplayRect): DisplayRect {
  return {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  };
}

function isValidDisplayRect(rect: DisplayRect): boolean {
  const n = normalizeDisplayRect(rect);
  return n.x2 - n.x1 >= MIN_BBOX_PX && n.y2 - n.y1 >= MIN_BBOX_PX;
}

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
  const imgData = octx.getImageData(0, 0, out.width, out.height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = imgData.data[i]! > 128 ? 255 : 0;
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 255;
  }
  octx.putImageData(imgData, 0, 0);
  return out.toDataURL("image/png");
}

export const ImageMaskCanvas = forwardRef<ImageMaskCanvasHandle, Props>(
  function ImageMaskCanvas(
    {
      imageDataUrl,
      brushSize,
      showTransparentMask,
      maskTool = "brush",
      mode = "mask",
      bboxSelection = "single",
      maxBboxes = 16,
      initialNormalizedBboxes,
      onMaskChange,
      onBboxLimitReached,
      hideFooter = false,
      maxCssSize,
      className,
    },
    ref,
  ) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<Point | null>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const rectStart = useRef<{ x: number; y: number } | null>(null);
    const [bboxDisplay, setBboxDisplay] = useState<DisplayRect | null>(null);
    const draftBboxRef = useRef<DisplayRect | null>(null);
    const [committedBboxes, setCommittedBboxes] = useState<DisplayRect[]>([]);
    const committedBboxesRef = useRef<DisplayRect[]>([]);
    committedBboxesRef.current = committedBboxes;
    const hydratedFromInitialRef = useRef<string | null>(null);

    const setDraftBbox = useCallback((rect: DisplayRect | null) => {
      draftBboxRef.current = rect;
      setBboxDisplay(rect);
    }, []);

    const pointFromPointer = useCallback((e: { clientX: number; clientY: number }) => {
      const display = displayCanvasRef.current;
      if (!display || display.width <= 0 || display.height <= 0) return null;
      return pointerEventToCanvasBitmap(e, display);
    }, []);

    const displayToNatural = useCallback(
      (rect: DisplayRect): [number, number, number, number] | null => {
        const display = displayCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!display || !mask || display.width <= 0 || display.height <= 0) return null;
        const n = normalizeDisplayRect(rect);
        const scaleX = mask.width / display.width;
        const scaleY = mask.height / display.height;
        return [
          Math.round(n.x1 * scaleX),
          Math.round(n.y1 * scaleY),
          Math.round(n.x2 * scaleX),
          Math.round(n.y2 * scaleY),
        ];
      },
      [],
    );

    const naturalToDisplay = useCallback(
      (rect: [number, number, number, number]): DisplayRect | null => {
        const display = displayCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!display || !mask || mask.width <= 0 || mask.height <= 0) return null;
        const scaleX = display.width / mask.width;
        const scaleY = display.height / mask.height;
        return {
          x1: rect[0] * scaleX,
          y1: rect[1] * scaleY,
          x2: rect[2] * scaleX,
          y2: rect[3] * scaleY,
        };
      },
      [],
    );

    const redrawBboxes = useCallback(
      (committed: DisplayRect[], draft: DisplayRect | null) => {
        const display = displayCanvasRef.current;
        if (!display) return;
        const ctx = display.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, display.width, display.height);
        committed.forEach((rect, idx) => {
          const n = normalizeDisplayRect(rect);
          const x = n.x1;
          const y = n.y1;
          const w = n.x2 - n.x1;
          const h = n.y2 - n.y1;
          ctx.strokeStyle = "rgba(0, 113, 227, 0.95)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = "rgba(0, 113, 227, 0.12)";
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = "rgba(0, 113, 227, 0.95)";
          ctx.font = "bold 12px system-ui, sans-serif";
          ctx.fillText(String(idx + 1), x + 6, y + 16);
        });
        if (draft && isValidDisplayRect(draft)) {
          const n = normalizeDisplayRect(draft);
          const x = n.x1;
          const y = n.y1;
          const w = n.x2 - n.x1;
          const h = n.y2 - n.y1;
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "rgba(0, 113, 227, 0.75)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(0, 113, 227, 0.08)";
          ctx.fillRect(x, y, w, h);
        }
      },
      [],
    );

    const clearMask = useCallback(() => {
      const display = displayCanvasRef.current;
      const mask = maskCanvasRef.current;
      display?.getContext("2d")?.clearRect(0, 0, display.width, display.height);
      mask?.getContext("2d")?.clearRect(0, 0, mask.width, mask.height);
      committedBboxesRef.current = [];
      hydratedFromInitialRef.current = null;
      lastPointRef.current = null;
      draftBboxRef.current = null;
      setBboxDisplay(null);
      setCommittedBboxes([]);
      onMaskChange?.(false);
    }, [onMaskChange]);

    useImperativeHandle(ref, () => ({
      getMaskDataUrl: () => exportMaskDataUrl(maskCanvasRef.current),
      getNaturalSize: () => {
        const mask = maskCanvasRef.current;
        if (!mask || mask.width <= 0 || mask.height <= 0) return null;
        return { w: mask.width, h: mask.height };
      },
      getBbox: () => {
        if (bboxSelection === "multi") {
          const last = committedBboxes[committedBboxes.length - 1];
          return last ? displayToNatural(last) : null;
        }
        if (!bboxDisplay) return null;
        return displayToNatural(bboxDisplay);
      },
      getBboxes: () => {
        if (bboxSelection === "multi") {
          return committedBboxesRef.current
            .map((rect) => displayToNatural(rect))
            .filter((b): b is [number, number, number, number] => b !== null);
        }
        const one = bboxDisplay ? displayToNatural(bboxDisplay) : null;
        return one ? [one] : [];
      },
      clearBboxes: () => {
        committedBboxesRef.current = [];
        hydratedFromInitialRef.current = null;
        draftBboxRef.current = null;
        setCommittedBboxes([]);
        setBboxDisplay(null);
        const display = displayCanvasRef.current;
        display?.getContext("2d")?.clearRect(0, 0, display.width, display.height);
        onMaskChange?.(false);
      },
      undoLastBbox: () => {
        if (bboxSelection !== "multi") {
          draftBboxRef.current = null;
          setBboxDisplay(null);
          const display = displayCanvasRef.current;
          display?.getContext("2d")?.clearRect(0, 0, display.width, display.height);
          onMaskChange?.(false);
          return;
        }
        const next = committedBboxesRef.current.slice(0, -1);
        committedBboxesRef.current = next;
        setCommittedBboxes(next);
        redrawBboxes(next, null);
        onMaskChange?.(next.length > 0);
      },
      clearMask,
    }), [bboxDisplay, bboxSelection, clearMask, displayToNatural, onMaskChange, redrawBboxes]);

    const syncCanvasSize = useCallback(() => {
      const wrap = wrapRef.current;
      const img = imageRef.current;
      const display = displayCanvasRef.current;
      const mask = maskCanvasRef.current;
      if (!wrap || !img || !display || !mask || !img.naturalWidth) return;
      const w = Math.max(1, Math.round(wrap.clientWidth));
      const h = Math.max(1, Math.round(wrap.clientHeight));
      if (w <= 0 || h <= 0) return;

      const naturalChanged =
        mask.width !== img.naturalWidth || mask.height !== img.naturalHeight;
      const displayChanged = display.width !== w || display.height !== h;
      if (!naturalChanged && !displayChanged) return;

      if (displayChanged && display.width > 0 && display.height > 0) {
        const sx = w / display.width;
        const sy = h / display.height;
        const scaleRect = (rect: DisplayRect): DisplayRect => ({
          x1: rect.x1 * sx,
          y1: rect.y1 * sy,
          x2: rect.x2 * sx,
          y2: rect.y2 * sy,
        });
        if (draftBboxRef.current) {
          draftBboxRef.current = scaleRect(draftBboxRef.current);
        }
        if (rectStart.current) {
          rectStart.current = {
            x: rectStart.current.x * sx,
            y: rectStart.current.y * sy,
          };
        }
        const nextCommitted = committedBboxesRef.current.map(scaleRect);
        committedBboxesRef.current = nextCommitted;
        setCommittedBboxes(nextCommitted);
        setBboxDisplay(draftBboxRef.current);
      }

      if (naturalChanged) {
        mask.width = img.naturalWidth;
        mask.height = img.naturalHeight;
      }
      if (displayChanged) {
        display.width = w;
        display.height = h;
      }
      setDims({ w, h });
    }, []);

    useEffect(() => {
      syncCanvasSize();
      const wrap = wrapRef.current;
      const ro = wrap ? new ResizeObserver(() => syncCanvasSize()) : null;
      if (wrap) ro?.observe(wrap);
      window.addEventListener("resize", syncCanvasSize);
      return () => {
        ro?.disconnect();
        window.removeEventListener("resize", syncCanvasSize);
      };
    }, [imageDataUrl, syncCanvasSize]);

    useEffect(() => {
      if (mode !== "bbox" || bboxSelection !== "multi" || !initialNormalizedBboxes?.length) {
        if (!initialNormalizedBboxes?.length) {
          hydratedFromInitialRef.current = null;
        }
        return;
      }
      const mask = maskCanvasRef.current;
      if (!mask || mask.width <= 0 || mask.height <= 0) return;
      const hydrateKey = `${imageDataUrl}::${JSON.stringify(initialNormalizedBboxes)}`;
      if (hydratedFromInitialRef.current === hydrateKey) return;
      hydratedFromInitialRef.current = hydrateKey;
      const restored = initialNormalizedBboxes
        .map(
          (b): DisplayRect | null =>
            naturalToDisplay([
              (b[0] / 1000) * mask.width,
              (b[1] / 1000) * mask.height,
              (b[2] / 1000) * mask.width,
              (b[3] / 1000) * mask.height,
            ]),
        )
        .filter((b): b is DisplayRect => b !== null);
      committedBboxesRef.current = restored;
      setCommittedBboxes(restored);
      redrawBboxes(restored, null);
      onMaskChange?.(restored.length > 0);
    }, [
      bboxSelection,
      dims.h,
      dims.w,
      imageDataUrl,
      initialNormalizedBboxes,
      mode,
      naturalToDisplay,
      onMaskChange,
      redrawBboxes,
    ]);

    useEffect(() => {
      if (mode === "bbox") {
        redrawBboxes(committedBboxes, bboxDisplay);
      }
    }, [bboxDisplay, committedBboxes, dims, mode, redrawBboxes]);

    useEffect(() => {
      lastPointRef.current = null;
    }, [imageDataUrl, maskTool]);

    useEffect(() => {
      if (mode !== "mask") return;
      const display = displayCanvasRef.current;
      const mask = maskCanvasRef.current;
      if (!display || !mask || display.width <= 0) return;
      rebuildMaskOverlayFromMaskCanvas(display, mask, showTransparentMask);
    }, [dims.h, dims.w, mode, showTransparentMask]);

    const paintAt = useCallback(
      (clientX: number, clientY: number, isStart: boolean) => {
        const display = displayCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!display || !mask || display.width <= 0 || display.height <= 0) return;
        const mapped = pointerEventToCanvasBitmap(
          { clientX, clientY },
          display,
        );
        const x = mapped.x;
        const y = mapped.y;
        const scaleX = mask.width / display.width;
        const scaleY = mask.height / display.height;

        const dctx = display.getContext("2d");
        const mctx = mask.getContext("2d");
        if (!dctx || !mctx) return;

        const point: Point = { x, y };
        const maskPoint: Point = { x: x * scaleX, y: y * scaleY };
        const maskBrushSize = brushSize * scaleX;

        applyDisplayBrushStyle(dctx, maskTool, brushSize, showTransparentMask);
        applyMaskBrushStyle(mctx, maskTool, maskBrushSize);

        const last = lastPointRef.current;
        if (isStart || !last) {
          drawDot(dctx, x, y, brushSize / 2);
          drawDot(mctx, maskPoint.x, maskPoint.y, maskBrushSize / 2);
        } else {
          drawStrokeSegment(dctx, last, point);
          drawStrokeSegment(
            mctx,
            { x: last.x * scaleX, y: last.y * scaleY },
            maskPoint,
          );
        }

        resetCtxState(dctx);
        resetCtxState(mctx);
        lastPointRef.current = point;
        onMaskChange?.(true);
      },
      [brushSize, maskTool, onMaskChange, showTransparentMask],
    );

    const endStroke = useCallback(() => {
      lastPointRef.current = null;
    }, []);

    const commitDraftBbox = useCallback(() => {
      const draft = draftBboxRef.current;
      if (!draft || !isValidDisplayRect(draft)) {
        setDraftBbox(null);
        return;
      }
      const normalized = normalizeDisplayRect(draft);
      if (bboxSelection === "multi") {
        setCommittedBboxes((prev) => {
          if (prev.length >= maxBboxes) {
            onBboxLimitReached?.();
            return prev;
          }
          const next = [...prev, normalized];
          committedBboxesRef.current = next;
          redrawBboxes(next, null);
          onMaskChange?.(next.length > 0);
          return next;
        });
        setDraftBbox(null);
      } else {
        setDraftBbox(normalized);
        onMaskChange?.(true);
      }
    }, [bboxSelection, maxBboxes, onBboxLimitReached, onMaskChange, redrawBboxes, setDraftBbox]);

    const applyBboxPointer = useCallback(
      (e: { clientX: number; clientY: number }, isStart: boolean) => {
        const point = pointFromPointer(e);
        if (!point) return;
        if (isStart) {
          rectStart.current = point;
          setDraftBbox({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
          return;
        }
        const start = rectStart.current;
        if (!start) return;
        const draft = { x1: start.x, y1: start.y, x2: point.x, y2: point.y };
        setDraftBbox(draft);
        if (bboxSelection === "single") {
          onMaskChange?.(isValidDisplayRect(draft));
        }
      },
      [bboxSelection, onMaskChange, pointFromPointer, setDraftBbox],
    );

    const finishPointer = useCallback(
      (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (mode === "bbox") {
          applyBboxPointer(e, false);
          commitDraftBbox();
        } else {
          endStroke();
        }
        rectStart.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      },
      [applyBboxPointer, commitDraftBbox, endStroke, mode],
    );

    const contain = Boolean(maxCssSize && maxCssSize.w > 0 && maxCssSize.h > 0);
    const containStyle = contain
      ? {
          maxWidth: maxCssSize!.w,
          maxHeight: maxCssSize!.h,
        }
      : undefined;

    return (
      <div
        className={cn(
          contain
            ? "flex h-full min-h-0 min-w-0 w-full items-center justify-center"
            : "w-full",
          className,
        )}
      >
        <div
          ref={wrapRef}
          className={cn(
            "relative touch-none overflow-hidden rounded-xl border border-[#e5e5ea] bg-[#fafafa]",
            contain ? "max-h-full max-w-full" : "w-full",
          )}
          style={containStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageDataUrl}
            alt="待修图"
            className={cn(
              "block select-none",
              contain ? "h-auto w-auto max-h-full max-w-full object-contain" : "h-auto w-full",
            )}
            style={containStyle}
            draggable={false}
            onLoad={syncCanvasSize}
          />
          <canvas
            ref={displayCanvasRef}
            className={cn(
              "absolute inset-0 h-full w-full touch-none",
              mode === "mask" && maskTool === "eraser"
                ? "cursor-cell"
                : "cursor-crosshair",
            )}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              drawingRef.current = true;
              if (mode === "bbox") {
                applyBboxPointer(e, true);
                return;
              }
              paintAt(e.clientX, e.clientY, true);
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current) return;
              e.preventDefault();
              if (mode === "bbox") {
                applyBboxPointer(e, false);
                return;
              }
              paintAt(e.clientX, e.clientY, false);
            }}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          />
          <canvas ref={maskCanvasRef} className="hidden" aria-hidden />
        </div>
        {hideFooter ? null : (
          <>
            <p className="mt-2 text-center text-xs text-[#6e6e73]">
              {mode === "bbox"
                ? bboxSelection === "multi"
                  ? `拖动框选拆分区域（${committedBboxes.length}/${maxBboxes}）；撤销/清除见下方或顶栏。`
                  : "拖动鼠标框选需要重绘的区域。"
                : "点击并拖动鼠标，涂抹到您想要更改的区域。"}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {mode === "bbox" && bboxSelection === "multi" ? (
                <button
                  type="button"
                  onClick={() => {
                    setCommittedBboxes((prev) => {
                      const next = prev.slice(0, -1);
                      committedBboxesRef.current = next;
                      redrawBboxes(next, null);
                      onMaskChange?.(next.length > 0);
                      return next;
                    });
                  }}
                  disabled={committedBboxes.length === 0}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#6e6e73] hover:bg-[#f0f0f5] disabled:opacity-40"
                >
                  撤销上一框
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearMask}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#6e6e73] hover:bg-[#f0f0f5]"
              >
                <Eraser className="h-3.5 w-3.5" />
                {mode === "bbox" ? "清除全部框" : "清除涂抹"}
              </button>
            </div>
          </>
        )}
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
