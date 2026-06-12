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

export function useSbv1ToolbarAnchor(): {
  anchorRef: RefObject<HTMLButtonElement>;
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
} {
  const anchorRef = useRef<HTMLButtonElement>(null!);
  const [open, setOpen] = useState(false);
  const viewport = useViewport();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [open, viewport.x, viewport.y, viewport.zoom]);

  const rect = useMemo(() => {
    if (!open) return null;
    return anchorRef.current?.getBoundingClientRect() ?? null;
  }, [open, tick, viewport.x, viewport.y, viewport.zoom]);

  return { anchorRef, open, setOpen, rect };
}

export function Sbv1ToolbarDropdown({
  open,
  setOpen,
  rect,
  children,
  className,
  align = "start",
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
  children: ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  if (!open || !rect || typeof document === "undefined") return null;

  const left =
    align === "center" ? rect.left + rect.width / 2 : rect.left;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[200]"
        aria-label="关闭"
        onClick={() => setOpen(false)}
      />
      <div
        className={className}
        style={{
          position: "fixed",
          left,
          top: rect.top - 6,
          transform:
            align === "center"
              ? "translate(-50%, -100%)"
              : "translateY(-100%)",
          zIndex: 201,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
