import { useEffect, useRef, type DragEventHandler } from "react";

import { normalizeCanvasImageFile } from "@/lib/canvas/normalize-canvas-image-file";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

const CLIPBOARD_IMAGE_TYPES = new Set([
  "public.png",
  "public.jpeg",
  "public.tiff",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/x-png",
]);

function isImageClipboardItemType(type: string): boolean {
  const t = type.toLowerCase();
  if (t.startsWith("image/")) {
    return t !== "image/svg+xml";
  }
  return CLIPBOARD_IMAGE_TYPES.has(t);
}

function isClipboardImageFile(file: File): boolean {
  if (file.size <= 0) return false;
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    return true;
  }
  if (!file.type && IMAGE_EXT.test(file.name)) return true;
  /** Windows 截图/部分浏览器粘贴：type 为空但仍是有效位图 */
  if (!file.type && file.size > 0) return true;
  return false;
}

/** 从剪贴板或拖放 DataTransfer 中取全部图片文件 */
export function allImageFilesFromDataTransfer(
  dt: DataTransfer | null | undefined,
): File[] {
  if (!dt) return [];
  const out: File[] = [];
  const seen = new Set<string>();
  const push = (f: File | null) => {
    if (!f || !isClipboardImageFile(f)) return;
    const key = `${f.size}:${f.lastModified}:${f.type || "unknown"}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };
  const fromFiles = Array.from(dt.files).filter(isClipboardImageFile);
  if (fromFiles.length > 0) {
    for (const f of fromFiles) push(f);
    return out;
  }
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== "file") continue;
      const type = item.type ?? "";
      if (!isImageClipboardItemType(type) && type !== "") continue;
      push(item.getAsFile());
    }
  }
  return out;
}

/** 剪贴板图片（含 URL 回落）；规范化后供上传/预览 */
export async function resolveClipboardImageFiles(
  dt: DataTransfer | null | undefined,
): Promise<File[]> {
  const direct = allImageFilesFromDataTransfer(dt);
  if (direct.length) {
    return Promise.all(direct.map((f) => normalizeCanvasImageFile(f)));
  }
  const urlFile = await imageFileFromClipboardUrl(dt);
  if (!urlFile) return [];
  return [await normalizeCanvasImageFile(urlFile)];
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
      if (!isImageClipboardItemType(type) && type !== "") continue;
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

/** 输入坞参考图/粘贴区；图片节点走 data-image-paste-host + pickPointerImagePasteHandler */
const IMAGE_PASTE_SLOT_SELECTOR =
  ".pro2-dock-ref-zone, .pro2-dock-paste-zone";

let lastPointerClient = { x: 0, y: 0 };
let pointerTrackerInstalled = false;

function ensurePointerTracker() {
  if (pointerTrackerInstalled) return;
  pointerTrackerInstalled = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      lastPointerClient = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
  window.addEventListener(
    "pointerdown",
    (e) => {
      lastPointerClient = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
}

/** 粘贴落点：视口坐标 → 用于空白画布落节点 */
export function getLastPointerClient(): { x: number; y: number } {
  return lastPointerClient;
}

function elementAtPointer(): Element | null {
  if (typeof document === "undefined") return null;
  return document.elementFromPoint(
    lastPointerClient.x,
    lastPointerClient.y,
  );
}

/** 事件目标或当前鼠标位置是否在资产槽内 */
export function isImagePasteSlotTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLElement) {
    if (target.closest(IMAGE_PASTE_SLOT_SELECTOR)) return true;
  }
  const atPointer = elementAtPointer();
  return Boolean(atPointer?.closest(IMAGE_PASTE_SLOT_SELECTOR));
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
  /** 单图（图片节点悬停） */
  onFile?: (file: File) => void;
  /** 多图（Dock 等） */
  onFiles?: (files: File[]) => void;
  /** global：整页粘贴；zone：须在参考图区域或鼠标在该区域内 */
  mode: "global" | "zone";
};

const imagePasteTargets = new Map<string, ImagePasteTarget>();
let imagePasteGen = 0;

const pointerImagePasteHandlers = new Map<string, (file: File) => void>();

export function registerPointerImagePasteHost(
  nodeId: string,
  onFile: (file: File) => void,
) {
  ensurePointerTracker();
  pointerImagePasteHandlers.set(nodeId, onFile);
}

export function unregisterPointerImagePasteHost(nodeId: string) {
  pointerImagePasteHandlers.delete(nodeId);
}

/** 当前鼠标是否在图片节点粘贴宿主上 */
export function isPointerOverImagePasteHost(): boolean {
  ensurePointerTracker();
  return Boolean(
    elementAtPointer()?.closest("[data-image-paste-host]"),
  );
}

/** 鼠标当前位置下的图片节点粘贴处理器（优先于空白画布新建） */
export function pickPointerImagePasteHandler(): ((file: File) => void) | null {
  ensurePointerTracker();
  const host = elementAtPointer()?.closest(
    "[data-image-paste-host]",
  ) as HTMLElement | null;
  if (!host) return null;
  const nodeId = host.dataset.imagePasteHost;
  if (!nodeId) return null;
  return pointerImagePasteHandlers.get(nodeId) ?? null;
}

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
  const files = await resolveClipboardImageFiles(dt);
  return files[0] ?? null;
}

function activePasteTargetRequiresZone(target: ImagePasteTarget): boolean {
  return target.mode === "zone";
}

function deliverFilesToPasteTarget(
  target: ImagePasteTarget,
  files: File[],
): boolean {
  if (!files.length) return false;
  if (target.onFiles) {
    target.onFiles(files);
    return true;
  }
  if (target.onFile) {
    target.onFile(files[0]!);
    return true;
  }
  return false;
}

/** 剪贴板图片是否应写入当前悬停的资产槽（供画布全局 paste 让路） */
export async function routeClipboardImageToActivePasteSlot(
  dt: DataTransfer | null | undefined,
  eventTarget?: EventTarget | null,
): Promise<boolean> {
  if (isPointerOverImagePasteHost()) return false;
  const target = pickImagePasteTarget();
  if (!target) return false;
  if (
    activePasteTargetRequiresZone(target) &&
    !isImagePasteSlotTarget(eventTarget ?? null)
  ) {
    return false;
  }
  const files = allImageFilesFromDataTransfer(dt);
  if (files.length) {
    const normalized = await Promise.all(
      files.map((f) => normalizeCanvasImageFile(f)),
    );
    return deliverFilesToPasteTarget(target, normalized);
  }
  const file = await resolveClipboardImageFile(dt);
  if (!file) return false;
  return deliverFilesToPasteTarget(target, [file]);
}

/** 悬停槽位时激活粘贴目标；多槽同时激活时以最近一次 activate 为准。 */
export function activateImagePasteTarget(
  id: string,
  handlers: {
    onFile?: (file: File) => void;
    onFiles?: (files: File[]) => void;
  },
  mode: "global" | "zone" = "zone",
) {
  imagePasteTargets.set(id, {
    gen: ++imagePasteGen,
    onFile: handlers.onFile,
    onFiles: handlers.onFiles,
    mode,
  });
}

export function deactivateImagePasteTarget(id: string) {
  imagePasteTargets.delete(id);
}

/** 兼容旧调用：仅确保指针追踪已安装 */
export function useImagePasteRouter() {
  useEffect(() => {
    ensurePointerTracker();
  }, []);
}

/**
 * 资产槽（Dock 参考图等）粘贴：须在槽位内或鼠标在槽位上。
 */
export function useImagePasteWhenActive(
  active: boolean,
  handlers: {
    onFile?: (file: File) => void;
    onFiles?: (files: File[]) => void;
  },
  enabled = true,
  targetId?: string,
  mode: "global" | "zone" = "zone",
) {
  const autoIdRef = useRef(
    `paste-${Math.random().toString(36).slice(2, 10)}`,
  );
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const id = targetId ?? autoIdRef.current;

  useEffect(() => {
    if (!enabled || !active) {
      deactivateImagePasteTarget(id);
      return;
    }
    activateImagePasteTarget(
      id,
      {
        onFile: handlersRef.current.onFile
          ? (file) => handlersRef.current.onFile?.(file)
          : undefined,
        onFiles: handlersRef.current.onFiles
          ? (files) => handlersRef.current.onFiles?.(files)
          : undefined,
      },
      mode,
    );
    return () => deactivateImagePasteTarget(id);
  }, [active, enabled, id, mode]);
}

/**
 * 图片节点：鼠标在节点上时 Ctrl+V 写入该节点（由 flow-canvas 统一 paste 调度）。
 */
export function usePointerImagePasteHost(
  active: boolean,
  nodeId: string,
  onFile: (file: File) => void,
) {
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    if (!active) {
      unregisterPointerImagePasteHost(nodeId);
      return;
    }
    registerPointerImagePasteHost(nodeId, (file) =>
      onFileRef.current(file),
    );
    return () => unregisterPointerImagePasteHost(nodeId);
  }, [active, nodeId]);
}
