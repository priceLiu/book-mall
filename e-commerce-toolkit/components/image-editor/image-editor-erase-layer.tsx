"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent } from "react";

export type ImageEditorEraseTool = "brush" | "box" | "lasso";

export type ImageEditorEraseLayerHandle = {
  hasMarks: () => boolean;
  /** 白=要消除的区域，黑=保留。 */
  toMaskDataUrl: (width: number, height: number) => string | null;
  clear: () => void;
};

type Props = {
  tool: ImageEditorEraseTool;
  brushSize: number;
  disabled?: boolean;
  imageWidth: number;
  imageHeight: number;
  /** 涂抹松手后立刻消除。 */
  onStrokeEnd?: () => void;
};

export const ImageEditorEraseLayer = forwardRef<ImageEditorEraseLayerHandle, Props>(
  function ImageEditorEraseLayer({ tool, brushSize, disabled, imageWidth, imageHeight, onStrokeEnd }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const paintRef = useRef<HTMLCanvasElement>(null);
    const liveRef = useRef<HTMLCanvasElement>(null);
    const marked = useRef(false);
    const drawing = useRef<{ x: number; y: number; points: Array<{ x: number; y: number }> } | null>(null);
    const gesturePainted = useRef(false);

    const size = () => {
      const w = Math.max(1, Math.round(imageWidth));
      const h = Math.max(1, Math.round(imageHeight));
      return { w, h };
    };

    const syncCanvas = (canvas: HTMLCanvasElement | null, clear: boolean) => {
      if (!canvas) return;
      const { w, h } = size();
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        if (clear) marked.current = false;
      }
    };

    useEffect(() => {
      syncCanvas(paintRef.current, true);
      syncCanvas(liveRef.current, true);
      const paint = paintRef.current?.getContext("2d");
      paint?.clearRect(0, 0, imageWidth, imageHeight);
      marked.current = false;
      // 换图后选区作废。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageHeight, imageWidth]);

    const pointOf = (e: ReactPointerEvent) => {
      const canvas = paintRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const box = canvas.getBoundingClientRect();
      const x = ((e.clientX - box.left) / Math.max(1, box.width)) * canvas.width;
      const y = ((e.clientY - box.top) / Math.max(1, box.height)) * canvas.height;
      return { x, y };
    };

    const radiusOf = (e: ReactPointerEvent) => {
      const canvas = paintRef.current;
      if (!canvas) return brushSize;
      const box = canvas.getBoundingClientRect();
      return Math.max(2, (brushSize / 2) * (canvas.width / Math.max(1, box.width)));
    };

    const stamp = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      ctx.fillStyle = "rgba(0,113,227,0.45)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const strokeTo = (from: { x: number; y: number }, to: { x: number; y: number }, r: number) => {
      const ctx = paintRef.current?.getContext("2d");
      if (!ctx) return;
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const step = Math.max(1, r * 0.35);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 0; i <= n; i += 1) {
        const t = i / n;
        stamp(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, r);
      }
      marked.current = true;
    };

    const drawLive = (shape: { x: number; y: number; points: Array<{ x: number; y: number }> } | null, current?: { x: number; y: number }) => {
      const canvas = liveRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !shape) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0,113,227,0.35)";
      ctx.strokeStyle = "rgba(0,113,227,0.9)";
      ctx.lineWidth = Math.max(2, canvas.width / 400);
      if (tool === "box" && current) {
        const x = Math.min(shape.x, current.x);
        const y = Math.min(shape.y, current.y);
        const w = Math.abs(current.x - shape.x);
        const h = Math.abs(current.y - shape.y);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
      if (tool === "lasso") {
        const pts = current ? [...shape.points, current] : shape.points;
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };

    const commitLive = (current: { x: number; y: number }) => {
      const shape = drawing.current;
      const paint = paintRef.current?.getContext("2d");
      const live = liveRef.current;
      if (!shape || !paint || !live) return;
      if (tool === "box") {
        const x = Math.min(shape.x, current.x);
        const y = Math.min(shape.y, current.y);
        const w = Math.abs(current.x - shape.x);
        const h = Math.abs(current.y - shape.y);
        if (w > 2 && h > 2) {
          paint.fillStyle = "rgba(0,113,227,0.45)";
          paint.fillRect(x, y, w, h);
          marked.current = true;
        }
      }
      if (tool === "lasso" && shape.points.length >= 3) {
        paint.fillStyle = "rgba(0,113,227,0.45)";
        paint.beginPath();
        paint.moveTo(shape.points[0]!.x, shape.points[0]!.y);
        for (const p of shape.points.slice(1)) paint.lineTo(p.x, p.y);
        paint.closePath();
        paint.fill();
        marked.current = true;
      }
      live.getContext("2d")?.clearRect(0, 0, live.width, live.height);
    };

    useImperativeHandle(ref, () => ({
      hasMarks: () => marked.current,
      clear: () => {
        const paint = paintRef.current;
        const live = liveRef.current;
        paint?.getContext("2d")?.clearRect(0, 0, paint.width, paint.height);
        live?.getContext("2d")?.clearRect(0, 0, live.width, live.height);
        marked.current = false;
        drawing.current = null;
      },
      toMaskDataUrl: (width, height) => {
        const paint = paintRef.current;
        if (!paint || !marked.current || width < 1 || height < 1) return null;
        const out = document.createElement("canvas");
        out.width = Math.round(width);
        out.height = Math.round(height);
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(paint, 0, 0, out.width, out.height);
        const pixels = ctx.getImageData(0, 0, out.width, out.height);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
          const on = (data[i + 3] ?? 0) > 12;
          data[i] = on ? 255 : 0;
          data[i + 1] = on ? 255 : 0;
          data[i + 2] = on ? 255 : 0;
          data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        return out.toDataURL("image/png");
      },
    }));

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      syncCanvas(paintRef.current, false);
      syncCanvas(liveRef.current, false);
      const ctx = paintRef.current?.getContext("2d");
      if (!ctx) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = pointOf(e);
      drawing.current = { x: p.x, y: p.y, points: [p] };
      gesturePainted.current = false;
      if (tool === "brush") {
        stamp(ctx, p.x, p.y, radiusOf(e));
        marked.current = true;
        gesturePainted.current = true;
      }
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const shape = drawing.current;
      if (!shape || disabled) return;
      const p = pointOf(e);
      if (tool === "brush") {
        strokeTo(shape, p, radiusOf(e));
        gesturePainted.current = true;
        drawing.current = { ...shape, x: p.x, y: p.y };
        return;
      }
      if (tool === "lasso") shape.points.push(p);
      drawLive(shape, p);
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drawing.current) return;
      const p = pointOf(e);
      if (tool !== "brush") commitLive(p);
      const painted = tool === "brush" && gesturePainted.current;
      drawing.current = null;
      gesturePainted.current = false;
      if (painted) onStrokeEnd?.();
    };

    return (
      <div
        ref={rootRef}
        className="absolute inset-0 z-[42] touch-none"
        style={{ cursor: disabled ? "default" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={paintRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <canvas ref={liveRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    );
  },
);
