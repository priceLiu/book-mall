"use client";

import { Loader2 } from "lucide-react";

import {
  CANVAS_PANEL_SHELL_LOADING_CLASS,
  CANVAS_PANEL_SHELL_LOADING_MORE_CLASS,
  CANVAS_PANEL_SHELL_LOADING_SPINNER_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import { cn } from "@/lib/utils";

export function CanvasPanelShellLoading({
  label = "加载中…",
}: {
  label?: string;
}) {
  return (
    <div className={CANVAS_PANEL_SHELL_LOADING_CLASS}>
      <Loader2
        className={cn("size-4", CANVAS_PANEL_SHELL_LOADING_SPINNER_CLASS)}
        aria-hidden
      />
      {label}
    </div>
  );
}

export function CanvasPanelShellLoadingMore({
  label = "加载更多…",
}: {
  label?: string;
}) {
  return (
    <div className={CANVAS_PANEL_SHELL_LOADING_MORE_CLASS}>
      <Loader2
        className={cn("size-3.5", CANVAS_PANEL_SHELL_LOADING_SPINNER_CLASS)}
        aria-hidden
      />
      {label}
    </div>
  );
}
