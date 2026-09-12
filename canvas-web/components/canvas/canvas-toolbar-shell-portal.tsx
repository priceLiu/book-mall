"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** 画布顶栏壳 · portal 到 body，避免被 z-[200+] 全屏遮罩挡住点击 */
export function CanvasToolbarShellPortal({
  shellRef,
  className,
  children,
}: {
  shellRef: RefObject<HTMLDivElement>;
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const shell = (
    <div
      ref={shellRef}
      data-canvas-toolbar-shell
      className={cn("pointer-events-auto", className)}
    >
      {children}
    </div>
  );

  if (!mounted) return shell;

  return createPortal(shell, document.body);
}
