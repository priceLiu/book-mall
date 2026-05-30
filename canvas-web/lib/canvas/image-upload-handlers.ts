import { useEffect, useRef, type DragEventHandler } from "react";

function isClipboardImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (!file.type && /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return true;
  return false;
}

/** 从剪贴板或拖放 DataTransfer 中取第一张图片文件 */
export function firstImageFileFromDataTransfer(
  dt: DataTransfer | null | undefined,
): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files)) {
    if (isClipboardImageFile(f)) return f;
  }
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== "file") continue;
      const type = item.type ?? "";
      if (!type.startsWith("image/") && type !== "public.png" && type !== "public.jpeg") {
        continue;
      }
      const f = item.getAsFile();
      if (f && isClipboardImageFile(f)) return f;
    }
  }
  return null;
}

/** 剪贴板仅有图片 URL（复制链接）时的回落 */
export async function imageFileFromClipboardUrl(
  dt: DataTransfer | null | undefined,
): Promise<File | null> {
  if (!dt) return null;
  const plain = dt.getData("text/plain")?.trim() ?? "";
  const html = dt.getData("text/html") ?? "";
  const fromHtml = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const candidate = fromHtml?.trim() || plain;
  if (!candidate || !/^https?:\/\//i.test(candidate)) return null;
  try {
    const res = await fetch(candidate);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return new File([blob], "pasted-image", { type: blob.type });
  } catch {
    return null;
  }
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
  for (const entry of Array.from(imagePasteTargets.values())) {
    if (!best || entry.gen > best.gen) best = entry;
  }
  return best;
}

async function resolveClipboardImageFile(
  dt: DataTransfer | null | undefined,
): Promise<File | null> {
  const direct = firstImageFileFromDataTransfer(dt);
  if (direct) return direct;
  return imageFileFromClipboardUrl(dt);
}

/** 剪贴板图片是否应写入当前悬停的资产槽（供画布全局 paste 让路） */
export async function routeClipboardImageToActivePasteSlot(
  dt: DataTransfer | null | undefined,
): Promise<boolean> {
  const target = pickImagePasteTarget();
  if (!target) return false;
  const file = await resolveClipboardImageFile(dt);
  if (!file) return false;
  target.onFile(file);
  return true;
}

function ensureImagePasteRouter() {
  if (imagePasteRouterInstalled) return;
  imagePasteRouterInstalled = true;
  window.addEventListener(
    "paste",
    (e) => {
      const target = pickImagePasteTarget();
      if (!target) return;
      const direct = firstImageFileFromDataTransfer(e.clipboardData);
      if (direct) {
        e.preventDefault();
        e.stopImmediatePropagation();
        target.onFile(direct);
        return;
      }
      const html = e.clipboardData?.getData("text/html") ?? "";
      const plain = e.clipboardData?.getData("text/plain")?.trim() ?? "";
      const maybeUrl =
        html.includes("<img") || /^https?:\/\//i.test(plain);
      if (!maybeUrl) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void resolveClipboardImageFile(e.clipboardData).then((file) => {
        if (file) target.onFile(file);
      });
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
