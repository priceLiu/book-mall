import { useEffect } from "react";

import { handleLibtvDockWheelScroll } from "@/lib/canvas/canvas-form-wheel";

/** 原生 wheel（passive: false）· Dock 正文区滚轮滚动 */
export function useLibtvDockWheelScroll(element: HTMLElement | null): void {
  useEffect(() => {
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      handleLibtvDockWheelScroll(e);
    };
    element.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [element]);
}
