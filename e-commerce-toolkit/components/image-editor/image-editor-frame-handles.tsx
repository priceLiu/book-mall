"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import {
  dragImageEditorCropRect,
  type ImageEditorCropRect,
} from "@/lib/image-editor-crop-rect";
import type { ImageEditorFrameResizeHandleId } from "@/lib/image-editor-frame-resize";
import { cn } from "@/lib/utils";

const HANDLE_POS: Record<ImageEditorFrameResizeHandleId, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

type Props = {
  crop: ImageEditorCropRect;
  naturalWidth: number;
  naturalHeight: number;
  sourceScale: number;
  lockAspect: boolean;
  disabled?: boolean;
  onCrop: (rect: ImageEditorCropRect) => void;
  onDragActiveChange?: (active: boolean) => void;
};

export function ImageEditorFrameHandles({
  crop,
  naturalWidth,
  naturalHeight,
  sourceScale,
  lockAspect,
  disabled,
  onCrop,
  onDragActiveChange,
}: Props) {
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const onCropRef = useRef(onCrop);
  onCropRef.current = onCrop;
  const lockRef = useRef(lockAspect);
  lockRef.current = lockAspect;
  const scaleRef = useRef(sourceScale);
  scaleRef.current = sourceScale > 0 ? sourceScale : 1;

  const onHandleDown =
    (handle: ImageEditorFrameResizeHandleId) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget;
      onDragActiveChange?.(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const start = { ...cropRef.current };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        const scale = scaleRef.current;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        onCropRef.current(
          dragImageEditorCropRect(
            handle,
            start,
            dx,
            dy,
            lockRef.current,
            naturalWidth,
            naturalHeight,
          ),
        );
      };

      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        onDragActiveChange?.(false);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

  return (
    <div className="pointer-events-none absolute inset-0 z-[50]">
      {(Object.keys(HANDLE_POS) as ImageEditorFrameResizeHandleId[]).map((id) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          aria-label={`裁切 ${id}`}
          style={{ touchAction: "none" }}
          className={cn(
            "pointer-events-auto absolute touch-none select-none rounded-sm border border-[var(--ie-cream)] bg-[var(--ie-border)] shadow-sm disabled:opacity-40",
            id === "n" || id === "s" ? "h-4 w-10" : id === "e" || id === "w" ? "h-10 w-4" : "h-4 w-4",
            HANDLE_POS[id],
          )}
          onPointerDown={onHandleDown(id)}
        />
      ))}
    </div>
  );
}

export function ImageEditorRectCropRuleGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[18] grid grid-cols-3 grid-rows-3 overflow-hidden rounded-lg"
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "border border-[var(--ie-cream)]/70",
            i % 3 !== 0 && "border-l-[var(--ie-cream)]/50",
            i >= 3 && "border-t-[var(--ie-cream)]/50",
          )}
        />
      ))}
    </div>
  );
}
