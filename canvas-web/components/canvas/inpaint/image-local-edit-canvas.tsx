"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { LibtvInpaintTool } from "@/lib/canvas/libtv-inpaint-session";
import {
  checkerboardPattern,
  fillCheckerboard,
  SELECTION_STROKE,
} from "./selection-visual";

export type LocalEditExportedSelection =
  | { kind: "mask"; maskDataUrl: string }
  | { kind: "bbox"; bbox: [number, number, number, number] }
  | {
      kind: "multi-bbox";
      bboxList: [number, number, number, number][][];
    };

/** 与 book-mall wan2.7 每图最多框数一致 */
const MAX_BBOX_PER_IMAGE = 2;

export type ImageLocalEditCanvasHandle = {
  exportSelection: () => LocalEditExportedSelection | null;
  /** 源图 naturalWidth × naturalHeight（与 mask / bbox 坐标系一致） */
  getNaturalSize: () => { width: number; height: number } | null;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

type Props = {
  imageUrl: string;
  tool: LibtvInpaintTool;
  brushSize: number;
  selectionMode: "mask" | "bbox";
  className?: string;
};

/** 原图像素坐标 */
type ImagePoint = { x: number; y: number };

type HistoryEntry =
  | { type: "stroke"; points: ImagePoint[]; brushSize: number; eraser: boolean }
  | { type: "rect"; x1: number; y1: number; x2: number; y2: number };

type DisplayBox = { w: number; h: number; ox: number; oy: number };

/** object-contain 下 img 元素占满容器，实际绘制区域需按宽高比单独计算 */
function computeObjectContainBox(
  elemW: number,
  elemH: number,
  natW: number,
  natH: number,
): DisplayBox | null {
  if (elemW <= 0 || elemH <= 0 || natW <= 0 || natH <= 0) return null;
  const scale = Math.min(elemW / natW, elemH / natH);
  const w = natW * scale;
  const h = natH * scale;
  return { w, h, ox: (elemW - w) / 2, oy: (elemH - h) / 2 };
}

function normalizeRectEntry(entry: Extract<HistoryEntry, { type: "rect" }>): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} | null {
  const x1 = Math.min(entry.x1, entry.x2);
  const y1 = Math.min(entry.y1, entry.y2);
  const x2 = Math.max(entry.x1, entry.x2);
  const y2 = Math.max(entry.y1, entry.y2);
  if (x2 - x1 < 4 || y2 - y1 < 4) return null;
  return { x1, y1, x2, y2 };
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
  return out.toDataURL("image/png");
}

export const ImageLocalEditCanvas = forwardRef<ImageLocalEditCanvasHandle, Props>(
  function ImageLocalEditCanvas(
    { imageUrl, tool, brushSize, selectionMode, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgElRef = useRef<HTMLImageElement>(null);
    const displayRef = useRef<HTMLCanvasElement>(null);
    const maskRef = useRef<HTMLCanvasElement>(null);
    const displayBoxRef = useRef<DisplayBox>({ w: 0, h: 0, ox: 0, oy: 0 });
    const naturalRef = useRef({ w: 0, h: 0 });
    const [natural, setNatural] = useState({ w: 0, h: 0 });
    const [displayBox, setDisplayBox] = useState<DisplayBox>({
      w: 0,
      h: 0,
      ox: 0,
      oy: 0,
    });
    const drawing = useRef(false);
    const currentStroke = useRef<ImagePoint[]>([]);
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const entriesRef = useRef<HistoryEntry[]>(entries);
    const selectionModeRef = useRef(selectionMode);
    const [undoStack, setUndoStack] = useState<HistoryEntry[][]>([]);
    const [redoStack, setRedoStack] = useState<HistoryEntry[][]>([]);
    const undoStackRef = useRef(undoStack);
    const redoStackRef = useRef(redoStack);
    entriesRef.current = entries;
    selectionModeRef.current = selectionMode;
    undoStackRef.current = undoStack;
    redoStackRef.current = redoStack;
    const rectStart = useRef<ImagePoint | null>(null);
    const liveRectRef = useRef<Extract<HistoryEntry, { type: "rect" }> | null>(
      null,
    );
    const [liveRect, setLiveRect] = useState<HistoryEntry | null>(null);

    displayBoxRef.current = displayBox;
    naturalRef.current = natural;

    const syncLayoutFromImg = useCallback(() => {
      const img = imgElRef.current;
      if (!img || !img.naturalWidth) return;

      const nat = { w: img.naturalWidth, h: img.naturalHeight };
      const box = computeObjectContainBox(
        img.clientWidth,
        img.clientHeight,
        nat.w,
        nat.h,
      );
      if (!box) return;

      setNatural(nat);
      setDisplayBox(box);

      if (displayRef.current) {
        displayRef.current.width = Math.max(1, Math.round(box.w));
        displayRef.current.height = Math.max(1, Math.round(box.h));
      }
      if (maskRef.current) {
        maskRef.current.width = nat.w;
        maskRef.current.height = nat.h;
      }
    }, []);

    const imageToDisplay = useCallback(
      (p: ImagePoint, box: DisplayBox, nat: { w: number; h: number }): ImagePoint => {
        if (!nat.w || !box.w) return p;
        return {
          x: (p.x / nat.w) * box.w,
          y: (p.y / nat.h) * box.h,
        };
      },
      [],
    );

    const brushSizeInImage = useCallback(
      (box: DisplayBox, nat: { w: number; h: number }) => {
        if (!box.w || !nat.w) return brushSize;
        return brushSize * (nat.w / box.w);
      },
      [brushSize],
    );

    const redraw = useCallback(() => {
      const display = displayRef.current;
      const mask = maskRef.current;
      const box = displayBoxRef.current;
      const nat = naturalRef.current;
      if (!display || !mask || !nat.w || !box.w) return;
      const dctx = display.getContext("2d");
      const mctx = mask.getContext("2d");
      if (!dctx || !mctx) return;

      dctx.clearRect(0, 0, display.width, display.height);
      mctx.clearRect(0, 0, mask.width, mask.height);

      const drawEntry = (entry: HistoryEntry) => {
        if (entry.type === "rect") {
          const norm = normalizeRectEntry(entry);
          if (!norm) return;
          const p1 = imageToDisplay({ x: norm.x1, y: norm.y1 }, box, nat);
          const p2 = imageToDisplay({ x: norm.x2, y: norm.y2 }, box, nat);
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const w = Math.abs(p2.x - p1.x);
          const h = Math.abs(p2.y - p1.y);
          fillCheckerboard(dctx, x, y, w, h);
          dctx.strokeStyle = SELECTION_STROKE;
          dctx.lineWidth = 2;
          dctx.strokeRect(x, y, w, h);
          mctx.fillStyle = "rgba(255,255,255,1)";
          mctx.fillRect(norm.x1, norm.y1, norm.x2 - norm.x1, norm.y2 - norm.y1);
          return;
        }
        if (entry.points.length < 1) return;

        const dispPts = entry.points.map((p) => imageToDisplay(p, box, nat));
        const displayLineW = entry.brushSize * (box.w / nat.w);

        dctx.save();
        dctx.lineCap = "round";
        dctx.lineJoin = "round";
        dctx.lineWidth = displayLineW;
        if (entry.eraser) {
          dctx.globalCompositeOperation = "destination-out";
          dctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          dctx.globalCompositeOperation = "source-over";
          dctx.strokeStyle = checkerboardPattern(dctx);
        }
        dctx.beginPath();
        dctx.moveTo(dispPts[0]!.x, dispPts[0]!.y);
        for (let i = 1; i < dispPts.length; i++) {
          dctx.lineTo(dispPts[i]!.x, dispPts[i]!.y);
        }
        dctx.stroke();
        dctx.restore();

        ctxMaskStroke(mctx, entry.points, entry.brushSize, entry.eraser);
      };

      for (const e of entries) drawEntry(e);
      if (liveRect && liveRect.type === "rect") drawEntry(liveRect);
    }, [entries, imageToDisplay, liveRect]);

    function ctxMaskStroke(
      mctx: CanvasRenderingContext2D,
      points: ImagePoint[],
      lineW: number,
      erase: boolean,
    ) {
      mctx.save();
      mctx.lineCap = "round";
      mctx.lineJoin = "round";
      mctx.lineWidth = lineW;
      if (erase) {
        mctx.globalCompositeOperation = "destination-out";
        mctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        mctx.globalCompositeOperation = "source-over";
        mctx.strokeStyle = "rgba(255,255,255,1)";
      }
      mctx.beginPath();
      mctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++) {
        mctx.lineTo(points[i]!.x, points[i]!.y);
      }
      mctx.stroke();
      mctx.restore();
    }

    useEffect(() => {
      syncLayoutFromImg();
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => syncLayoutFromImg());
      ro.observe(el);
      return () => ro.disconnect();
    }, [imageUrl, syncLayoutFromImg]);

    useEffect(() => {
      redraw();
    }, [redraw, displayBox, natural]);

    const redrawRef = useRef(redraw);
    redrawRef.current = redraw;

    /** 仅当前工具决定交互；selectionMode 只影响 exportSelection 导出格式 */
    const isRectTool = tool === "rect";

    const toImagePoint = (e: React.PointerEvent): ImagePoint | null => {
      const canvas = displayRef.current;
      const nat = naturalRef.current;
      if (!canvas || !nat.w) return null;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return null;
      return {
        x: (cx / rect.width) * nat.w,
        y: (cy / rect.height) * nat.h,
      };
    };

    const onPointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const p = toImagePoint(e);
      if (!p) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;

      if (isRectTool) {
        if (selectionModeRef.current === "bbox") {
          const rectCount = entriesRef.current.filter((e) => e.type === "rect").length;
          if (rectCount >= MAX_BBOX_PER_IMAGE) {
            return;
          }
        }
        rectStart.current = p;
        const next = { type: "rect" as const, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        liveRectRef.current = next;
        setLiveRect(next);
        return;
      }
      currentStroke.current = [p];
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      e.stopPropagation();
      const p = toImagePoint(e);
      if (!p) return;

      if (isRectTool) {
        const s = rectStart.current;
        if (!s) return;
        const next = { type: "rect" as const, x1: s.x, y1: s.y, x2: p.x, y2: p.y };
        liveRectRef.current = next;
        setLiveRect(next);
        return;
      }

      currentStroke.current.push(p);
      const display = displayRef.current;
      const mask = maskRef.current;
      const box = displayBoxRef.current;
      const nat = naturalRef.current;
      const dctx = display?.getContext("2d");
      const mctx = mask?.getContext("2d");
      if (!dctx || !mctx || currentStroke.current.length < 2) return;

      const pts = currentStroke.current;
      const erase = tool === "eraser";
      const dispPrev = imageToDisplay(pts[pts.length - 2]!, box, nat);
      const dispCur = imageToDisplay(pts[pts.length - 1]!, box, nat);

      for (const ctx of [dctx, mctx]) {
        ctx.save();
        ctx.lineCap = "round";
        const lineW =
          ctx === dctx ? brushSize : brushSizeInImage(box, nat);
        ctx.lineWidth = lineW;
        if (erase) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle =
            ctx === dctx ? checkerboardPattern(dctx) : "rgba(255,255,255,1)";
        }
        ctx.beginPath();
        if (ctx === dctx) {
          ctx.moveTo(dispPrev.x, dispPrev.y);
          ctx.lineTo(dispCur.x, dispCur.y);
        } else {
          ctx.moveTo(pts[pts.length - 2]!.x, pts[pts.length - 2]!.y);
          ctx.lineTo(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y);
        }
        ctx.stroke();
        ctx.restore();
      }
    };

    const onPointerUp = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      drawing.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      if (isRectTool) {
        const committed = liveRectRef.current;
        if (committed && normalizeRectEntry(committed)) {
          setEntries((prev) => {
            setUndoStack((u) => [...u, prev]);
            setRedoStack([]);
            // 必须按操作时间顺序保留条目；若把 rect 挪到 eraser 之后重绘，擦除会失效
            const next: HistoryEntry[] = [...prev, committed];
            entriesRef.current = next;
            return next;
          });
        }
        liveRectRef.current = null;
        setLiveRect(null);
        rectStart.current = null;
        return;
      }

      if (currentStroke.current.length > 0) {
        const box = displayBoxRef.current;
        const nat = naturalRef.current;
        const stroke: HistoryEntry = {
          type: "stroke",
          points: [...currentStroke.current],
          brushSize: brushSizeInImage(box, nat),
          eraser: tool === "eraser",
        };
        setEntries((prev) => {
          setUndoStack((u) => [...u, prev]);
          setRedoStack([]);
          const next = [...prev, stroke];
          entriesRef.current = next;
          return next;
        });
      }
      currentStroke.current = [];
    };

    useImperativeHandle(ref, () => ({
      getNaturalSize: () => {
        const nat = naturalRef.current;
        if (!nat.w || !nat.h) return null;
        return { width: nat.w, height: nat.h };
      },
      exportSelection: () => {
        const mode = selectionModeRef.current;
        const currentEntries = entriesRef.current;
        if (mode === "bbox") {
          const rectEntries = currentEntries.filter(
            (e): e is Extract<HistoryEntry, { type: "rect" }> => e.type === "rect",
          );
          const pending = liveRectRef.current;
          if (pending && normalizeRectEntry(pending)) {
            rectEntries.push(pending);
          }
          const boxes = rectEntries
            .map((e) => normalizeRectEntry(e))
            .filter(Boolean)
            .map(
              (b) =>
                [
                  Math.round(b!.x1),
                  Math.round(b!.y1),
                  Math.round(b!.x2),
                  Math.round(b!.y2),
                ] as [number, number, number, number],
            );
          if (boxes.length) {
            const capped = boxes.slice(0, MAX_BBOX_PER_IMAGE);
            if (capped.length === 1) {
              return { kind: "bbox", bbox: capped[0]! };
            }
            return { kind: "multi-bbox", bboxList: [capped] };
          }
          const hasStrokes = currentEntries.some((e) => e.type === "stroke");
          if (!hasStrokes) return null;
        }
        redrawRef.current();
        const maskDataUrl = exportMaskDataUrl(maskRef.current);
        return maskDataUrl ? { kind: "mask", maskDataUrl } : null;
      },
      undo: () => {
        setUndoStack((prev) => {
          if (!prev.length) return prev;
          const snapshot = prev[prev.length - 1]!;
          setEntries((cur) => {
            setRedoStack((r) => [...r, cur]);
            return snapshot;
          });
          return prev.slice(0, -1);
        });
      },
      redo: () => {
        setRedoStack((prev) => {
          if (!prev.length) return prev;
          const snapshot = prev[prev.length - 1]!;
          setEntries((cur) => {
            setUndoStack((u) => [...u, cur]);
            return snapshot;
          });
          return prev.slice(0, -1);
        });
      },
      canUndo: () => undoStackRef.current.length > 0,
      canRedo: () => redoStackRef.current.length > 0,
    }));

    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 z-20",
          RF_NO_DRAG,
          RF_NO_WHEEL,
          "nopan",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgElRef}
          src={imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full select-none object-contain"
          onLoad={syncLayoutFromImg}
        />
        <canvas
          ref={displayRef}
          className="absolute touch-none cursor-crosshair"
          style={{
            left: displayBox.ox,
            top: displayBox.oy,
            width: displayBox.w || undefined,
            height: displayBox.h || undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <canvas ref={maskRef} className="hidden" aria-hidden />
      </div>
    );
  },
);
