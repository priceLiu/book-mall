import {
  LIBTV_DOCK_SCROLL_SELECTOR,
  LIBTV_INPUT_DOCK_SELECTOR,
} from "@/lib/canvas/canvas-form-wheel";
import { getTextareaCaretClientRect } from "@/lib/canvas/textarea-caret-rect";

/** Dock 正文滚动容器（textarea 自动增高，滚动条在此） */
export function findLibtvDockScrollEl(
  textarea: HTMLTextAreaElement,
): HTMLElement | null {
  return textarea.closest(LIBTV_DOCK_SCROLL_SELECTOR) as HTMLElement | null;
}

export function isLibtvDockTextarea(textarea: HTMLTextAreaElement): boolean {
  return !!textarea.closest(LIBTV_INPUT_DOCK_SELECTOR);
}

/**
 * 自动增高 textarea，并尽量保持 `.pro2-dock-scroll` 的 scrollTop 不变。
 * 不重置 height 为 0/auto，避免父级滚动条因内容塌缩而跳动。
 */
export function syncTextareaAutoHeight(textarea: HTMLTextAreaElement): void {
  const dockScroll = findLibtvDockScrollEl(textarea);
  const savedScrollTop = dockScroll?.scrollTop ?? null;

  const nextHeight = textarea.scrollHeight;
  if (Math.abs(nextHeight - textarea.offsetHeight) > 0.5) {
    textarea.style.height = `${nextHeight}px`;
  }

  if (dockScroll != null && savedScrollTop != null) {
    dockScroll.scrollTop = savedScrollTop;
    const maxScroll = Math.max(0, dockScroll.scrollHeight - dockScroll.clientHeight);
    if (dockScroll.scrollTop > maxScroll) {
      dockScroll.scrollTop = maxScroll;
    }
  }
}

/** 抵消浏览器 focus 后的 scrollIntoView，连写两帧 scrollTop */
export function restoreDockScrollTop(dockScroll: HTMLElement, scrollTop: number): void {
  const apply = () => {
    dockScroll.scrollTop = scrollTop;
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

/** 将光标滚入 Dock 可视区（最小位移；Tab 聚焦等无 pointer 场景） */
export function scrollDockToShowCaret(
  textarea: HTMLTextAreaElement,
  position?: number,
  padding = 12,
): void {
  const dockScroll = findLibtvDockScrollEl(textarea);
  if (!dockScroll) return;

  const pos = position ?? textarea.selectionStart ?? 0;
  const caret = getTextareaCaretClientRect(textarea, pos);
  if (!caret) return;

  const view = dockScroll.getBoundingClientRect();
  let delta = 0;

  if (caret.top < view.top + padding) {
    delta = caret.top - (view.top + padding);
  } else if (caret.bottom > view.bottom - padding) {
    delta = caret.bottom - (view.bottom - padding);
  }

  if (Math.abs(delta) > 0.5) {
    dockScroll.scrollTop += delta;
  }
}
