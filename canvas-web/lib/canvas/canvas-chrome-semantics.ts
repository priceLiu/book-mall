/**
 * 画布 / LibTV（分镜 1.0 · 专业 2.0）语义色
 * 标题白 · 状态橙 · 错误红 · 按钮样式另管
 */

export const CANVAS_SEMANTIC_TITLE_CLASS = "text-white";

export const CANVAS_SEMANTIC_STATUS_CLASS = "text-orange-300/90";

export const CANVAS_SEMANTIC_ERROR_CLASS = "text-red-400/90";

export const CANVAS_SEMANTIC_ERROR_SOFT_CLASS = "text-red-300/95";

const STATUS_BADGE_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]";

export const CANVAS_STATUS_BADGE_RUNNING_CLASS = `${STATUS_BADGE_BASE} bg-orange-500/20 text-orange-200`;

export const CANVAS_STATUS_BADGE_PENDING_CLASS = `${STATUS_BADGE_BASE} bg-orange-500/15 text-orange-200`;

export const CANVAS_STATUS_BADGE_DONE_CLASS = `${STATUS_BADGE_BASE} bg-orange-500/20 text-orange-200`;

export const CANVAS_STATUS_BADGE_IDLE_CLASS = `${STATUS_BADGE_BASE} bg-orange-500/15 text-orange-300/90`;

export const CANVAS_STATUS_BADGE_ERROR_CLASS = `${STATUS_BADGE_BASE} bg-red-500/20 text-red-200`;

/** 顶栏工具按钮（白字 · 中性描边，禁止彩色字） */
export const CANVAS_TOOLBAR_BTN_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/85 hover:border-white/30 hover:text-white";

/** 侧栏标题行 */
export const CANVAS_PANEL_HEADER_BORDER_CLASS = "border-white/10";
export const CANVAS_PANEL_HEADER_ICON_CLASS = "size-4 text-white/70";
export const CANVAS_PANEL_TITLE_CLASS = "text-sm font-medium text-white";

/** 侧栏 Tab */
export const CANVAS_PANEL_TAB_ACTIVE_CLASS = "bg-white/12 text-white";
export const CANVAS_PANEL_TAB_IDLE_CLASS = "text-white/55 hover:bg-white/8";

/** 侧栏列表项 */
export const CANVAS_PANEL_ITEM_TITLE_CLASS =
  "truncate text-[13px] font-medium text-white";
export const CANVAS_PANEL_ITEM_META_CLASS = "mt-0.5 text-[11px] text-white/55";
export const CANVAS_PANEL_ITEM_CARD_CLASS =
  "rounded-lg border border-white/10 bg-black/25 p-3";

/** 状态 Chip（成功/进行中 → 橙 · 失败 → 红） */
export const CANVAS_STATUS_CHIP_SUCCESS_CLASS =
  "text-orange-300 border-orange-400/30 bg-orange-500/10";
export const CANVAS_STATUS_CHIP_RUNNING_CLASS =
  "text-orange-300 border-orange-400/30 bg-orange-500/10";
export const CANVAS_STATUS_CHIP_ERROR_CLASS =
  "text-red-300 border-red-400/30 bg-red-500/10";
export const CANVAS_STATUS_CHIP_NEUTRAL_CLASS =
  "text-white/60 border-white/15 bg-white/5";

export const CANVAS_PANEL_SECONDARY_BTN_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-50";

