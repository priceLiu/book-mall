"use client";

import { useEffect, useMemo, useState } from "react";

import type { EcomCopyOverlay } from "./types";
import { resolveOverlayForEditor } from "./defaults";
import { primarySlotCopyFromOverlay } from "./layer-ops";

export type UseEcomCopyOverlayEditorStateOpts = {
  open: boolean;
  initialText: string;
  overlayProp?: EcomCopyOverlay | null;
  exportWidthPx: number;
  baseImageUrl?: string | null;
  initialPrompt?: string;
};

export function useEcomCopyOverlayEditorState(opts: UseEcomCopyOverlayEditorStateOpts) {
  const { open, initialText, overlayProp, exportWidthPx, baseImageUrl, initialPrompt = "" } =
    opts;

  const [prompt, setPrompt] = useState(initialPrompt);
  const [overlay, setOverlay] = useState<EcomCopyOverlay>(() =>
    resolveOverlayForEditor({
      overlay: overlayProp,
      text: initialText,
      exportWidthPx,
      baseImageUrl: baseImageUrl ?? undefined,
    }),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("main");

  const selectedLayer = overlay.layers.find((l) => l.id === selectedLayerId) ?? overlay.layers[0];

  useEffect(() => {
    if (!open) return;
    const next = resolveOverlayForEditor({
      overlay: overlayProp,
      text: initialText,
      exportWidthPx,
      baseImageUrl: baseImageUrl ?? undefined,
    });
    setPrompt(initialPrompt);
    setOverlay(next);
    setSelectedLayerId(next.layers[0]?.id ?? "main");
  }, [open, initialText, initialPrompt, overlayProp, exportWidthPx, baseImageUrl]);

  const layoutExtras = useMemo(
    () => ({
      slotCopy: primarySlotCopyFromOverlay(overlay),
      copyOverlay: overlay,
      burnCopyInImage: false as const,
    }),
    [overlay],
  );

  return {
    prompt,
    setPrompt,
    overlay,
    setOverlay,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayer,
    layoutExtras,
  };
}
