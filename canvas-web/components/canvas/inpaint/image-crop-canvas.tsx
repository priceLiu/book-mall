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
import type { LibtvCropAspectRatio } from "@/lib/canvas/libtv-crop-session";
import { registerMagicEditFrameAnchor } from "@/lib/canvas/libtv-magic-edit-frame-anchor";
import { RectFrameHandles, type DisplayRect } from "./rect-frame-handles";
import {
  clampRectToImage,
  normalizeRect,
  resizeRectByHandle,
  type FrameHandleId,
  type ImageRect,
} from "./rect-frame-utils";

export type ImageCropCanvasHandle = {
  exportCropBbox: () => [number, number, number, number] | null;
  getNaturalSize: () => { width: number; height: number } | null;
};

type Props = {
  imageUrl: string;
  aspectRatio: LibtvCropAspectRatio;
  frameAnchorNodeId?: string;
  className?: string;
};

type DisplayBox = { w: number; h: number; ox: number; oy: number };

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

function parseAspectRatio(r: LibtvCropAspectRatio): number | null {
  if (r === "original") return null;
  const [a, b] = r.split(":").map(Number);
  if (!a || !b) return null;
  return a / b;
}

function rectToDisplay(
  rect: ImageRect,
  box: DisplayBox,
  nat: { w: number; h: number },
): DisplayRect {
  const x1 = (rect.x1 / nat.w) * box.w;
  const y1 = (rect.y1 / nat.h) * box.h;
  const x2 = (rect.x2 / nat.w) * box.w;
  const y2 = (rect.y2 / nat.h) * box.h;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

export const ImageCropCanvas = forwardRef<ImageCropCanvasHandle, Props>(
  function ImageCropCanvas(
    { imageUrl, aspectRatio, frameAnchorNodeId, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const imgElRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const naturalRef = useRef({ w: 0, h: 0 });
    const displayBoxRef = useRef<DisplayBox>({ w: 0, h: 0, oy: 0, ox: 0 });
    const rectRef = useRef<ImageRect>({ x1: 0, y1: 0, x2: 0, y2: 0 });
    const layoutReadyRef = useRef(false);
    const [displayBox, setDisplayBox] = useState<DisplayBox>({
      w: 0,
      h: 0,
      ox: 0,
      oy: 0,
    });
    const [cropRect, setCropRect] = useState<ImageRect>({
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    });
    const [drag, setDrag] = useState<{
      handle: FrameHandleId;
      startRect: ImageRect;
      startPoint: { x: number; y: number };
    } | null>(null);

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
      naturalRef.current = nat;
      displayBoxRef.current = box;
      setDisplayBox(box);
      if (!layoutReadyRef.current) {
        const full = { x1: 0, y1: 0, x2: nat.w, y2: nat.h };
        rectRef.current = full;
        setCropRect(full);
        layoutReadyRef.current = true;
      }
      if (canvasRef.current) {
        canvasRef.current.width = Math.max(1, Math.round(box.w));
        canvasRef.current.height = Math.max(1, Math.round(box.h));
      }
    }, []);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const box = displayBoxRef.current;
      const nat = naturalRef.current;
      const rect = rectRef.current;
      if (!canvas || !nat.w || !box.w) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const d = rectToDisplay(rect, box, nat);

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(d.x, d.y, d.w, d.h);

      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);

      const thirdW = d.w / 3;
      const thirdH = d.h / 3;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(d.x + thirdW * i, d.y);
        ctx.lineTo(d.x + thirdW * i, d.y + d.h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + thirdH * i);
        ctx.lineTo(d.x + d.w, d.y + thirdH * i);
        ctx.stroke();
      }
    }, []);

    useEffect(() => {
      layoutReadyRef.current = false;
    }, [imageUrl]);

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
    }, [redraw, displayBox, cropRect, aspectRatio]);

    useEffect(() => {
      const nat = naturalRef.current;
      if (!nat.w) return;
      const aspect = parseAspectRatio(aspectRatio);
      const n = normalizeRect(rectRef.current);
      let next: ImageRect;
      if (!aspect) {
        next = clampRectToImage(n, nat.w, nat.h);
      } else {
        const cx = (n.x1 + n.x2) / 2;
        const cy = (n.y1 + n.y2) / 2;
        let w = n.x2 - n.x1;
        let h = n.y2 - n.y1;
        if (w / Math.max(h, 1) > aspect) h = w / aspect;
        else w = h * aspect;
        next = clampRectToImage(
          { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 },
          nat.w,
          nat.h,
        );
      }
      rectRef.current = next;
      setCropRect(next);
    }, [aspectRatio]);

    useEffect(() => {
      if (!frameAnchorNodeId) return;
      return registerMagicEditFrameAnchor(frameAnchorNodeId, () => frameRef.current);
    }, [frameAnchorNodeId]);

    const clientToImagePoint = useCallback(
      (clientX: number, clientY: number): { x: number; y: number } | null => {
        const container = containerRef.current;
        const nat = naturalRef.current;
        const box = displayBoxRef.current;
        if (!container || !nat.w || !box.w) return null;
        const cr = container.getBoundingClientRect();
        const lx = clientX - cr.left - box.ox;
        const ly = clientY - cr.top - box.oy;
        return {
          x: (lx / box.w) * nat.w,
          y: (ly / box.h) * nat.h,
        };
      },
      [],
    );

    const onHandlePointerDown = useCallback(
      (handle: FrameHandleId, e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const ip = clientToImagePoint(e.clientX, e.clientY);
        if (!ip) return;
        setDrag({
          handle,
          startRect: { ...rectRef.current },
          startPoint: ip,
        });
      },
      [clientToImagePoint],
    );

    useEffect(() => {
      if (!drag) return;
      const aspect = parseAspectRatio(aspectRatio);

      const onMove = (e: PointerEvent) => {
        e.preventDefault();
        const ip = clientToImagePoint(e.clientX, e.clientY);
        if (!ip) return;
        const nat = naturalRef.current;
        const next = resizeRectByHandle(
          drag.startRect,
          drag.handle,
          ip,
          drag.startPoint,
          nat.w,
          nat.h,
          aspect,
        );
        rectRef.current = next;
        setCropRect(next);
      };

      const onUp = () => setDrag(null);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    }, [drag, aspectRatio, clientToImagePoint]);

    useImperativeHandle(ref, () => ({
      getNaturalSize: () => {
        const nat = naturalRef.current;
        if (!nat.w || !nat.h) return null;
        return { width: nat.w, height: nat.h };
      },
      exportCropBbox: () => {
        const nat = naturalRef.current;
        const r = normalizeRect(rectRef.current);
        if (!nat.w) return null;
        const x1 = Math.round(r.x1);
        const y1 = Math.round(r.y1);
        const x2 = Math.round(r.x2);
        const y2 = Math.round(r.y2);
        if (x2 - x1 < 4 || y2 - y1 < 4) return null;
        return [x1, y1, x2, y2];
      },
    }));

    const displayRect = rectToDisplay(cropRect, displayBox, naturalRef.current);

    return (
      <div
        ref={containerRef}
        className={cn("absolute inset-0 z-20", RF_NO_DRAG, RF_NO_WHEEL, "nopan", className)}
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
        <div
          data-libtv-crop-overlay
          className="absolute touch-none"
          style={{
            left: displayBox.ox,
            top: displayBox.oy,
            width: displayBox.w || undefined,
            height: displayBox.h || undefined,
          }}
        >
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
          {displayBox.w > 0 ? (
            <>
              <div
                ref={frameRef}
                data-libtv-crop-frame
                className="pointer-events-none absolute border border-transparent"
                style={{
                  left: displayRect.x,
                  top: displayRect.y,
                  width: displayRect.w,
                  height: displayRect.h,
                }}
              />
              <RectFrameHandles
                displayRect={displayRect}
                allowMove
                onHandlePointerDown={onHandlePointerDown}
              />
            </>
          ) : null}
        </div>
      </div>
    );
  },
);
