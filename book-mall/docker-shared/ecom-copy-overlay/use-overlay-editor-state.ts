"use client";

import { useEffect, useMemo, useState } from "react";

import type { EcomCopyOverlay } from "./types";
import { resolveOverlayForEditor, syncOverlayMainLayerText } from "./defaults";

export type UseEcomCopyOverlayEditorStateOpts = {
  open: boolean;
  initialText: string;
  overlayProp?: EcomCopyOverlay | null;
  exportWidthPx: number;
  baseImageUrl?: string | null;
  /** 可选：同步第二路文案（如出图 prompt） */
  initialPrompt?: string;
};

export function useEcomCopyOverlayEditorState(opts: UseEcomCopyOverlayEditorStateOpts) {
  const { open, initialText, overlayProp, exportWidthPx, baseImageUrl, initialPrompt = "" } =
    opts;

  const [text, setText] = useState(initialText);
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
    setText(initialText);
    setPrompt(initialPrompt);
    setOverlay(
      resolveOverlayForEditor({
        overlay: overlayProp,
        text: initialText,
        exportWidthPx,
        baseImageUrl: baseImageUrl ?? undefined,
      }),
    );
    setSelectedLayerId("main");
  }, [open, initialText, initialPrompt, overlayProp, exportWidthPx, baseImageUrl]);

  useEffect(() => {
    if (!open) return;
    setOverlay((prev) => syncOverlayMainLayerText(prev, text));
  }, [text, open]);

  const layoutExtras = useMemo(
    () => ({
      slotCopy: text.trim(),
      copyOverlay: overlay,
      burnCopyInImage: false as const,
    }),
    [text, overlay],
  );

  return {
    text,
    setText,
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
