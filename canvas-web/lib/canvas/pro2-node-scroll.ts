import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";

/** 指针是否落在原生滚动条轨道/滑块区域（用于临时 nodrag，避免与节点拖拽冲突） */
export function isPro2NodeScrollbarPointer(
  el: HTMLElement,
  clientX: number,
): boolean {
  const scrollbarW = Math.max(0, el.offsetWidth - el.clientWidth);
  if (scrollbarW < 1) return false;
  const rect = el.getBoundingClientRect();
  return clientX >= rect.right - scrollbarW - 1;
}

export function armPro2NodeScrollDragGuard(el: HTMLElement, clientX: number): void {
  if (isPro2NodeScrollbarPointer(el, clientX)) {
    el.classList.add(RF_NO_DRAG);
  }
}

export function disarmPro2NodeScrollDragGuard(el: HTMLElement): void {
  el.classList.remove(RF_NO_DRAG);
}
