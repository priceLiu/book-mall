import { useEffect, type DragEventHandler } from "react";

/** 从剪贴板或拖放 DataTransfer 中取第一张图片文件 */
export function firstImageFileFromDataTransfer(
  dt: DataTransfer | null | undefined,
): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files)) {
    if (f.type.startsWith("image/")) return f;
  }
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) return f;
      }
    }
  }
  return null;
}

export function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('textarea, input, select, [contenteditable="true"]'),
  );
}

/** 图片拖入：阻止冒泡，避免触发画布全局 drop */
export function bindImageDragDropHandlers(
  onFile: (file: File) => void,
  options?: { disabled?: boolean },
): {
  onDragOver: DragEventHandler;
  onDragEnter: DragEventHandler;
  onDragLeave: DragEventHandler;
  onDrop: DragEventHandler;
} {
  return {
    onDragOver: (e) => {
      if (options?.disabled) return;
      if (!firstImageFileFromDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    onDragEnter: (e) => {
      if (options?.disabled) return;
      if (!firstImageFileFromDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    onDragLeave: (e) => {
      e.stopPropagation();
    },
    onDrop: (e) => {
      if (options?.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const file = firstImageFileFromDataTransfer(e.dataTransfer);
      if (file) onFile(file);
    },
  };
}

/**
 * 当 `active` 为 true 时，在 capture 阶段拦截全局 paste，
 * 避免画布根级 paste 新建图片节点。
 */
export function useImagePasteWhenActive(
  active: boolean,
  onFile: (file: File) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || !active) return;
    const onPaste = (e: ClipboardEvent) => {
      if (isEditablePasteTarget(e.target)) return;
      const file = firstImageFileFromDataTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onFile(file);
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  }, [active, enabled, onFile]);
}
