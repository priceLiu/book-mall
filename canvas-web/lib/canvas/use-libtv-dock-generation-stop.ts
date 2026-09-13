"use client";

import { useCallback } from "react";
import type { CanvasCancelGenerationJob } from "./canvas-run-bus";
import { useCanvasGenerationCancel } from "./use-canvas-generation-cancel";

/** Dock 生成钮 · 中止（二次确认 + busCancel） */
export function useLibtvDockGenerationStop(
  nodeId: string | null | undefined,
  scope?: Omit<CanvasCancelGenerationJob, "nodeId">,
) {
  const { requestCancel } = useCanvasGenerationCancel(nodeId ?? "", scope);
  return useCallback(() => void requestCancel(), [requestCancel]);
}
