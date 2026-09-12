"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { LibtvExpandHandles } from "./libtv-expand-handles";
import type { FrameHandleId } from "./rect-frame-utils";

/** 扩图把手 · portal 到 body，避免外框超出节点后被裁切/遮挡 */
export function LibtvExpandHandlesPortal({
  frameRect,
  onHandlePointerDown,
}: {
  frameRect: DOMRect | null;
  onHandlePointerDown: (handle: FrameHandleId, e: ReactPointerEvent) => void;
}) {
  const mounted = useClientPortalMounted();
  if (!mounted || !frameRect || frameRect.width <= 0 || frameRect.height <= 0) {
    return null;
  }

  return createPortal(
    <div
      data-libtv-expand-handles-portal
      className="pointer-events-none fixed z-[1600] touch-none"
      style={{
        left: frameRect.left,
        top: frameRect.top,
        width: frameRect.width,
        height: frameRect.height,
      }}
    >
      <LibtvExpandHandles
        outerW={frameRect.width}
        outerH={frameRect.height}
        onHandlePointerDown={onHandlePointerDown}
      />
    </div>,
    document.body,
  );
}
