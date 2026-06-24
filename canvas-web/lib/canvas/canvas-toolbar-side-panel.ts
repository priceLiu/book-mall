import { cn } from "@/lib/utils";

/** 画布顶栏右侧菜单弹层：略宽，便于缩略图与列表 */
export const CANVAS_TOOLBAR_SIDE_PANEL_WIDTH_CLASS =
  "w-[min(42vw,720px)] min-w-[380px] max-w-[92vw]";

/** 低于顶栏 z-[300]，遮罩与面板从顶栏下缘开始，不盖住菜单 */
export const CANVAS_TOOLBAR_SIDE_PANEL_Z_CLASS = "z-[280]";

export const CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS =
  "fixed bottom-0 left-0 right-0 top-[var(--canvas-toolbar-height,3rem)] flex justify-end bg-black/45";

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
