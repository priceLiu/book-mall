import { useEffect, useRef, type DragEventHandler } from "react";

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

type ImagePasteTarget = {
  gen: number;
  onFile: (file: File) => void;
};

const imagePasteTargets = new Map<string, ImagePasteTarget>();
let imagePasteGen = 0;
let imagePasteRouterInstalled = false;

function pickImagePasteTarget(): ImagePasteTarget | null {
  let best: ImagePasteTarget | null = null;
  for (const entry of imagePasteTargets.values()) {
    if (!best || entry.gen > best.gen) best = entry;
  }
  return best;
}

function ensureImagePasteRouter() {
  if (imagePasteRouterInstalled) return;
  imagePasteRouterInstalled = true;
  window.addEventListener(
    "paste",
    (e) => {
      const target = pickImagePasteTarget();
      if (!target) return;
      if (isEditablePasteTarget(e.target)) return;
      const file = firstImageFileFromDataTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      target.onFile(file);
    },
    true,
  );
}

/** 悬停槽位时激活粘贴目标；多槽同时激活时以最近一次 activate 为准。 */
export function activateImagePasteTarget(
  id: string,
  onFile: (file: File) => void,
) {
  ensureImagePasteRouter();
  imagePasteTargets.set(id, { gen: ++imagePasteGen, onFile });
}

export function deactivateImagePasteTarget(id: string) {
  imagePasteTargets.delete(id);
}

/** 确保全局 paste 路由已安装（资产槽等按需调用一次）。 */
export function useImagePasteRouter() {
  useEffect(() => {
    ensureImagePasteRouter();
  }, []);
}

/**
 * 当 `active` 为 true 时注册粘贴目标，走全局单例路由，
 * 避免多个槽位各自监听 paste 时互相抢占。
 */
export function useImagePasteWhenActive(
  active: boolean,
  onFile: (file: File) => void,
  enabled = true,
  targetId?: string,
) {
  const autoIdRef = useRef(
    `paste-${Math.random().toString(36).slice(2, 10)}`,
  );
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const id = targetId ?? autoIdRef.current;

  useEffect(() => {
    if (!enabled || !active) {
      deactivateImagePasteTarget(id);
      return;
    }
    activateImagePasteTarget(id, (file) => onFileRef.current(file));
    return () => deactivateImagePasteTarget(id);
  }, [active, enabled, id]);
}
