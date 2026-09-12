"use client";

import type { CSSProperties, PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { FrameHandleId } from "./rect-frame-utils";

export type DisplayRect = { x: number; y: number; w: number; h: number };

const CORNER_HANDLES: FrameHandleId[] = ["nw", "ne", "se", "sw"];
const EDGE_HANDLES: FrameHandleId[] = ["n", "e", "s", "w"];

const CROP_HANDLE_INSET = 12;

function cornerStyle(id: FrameHandleId, r: DisplayRect, inset: number): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    zIndex: 80,
  };
  switch (id) {
    case "nw":
      return {
        ...base,
        left: r.x + inset,
        top: r.y + inset,
        transform: "translate(-50%, -50%)",
      };
    case "ne":
      return {
        ...base,
        left: r.x + r.w - inset,
        top: r.y + inset,
        transform: "translate(-50%, -50%)",
      };
    case "se":
      return {
        ...base,
        left: r.x + r.w - inset,
        top: r.y + r.h - inset,
        transform: "translate(-50%, -50%)",
      };
    case "sw":
      return {
        ...base,
        left: r.x + inset,
        top: r.y + r.h - inset,
        transform: "translate(-50%, -50%)",
      };
    default:
      return base;
  }
}

function edgeStyle(id: FrameHandleId, r: DisplayRect): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    zIndex: 75,
  };
  switch (id) {
    case "n":
      return {
        ...base,
        left: r.x + r.w / 2,
        top: r.y,
        transform: "translate(-50%, -50%)",
      };
    case "s":
      return {
        ...base,
        left: r.x + r.w / 2,
        top: r.y + r.h,
        transform: "translate(-50%, -50%)",
      };
    case "e":
      return {
        ...base,
        left: r.x + r.w,
        top: r.y + r.h / 2,
        transform: "translate(-50%, -50%)",
      };
    case "w":
      return {
        ...base,
        left: r.x,
        top: r.y + r.h / 2,
        transform: "translate(-50%, -50%)",
      };
    default:
      return base;
  }
}

type Props = {
  displayRect: DisplayRect;
  variant?: "crop" | "expand";
  allowMove?: boolean;
  onHandlePointerDown: (handle: FrameHandleId, e: PointerEvent) => void;
  className?: string;
};

export function RectFrameHandles({
  displayRect,
  variant = "crop",
  allowMove,
  onHandlePointerDown,
  className,
}: Props) {
  if (displayRect.w <= 0 || displayRect.h <= 0) return null;

  const minSpan = Math.min(displayRect.w, displayRect.h);
  const inset =
    variant === "crop"
      ? Math.min(CROP_HANDLE_INSET, Math.max(4, minSpan * 0.08))
      : 0;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-[30]", className)}>
      {allowMove ? (
        <div
          className={cn(
            "libtv-frame-move-plate pointer-events-auto absolute cursor-move",
            RF_NO_DRAG,
            RF_NO_WHEEL,
            "nopan",
          )}
          style={{
            left: displayRect.x,
            top: displayRect.y,
            width: displayRect.w,
            height: displayRect.h,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandlePointerDown("move", e);
          }}
        />
      ) : null}
      {variant === "expand"
        ? EDGE_HANDLES.map((id) => (
            <div
              key={id}
              role="presentation"
              data-libtv-frame-handle={id}
              className={cn(
                "libtv-frame-expand-edge pointer-events-auto",
                RF_NO_DRAG,
                RF_NO_WHEEL,
                "nopan",
                id === "n" || id === "s"
                  ? "libtv-frame-expand-edge-h"
                  : "libtv-frame-expand-edge-v",
              )}
              style={edgeStyle(id, displayRect)}
              onPointerDown={(e) => {
                e.stopPropagation();
                onHandlePointerDown(id, e);
              }}
            />
          ))
        : null}
      {CORNER_HANDLES.map((id) => (
        <div
          key={id}
          role="presentation"
          data-libtv-frame-handle={id}
          className={cn(
            variant === "expand"
              ? "libtv-frame-expand-corner pointer-events-auto"
              : "libtv-frame-corner-handle pointer-events-auto",
            RF_NO_DRAG,
            RF_NO_WHEEL,
            "nopan",
          )}
          style={cornerStyle(id, displayRect, inset)}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandlePointerDown(id, e);
          }}
        />
      ))}
    </div>
  );
}
