"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { LibtvExpandAspectRatio } from "@/lib/canvas/libtv-expand-session";
import { registerMagicEditFrameAnchor } from "@/lib/canvas/libtv-magic-edit-frame-anchor";
import { ImageExpandFrameChrome } from "./image-expand-frame-chrome";
import { LibtvExpandHandlesPortal } from "./libtv-expand-handles-portal";
import type { FrameHandleId } from "./rect-frame-utils";

export type CanvasExpandOffsets = {
  left_offset: number;
  right_offset: number;
  top_offset: number;
  bottom_offset: number;
};

export type ImageExpandCanvasHandle = {
  exportExpandOffsets: () => CanvasExpandOffsets | null;
  getNaturalSize: () => { width: number; height: number } | null;
  getOutputSize: () => { width: number; height: number } | null;
};

type Props = {
  imageUrl: string;
  aspectRatio?: LibtvExpandAspectRatio;
  /** 注册外框锚点，供贴框 Dock portal 定位 */
  frameAnchorNodeId?: string;
  className?: string;
};

type DisplayBox = { w: number; h: number; ox: number; oy: number };
type ExpandPads = { left: number; top: number; right: number; bottom: number };

/** 把手伸出外框 · 命中区 padding */
const HANDLE_HIT_PAD = 14;

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

function parseAspectRatio(r: LibtvExpandAspectRatio): number | null {
  if (r === "original") return null;
  const [a, b] = r.split(":").map(Number);
  if (!a || !b) return null;
  return a / b;
}

function clampPads(pads: ExpandPads, nat: { w: number; h: number }): ExpandPads {
  const maxPad = Math.max(nat.w, nat.h) * 2;
  return {
    left: Math.min(maxPad, Math.max(0, Math.round(pads.left))),
    top: Math.min(maxPad, Math.max(0, Math.round(pads.top))),
    right: Math.min(maxPad, Math.max(0, Math.round(pads.right))),
    bottom: Math.min(maxPad, Math.max(0, Math.round(pads.bottom))),
  };
}

function padsToOffsets(pads: ExpandPads): CanvasExpandOffsets {
  return {
    left_offset: pads.left,
    right_offset: pads.right,
    top_offset: pads.top,
    bottom_offset: pads.bottom,
  };
}

function applyAspectToPads(
  pads: ExpandPads,
  nat: { w: number; h: number },
  aspect: number,
): ExpandPads {
  const outW = nat.w + pads.left + pads.right;
  const outH = nat.h + pads.top + pads.bottom;
  const cur = outW / Math.max(outH, 1);
  if (Math.abs(cur - aspect) < 0.002) return pads;
  if (cur > aspect) {
    const newH = outW / aspect;
    const add = (newH - outH) / 2;
    return clampPads(
      {
        left: pads.left,
        right: pads.right,
        top: pads.top + add,
        bottom: pads.bottom + add,
      },
      nat,
    );
  }
  const newW = outH * aspect;
  const add = (newW - outW) / 2;
  return clampPads(
    {
      left: pads.left + add,
      right: pads.right + add,
      top: pads.top,
      bottom: pads.bottom,
    },
    nat,
  );
}

/** 相对按下时的位移扩边，避免绝对坐标映射在右侧/右下把手处「弹出一截」 */
function padsFromHandleDelta(
  handle: FrameHandleId,
  ip: { x: number; y: number },
  startIp: { x: number; y: number },
  startPads: ExpandPads,
  nat: { w: number; h: number },
): ExpandPads {
  const dx = ip.x - startIp.x;
  const dy = ip.y - startIp.y;
  const next = { ...startPads };
  if (handle.includes("w")) next.left = Math.max(0, Math.round(startPads.left - dx));
  if (handle.includes("e")) next.right = Math.max(0, Math.round(startPads.right + dx));
  if (handle.includes("n")) next.top = Math.max(0, Math.round(startPads.top - dy));
  if (handle.includes("s")) next.bottom = Math.max(0, Math.round(startPads.bottom + dy));
  return clampPads(next, nat);
}

export const ImageExpandCanvas = forwardRef<ImageExpandCanvasHandle, Props>(
  function ImageExpandCanvas(
    { imageUrl, aspectRatio = "original", frameAnchorNodeId, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const imgElRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const naturalRef = useRef({ w: 0, h: 0 });
    const displayBoxRef = useRef<DisplayBox>({ w: 0, h: 0, ox: 0, oy: 0 });
    const padsRef = useRef<ExpandPads>({ left: 0, top: 0, right: 0, bottom: 0 });
    const layoutReadyRef = useRef(false);
    const [displayBox, setDisplayBox] = useState<DisplayBox>({
      w: 0,
      h: 0,
      ox: 0,
      oy: 0,
    });
    const [natural, setNatural] = useState({ w: 0, h: 0 });
    const [pads, setPads] = useState<ExpandPads>({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    const [dragHandle, setDragHandle] = useState<FrameHandleId | null>(null);
    const [frameScreenRect, setFrameScreenRect] = useState<DOMRect | null>(null);
    const dragSessionRef = useRef<{
      handle: FrameHandleId;
      startPads: ExpandPads;
      startIp: { x: number; y: number };
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
      setNatural(nat);
      setDisplayBox(box);
      if (!layoutReadyRef.current) {
        const zero = { left: 0, top: 0, right: 0, bottom: 0 };
        padsRef.current = zero;
        setPads(zero);
        layoutReadyRef.current = true;
      }
    }, []);

    const layout = useMemo(() => {
      if (!displayBox.w || !natural.w) return null;
      const sx = displayBox.w / natural.w;
      const sy = displayBox.h / natural.h;
      const padL = pads.left * sx;
      const padT = pads.top * sy;
      const padR = pads.right * sx;
      const padB = pads.bottom * sy;
      const outerW = displayBox.w + padL + padR;
      const outerH = displayBox.h + padT + padB;
      return {
        frameLeft: displayBox.ox - padL,
        frameTop: displayBox.oy - padT,
        outerW,
        outerH,
        innerLeft: padL,
        innerTop: padT,
        innerW: displayBox.w,
        innerH: displayBox.h,
        outputWidth: natural.w + pads.left + pads.right,
        outputHeight: natural.h + pads.top + pads.bottom,
      };
    }, [displayBox, natural, pads]);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const box = displayBoxRef.current;
      const nat = naturalRef.current;
      const p = padsRef.current;
      if (!canvas || !box.w || !nat.w) return;
      const sx = box.w / nat.w;
      const sy = box.h / nat.h;
      const padL = p.left * sx;
      const padT = p.top * sy;
      const padR = p.right * sx;
      const padB = p.bottom * sy;
      const outerW = box.w + padL + padR;
      const outerH = box.h + padT + padB;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = Math.max(1, Math.round(outerW + HANDLE_HIT_PAD * 2));
      canvas.height = Math.max(1, Math.round(outerH + HANDLE_HIT_PAD * 2));
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ox = HANDLE_HIT_PAD;
      const oy = HANDLE_HIT_PAD;
      const hasExpand = p.left + p.top + p.right + p.bottom > 0;

      if (hasExpand) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(ox, oy, outerW, outerH);
        ctx.clearRect(ox, oy, outerW, outerH);
      }

      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, outerW, outerH);

      const thirdW = outerW / 3;
      const thirdH = outerH / 3;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + thirdW * i, oy);
        ctx.lineTo(ox + thirdW * i, oy + outerH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, oy + thirdH * i);
        ctx.lineTo(ox + outerW, oy + thirdH * i);
        ctx.stroke();
      }

      if (hasExpand) {
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(ox + padL, oy + padT, box.w, box.h);
        ctx.setLineDash([]);
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
    }, [redraw, displayBox, pads, natural]);

    useEffect(() => {
      const nat = naturalRef.current;
      if (!nat.w) return;
      const aspect = parseAspectRatio(aspectRatio);
      if (!aspect) return;
      const next = applyAspectToPads(padsRef.current, nat, aspect);
      padsRef.current = next;
      setPads(next);
    }, [aspectRatio]);

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

    useEffect(() => {
      if (!frameAnchorNodeId) return;
      return registerMagicEditFrameAnchor(frameAnchorNodeId, () => frameRef.current);
    }, [frameAnchorNodeId]);

    useEffect(() => {
      if (!layout) {
        setFrameScreenRect(null);
        return;
      }
      let raf = 0;
      const tick = () => {
        const el = frameRef.current;
        if (el) setFrameScreenRect(el.getBoundingClientRect());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [layout, pads, dragHandle]);

    const onHandlePointerDown = useCallback(
      (handle: FrameHandleId, e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const ip = clientToImagePoint(e.clientX, e.clientY);
        if (!ip) return;
        dragSessionRef.current = {
          handle,
          startPads: { ...padsRef.current },
          startIp: ip,
        };
        setDragHandle(handle);
      },
      [clientToImagePoint],
    );

    useEffect(() => {
      if (!dragHandle) return;
      const aspect = parseAspectRatio(aspectRatio);

      const onMove = (e: PointerEvent) => {
        e.preventDefault();
        const session = dragSessionRef.current;
        if (!session) return;
        const ip = clientToImagePoint(e.clientX, e.clientY);
        if (!ip) return;
        let next = padsFromHandleDelta(
          session.handle,
          ip,
          session.startIp,
          session.startPads,
          naturalRef.current,
        );
        if (aspect) {
          next = applyAspectToPads(next, naturalRef.current, aspect);
        }
        padsRef.current = next;
        setPads(next);
      };

      const onUp = () => {
        dragSessionRef.current = null;
        setDragHandle(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    }, [dragHandle, aspectRatio, clientToImagePoint]);

    useImperativeHandle(ref, () => ({
      getNaturalSize: () => {
        const nat = naturalRef.current;
        if (!nat.w || !nat.h) return null;
        return { width: nat.w, height: nat.h };
      },
      getOutputSize: () => {
        const nat = naturalRef.current;
        const p = padsRef.current;
        if (!nat.w) return { width: 0, height: 0 };
        return {
          width: nat.w + p.left + p.right,
          height: nat.h + p.top + p.bottom,
        };
      },
      exportExpandOffsets: () => {
        const p = padsRef.current;
        if (p.left + p.top + p.right + p.bottom === 0) return null;
        return padsToOffsets(p);
      },
    }));

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
        {layout ? (
          <div
            data-libtv-expand-overlay
            className="absolute touch-none overflow-visible"
            style={{
              left: layout.frameLeft - HANDLE_HIT_PAD,
              top: layout.frameTop - HANDLE_HIT_PAD,
              width: layout.outerW + HANDLE_HIT_PAD * 2,
              height: layout.outerH + HANDLE_HIT_PAD * 2,
              padding: HANDLE_HIT_PAD,
            }}
          >
            <div
              ref={frameRef}
              data-libtv-expand-frame
              className="relative overflow-visible"
              style={{ width: layout.outerW, height: layout.outerH }}
            >
              <div className="pointer-events-none absolute inset-0 rounded border border-white/20" />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute"
                style={{
                  left: -HANDLE_HIT_PAD,
                  top: -HANDLE_HIT_PAD,
                }}
              />
              <ImageExpandFrameChrome
                displayRect={{ x: 0, y: 0, w: layout.outerW, h: layout.outerH }}
                outputWidth={layout.outputWidth}
                outputHeight={layout.outputHeight}
              />
            </div>
          </div>
        ) : null}
        <LibtvExpandHandlesPortal
          frameRect={frameScreenRect}
          onHandlePointerDown={onHandlePointerDown}
        />
      </div>
    );
  },
);
