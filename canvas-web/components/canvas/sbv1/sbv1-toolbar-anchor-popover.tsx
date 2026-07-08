"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useViewport } from "@xyflow/react";

export function useSbv1ToolbarAnchor(isOpen?: boolean): {
  anchorRef: RefObject<HTMLButtonElement>;
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
} {
  const anchorRef = useRef<HTMLButtonElement>(null!);
  const [internalOpen, setInternalOpen] = useState(false);
  const effectiveOpen = isOpen ?? internalOpen;
  const viewport = useViewport();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!effectiveOpen) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [effectiveOpen, viewport.x, viewport.y, viewport.zoom]);

  const rect = useMemo(() => {
    if (!effectiveOpen) return null;
    return anchorRef.current?.getBoundingClientRect() ?? null;
  }, [effectiveOpen, tick, viewport.x, viewport.y, viewport.zoom]);

  return { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect };
}

export type Sbv1ToolbarDropdownPlacement = "auto" | "above" | "below";

function resolveToolbarDropdownSide(
  rect: DOMRect,
  placement: Sbv1ToolbarDropdownPlacement,
  estimatedHeight: number,
): "above" | "below" {
  if (placement === "above") return "above";
  if (placement === "below") return "below";
  const gap = 6;
  const spaceAbove = rect.top - gap;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  if (spaceBelow >= estimatedHeight) return "below";
  if (spaceAbove >= estimatedHeight) return "above";
  return spaceBelow >= spaceAbove ? "below" : "above";
}

export function Sbv1ToolbarDropdown({
  open,
  setOpen,
  rect,
  children,
  className,
  align = "start",
  placement = "auto",
  estimatedHeight = 320,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
  children: ReactNode;
  className?: string;
  align?: "start" | "center";
  placement?: Sbv1ToolbarDropdownPlacement;
  /** auto 时用于判断向上/向下展开 */
  estimatedHeight?: number;
}) {
  if (!open || !rect || typeof document === "undefined") return null;

  const gap = 6;
  const side = resolveToolbarDropdownSide(rect, placement, estimatedHeight);
  const left =
    align === "center" ? rect.left + rect.width / 2 : rect.left;
  const top = side === "above" ? rect.top - gap : rect.bottom + gap;
  const transform =
    side === "above"
      ? align === "center"
        ? "translate(-50%, -100%)"
        : "translateY(-100%)"
      : align === "center"
        ? "translate(-50%, 0)"
        : undefined;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[1100]"
        aria-label="关闭"
        onClick={() => setOpen(false)}
      />
      <div
        className={className}
        style={{
          position: "fixed",
          left,
          top,
          transform,
          zIndex: 1101,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
