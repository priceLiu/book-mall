"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS,
  CANVAS_TOOLBAR_SIDE_PANEL_Z_CLASS,
  canvasToolbarSidePanelAsideClass,
} from "@/lib/canvas/canvas-toolbar-side-panel";

export function CanvasToolbarSidePanelShell({
  open,
  onClose,
  ariaLabel,
  borderClass = "border-l border-white/10",
  zIndexClass = CANVAS_TOOLBAR_SIDE_PANEL_Z_CLASS,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  borderClass?: string;
  zIndexClass?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted || !open) return null;

  return (
    <div
      className={`${CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS} ${zIndexClass} canvas-toolbar-side-panel-overlay-enter`}
      onClick={onClose}
      role="presentation"
    >
      <aside
        className={canvasToolbarSidePanelAsideClass(
          borderClass,
          "canvas-toolbar-side-panel-aside-enter",
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={ariaLabel}
      >
        {children}
      </aside>
    </div>
  );
}
