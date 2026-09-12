"use client";

import type { CSSProperties, PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { FrameHandleId } from "./rect-frame-utils";

/** 与 liblib 扩图框一致：角 10×10、边胶囊，略伸出外框 */
const CORNER_SIZE = 10;
const CORNER_OUTSET = 5;
const EDGE_H = { w: 22, h: 8, off: 4 };
const EDGE_V = { w: 8, h: 22, off: 4 };

type Props = {
  outerW: number;
  outerH: number;
  onHandlePointerDown: (handle: FrameHandleId, e: React.PointerEvent) => void;
};

function Handle({
  id,
  className,
  style,
  onPointerDown,
}: {
  id: FrameHandleId;
  className?: string;
  style: CSSProperties;
  onPointerDown: (e: PointerEvent) => void;
}) {
  return (
    <div
      role="presentation"
      data-libtv-frame-handle={id}
      className={cn(
        "libtv-expand-handle pointer-events-auto absolute z-[90] rounded-sm border border-white/60 bg-neutral-800",
        RF_NO_DRAG,
        RF_NO_WHEEL,
        "nopan",
        className,
      )}
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPointerDown(e);
      }}
    />
  );
}

export function LibtvExpandHandles({ outerW, outerH, onHandlePointerDown }: Props) {
  if (outerW <= 0 || outerH <= 0) return null;

  const mk = (handle: FrameHandleId) => (e: PointerEvent) =>
    onHandlePointerDown(handle, e);

  const c = CORNER_SIZE;
  const o = CORNER_OUTSET;

  return (
    <>
      <Handle
        id="nw"
        className="cursor-nwse-resize"
        style={{ left: -o, top: -o, width: c, height: c }}
        onPointerDown={mk("nw")}
      />
      <Handle
        id="ne"
        className="cursor-nesw-resize"
        style={{ left: outerW - c + o, top: -o, width: c, height: c }}
        onPointerDown={mk("ne")}
      />
      <Handle
        id="sw"
        className="cursor-nesw-resize"
        style={{ left: -o, top: outerH - c + o, width: c, height: c }}
        onPointerDown={mk("sw")}
      />
      <Handle
        id="se"
        className="cursor-nwse-resize"
        style={{ left: outerW - c + o, top: outerH - c + o, width: c, height: c }}
        onPointerDown={mk("se")}
      />
      <Handle
        id="n"
        className="cursor-ns-resize"
        style={{
          left: outerW / 2 - EDGE_H.w / 2,
          top: -EDGE_H.off,
          width: EDGE_H.w,
          height: EDGE_H.h,
        }}
        onPointerDown={mk("n")}
      />
      <Handle
        id="s"
        className="cursor-ns-resize"
        style={{
          left: outerW / 2 - EDGE_H.w / 2,
          top: outerH - EDGE_H.h + EDGE_H.off,
          width: EDGE_H.w,
          height: EDGE_H.h,
        }}
        onPointerDown={mk("s")}
      />
      <Handle
        id="w"
        className="cursor-ew-resize"
        style={{
          left: -EDGE_V.off,
          top: outerH / 2 - EDGE_V.h / 2,
          width: EDGE_V.w,
          height: EDGE_V.h,
        }}
        onPointerDown={mk("w")}
      />
      <Handle
        id="e"
        className="cursor-ew-resize"
        style={{
          left: outerW - EDGE_V.w + EDGE_V.off,
          top: outerH / 2 - EDGE_V.h / 2,
          width: EDGE_V.w,
          height: EDGE_V.h,
        }}
        onPointerDown={mk("e")}
      />
    </>
  );
}
