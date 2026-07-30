"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";

import {
  extractImageFileFromClipboard,
  extractImageFilesFromDataTransfer,
  validateImageFile,
} from "@/lib/image-upload-utils";

type Options = {
  enabled?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
  onError?: (title: string, message: string) => void;
};

export function useImageDropPaste({
  enabled = true,
  multiple = false,
  onFiles,
  onError,
}: Options) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteActive, setPasteActive] = useState(false);

  const ingestFiles = useCallback(
    async (raw: File[]) => {
      if (!enabled || raw.length === 0) return;
      const accepted: File[] = [];
      for (const file of raw) {
        const err = validateImageFile(file);
        if (err) {
          onError?.(err.title, err.message);
          continue;
        }
        accepted.push(file);
        if (!multiple) break;
      }
      if (accepted.length > 0) await onFiles(accepted);
    },
    [enabled, multiple, onFiles, onError],
  );

  useEffect(() => {
    if (!enabled || !pasteActive) return;

    function onPaste(e: ClipboardEvent) {
      const file = extractImageFileFromClipboard(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      void ingestFiles([file]);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enabled, pasteActive, ingestFiles]);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
      setPasteActive(true);
    },
    [enabled],
  );

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      void ingestFiles(extractImageFilesFromDataTransfer(e.dataTransfer));
    },
    [enabled, ingestFiles],
  );

  const bindPasteTarget = useCallback(() => {
    setPasteActive(true);
  }, []);

  const unbindPasteTarget = useCallback(() => {
    setPasteActive(false);
    setDragOver(false);
  }, []);

  return {
    dragOver,
    pasteActive,
    dropZoneProps: {
      onDragOver,
      onDragLeave,
      onDrop,
      onMouseEnter: bindPasteTarget,
      onMouseLeave: unbindPasteTarget,
      onFocus: bindPasteTarget,
      onBlur: unbindPasteTarget,
    },
  };
}
