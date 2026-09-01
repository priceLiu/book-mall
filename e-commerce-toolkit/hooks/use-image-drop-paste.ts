"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FocusEvent } from "react";

import {
  extractImageFileFromClipboard,
  extractMediaFilesFromClipboard,
  extractMediaFilesFromDataTransfer,
  normalizePastedImageFile,
  validateImageFile,
  validateImageOrVideoFile,
  type ImageUploadError,
} from "@/lib/image-upload-utils";

type Options = {
  enabled?: boolean;
  multiple?: boolean;
  /** 监听 document paste；多热区并存时可由父级统一处理 */
  listenPaste?: boolean;
  /** 同时接受拖放 / 粘贴的视频文件（拆图拆视频） */
  allowVideo?: boolean;
  onFiles: (files: File[], via?: "paste" | "drop") => void | Promise<void>;
  onError?: (title: string, message: string) => void;
};

/**
 * 图片拖放 / 粘贴热区（对齐 QuickReplica QrImageUploadZone）：
 * 鼠标悬停、焦点在区内、或 activeElement 在区内时，Ctrl+V / ⌘V 可粘贴图片。
 */
export function useImageDropPaste({
  enabled = true,
  multiple = false,
  listenPaste = true,
  allowVideo = false,
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
    async (raw: File[], via?: "paste" | "drop") => {
      if (!enabled || raw.length === 0) return;
      const accepted: File[] = [];
      const validate: (file: File) => ImageUploadError | null = allowVideo
        ? validateImageOrVideoFile
        : validateImageFile;
      for (const file of raw) {
        const candidate =
          allowVideo && file.type.startsWith("video/") ? file : normalizePastedImageFile(file);
        const err = validate(candidate);
        if (err) {
          onError?.(err.title, err.message);
          continue;
        }
        accepted.push(candidate);
        if (!multiple) break;
      }
      if (accepted.length > 0) await onFilesRef.current(accepted, via);
    },
    [allowVideo, enabled, multiple, onError],
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
    if (!enabled || !listenPaste) return;

    function onPaste(e: ClipboardEvent) {
      if (!isPasteTargetActive()) return;

      const files = extractMediaFilesFromClipboard(e, { allowVideo });
      const file =
        files[0] ??
        (e.clipboardData && !allowVideo
          ? extractImageFileFromClipboard(e.clipboardData)
          : null);
      const batch = files.length > 0 ? files : file ? [file] : [];
      if (batch.length === 0) return;

      e.preventDefault();
      void ingestFiles(multiple ? batch : batch.slice(0, 1), "paste");
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [allowVideo, enabled, ingestFiles, isPasteTargetActive, listenPaste, multiple]);

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
      void ingestFiles(extractMediaFilesFromDataTransfer(e.dataTransfer, { allowVideo }), "drop");
    },
    [allowVideo, enabled, ingestFiles],
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
