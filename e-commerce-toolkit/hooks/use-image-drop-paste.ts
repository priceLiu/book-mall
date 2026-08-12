"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FocusEvent } from "react";

import {
  extractImageFileFromClipboard,
  extractImageFilesFromClipboard,
  extractImageFilesFromDataTransfer,
  validateImageFile,
} from "@/lib/image-upload-utils";

type Options = {
  enabled?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
  onError?: (title: string, message: string) => void;
};

/**
 * 图片拖放 / 粘贴热区（对齐 QuickReplica QrImageUploadZone）：
 * 鼠标悬停、焦点在区内、或 activeElement 在区内时，Ctrl+V / ⌘V 可粘贴图片。
 */
export function useImageDropPaste({
  enabled = true,
  multiple = false,
  onFiles,
  onError,
}: Options) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

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
      if (accepted.length > 0) await onFilesRef.current(accepted);
    },
    [enabled, multiple, onError],
  );

  const isPasteTargetActive = useCallback(() => {
    const zone = zoneRef.current;
    if (!zone) return false;
    const active = document.activeElement;
    return (
      hovered || focused || (active != null && zone.contains(active as Node))
    );
  }, [hovered, focused]);

  useEffect(() => {
    if (!enabled) return;

    function onPaste(e: ClipboardEvent) {
      if (!isPasteTargetActive()) return;

      const files = extractImageFilesFromClipboard(e);
      const file =
        files[0] ??
        (e.clipboardData ? extractImageFileFromClipboard(e.clipboardData) : null);
      const batch = files.length > 0 ? files : file ? [file] : [];
      if (batch.length === 0) return;

      e.preventDefault();
      void ingestFiles(multiple ? batch : batch.slice(0, 1));
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [enabled, ingestFiles, isPasteTargetActive, multiple]);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    [enabled],
  );

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!zoneRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
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

  const focusZone = useCallback(() => {
    zoneRef.current?.focus({ preventScroll: true });
  }, []);

  return {
    zoneRef,
    dragOver,
    pasteReady: hovered || focused,
    focusZone,
    dropZoneProps: {
      ref: zoneRef,
      tabIndex: enabled ? 0 : undefined,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: (e: FocusEvent<HTMLDivElement>) => {
        if (!zoneRef.current?.contains(e.relatedTarget as Node)) {
          setFocused(false);
        }
      },
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}
