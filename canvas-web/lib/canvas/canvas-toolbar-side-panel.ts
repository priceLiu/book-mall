import { cn } from "@/lib/utils";

/** 画布顶栏右侧菜单弹层：与「我的提示词」对齐（约 1/4 屏宽） */
export const CANVAS_TOOLBAR_SIDE_PANEL_WIDTH_CLASS =
  "w-[25vw] min-w-[320px] max-w-[50vw]";

export const CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS =
  "fixed inset-0 flex justify-end bg-black/45";

export const CANVAS_TOOLBAR_SIDE_PANEL_ASIDE_BASE_CLASS =
  "flex h-full flex-col bg-[var(--canvas-surface)] text-white shadow-2xl";

export const CANVAS_TOOLBAR_SIDE_PANEL_PAGE_SIZE = 20;

export function canvasToolbarSidePanelAsideClass(
  borderClass: string,
  extra?: string,
): string {
  return cn(
    CANVAS_TOOLBAR_SIDE_PANEL_ASIDE_BASE_CLASS,
    CANVAS_TOOLBAR_SIDE_PANEL_WIDTH_CLASS,
    borderClass,
    extra,
  );
}
