"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** 弹层 scroll lock 引用计数 · 避免多弹层 / effect 重跑时 overflow 来回切换 */
let modalScrollLockCount = 0;
let savedBodyOverflow = "";
let savedHtmlOverflow = "";

function applyModalScrollLock(): void {
  modalScrollLockCount += 1;
  if (modalScrollLockCount !== 1) return;
  savedBodyOverflow = document.body.style.overflow;
  savedHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.documentElement.dataset.canvasModalOpen = "true";
}

function releaseModalScrollLock(): void {
  if (modalScrollLockCount <= 0) return;
  modalScrollLockCount -= 1;
  if (modalScrollLockCount !== 0) return;
  document.body.style.overflow = savedBodyOverflow;
  document.documentElement.style.overflow = savedHtmlOverflow;
  delete document.documentElement.dataset.canvasModalOpen;
}

/** Portal 挂载后再 createPortal，避免 SSR/hydration 问题 */
export function useClientPortalMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * 弹层打开期间锁定 body 滚动，并标记 `data-canvas-modal-open` 暂停画布指针事件。
 * 仅依赖 `active`，避免父组件每帧传入新 `onClose` 导致 overflow 反复切换 → 整页闪烁/抖动。
 */
export function useModalBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    applyModalScrollLock();
    return releaseModalScrollLock;
  }, [active]);
}

/** Escape 关闭；handler 经 ref 读取，不进入 effect 依赖 */
export function useModalEscapeClose(
  onClose: () => void,
  options?: { capture?: boolean; active?: boolean },
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const capture = options?.capture ?? false;
  const active = options?.active ?? true;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (capture) e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey, capture);
    return () => window.removeEventListener("keydown", onKey, capture);
  }, [capture, active]);
}

/** 对比弹层 ← / →；handler 经 ref，避免 stepRight 换引用导致 effect 重跑 */
export function useModalCompareArrowKeys(
  active: boolean,
  stepRight: (delta: number) => void,
): void {
  const stepRef = useRef(stepRight);
  stepRef.current = stepRight;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepRef.current(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepRef.current(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
