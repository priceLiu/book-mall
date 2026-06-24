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

/** Gateway 控制台主按钮色（gateway-web --gw-btn-primary-*） */
export const CANVAS_GATEWAY_BTN_BG = "#238636";
export const CANVAS_GATEWAY_BTN_HOVER = "#2ea043";

/** 实心主 CTA（运行全部、弹层确认、组工具栏确定等） */
export const CANVAS_PRIMARY_BTN_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[var(--canvas-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

/** 顶栏 / 浮动工具条小号主按钮（与 CANVAS_TOOLBAR_BTN_CLASS 同高同字号） */
export const CANVAS_PRIMARY_BTN_SM_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-transparent bg-[var(--canvas-accent)] px-2 py-1 text-[11px] font-medium text-white transition hover:bg-[var(--canvas-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

/** 顶栏工具按钮（白字 · 中性描边，禁止彩色字） */
export const CANVAS_TOOLBAR_BTN_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/85 hover:border-white/30 hover:text-white";

/** 侧栏标题行 */
export const CANVAS_PANEL_HEADER_BORDER_CLASS = "border-white/10";
export const CANVAS_PANEL_HEADER_ICON_CLASS = "size-4 text-white/70";
export const CANVAS_PANEL_TITLE_CLASS = "text-sm font-medium text-white";

/** 侧栏 Tab */
export const CANVAS_PANEL_TAB_ACTIVE_CLASS = "bg-black/40 text-white";
export const CANVAS_PANEL_TAB_IDLE_CLASS = "text-white/55 hover:bg-black/25";

/** 顶栏右侧侧栏 · 与「我的视频库」对齐（弱描边 + black/25 内容块） */
export const CANVAS_PANEL_SHELL_HEADER_CLASS =
  "flex items-center justify-between border-b border-white/10 px-4 py-3";
export const CANVAS_PANEL_SHELL_TABS_ROW_CLASS = "flex gap-1 px-3 py-2";
export const CANVAS_PANEL_SHELL_BODY_CLASS = "min-h-0 flex-1 overflow-y-auto p-3";
export const CANVAS_PANEL_SHELL_FOOTER_CLASS =
  "border-t border-white/10 px-4 py-3";
export const CANVAS_PANEL_SHELL_SETTINGS_BLOCK_CLASS = "px-4 py-3";
export const CANVAS_PANEL_SHELL_SELECT_CLASS =
  "nodrag w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white focus:border-white/15 focus:outline-none";
export const CANVAS_PANEL_SHELL_LIST_ITEM_CLASS =
  "flex gap-3 rounded-lg border border-white/10 bg-black/25 p-2";
export const CANVAS_PANEL_SHELL_THUMB_CLASS =
  "relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50";
export const CANVAS_PANEL_SHELL_THUMB_LG_CLASS =
  "relative size-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50";
export const CANVAS_PANEL_SHELL_THUMB_SM_CLASS =
  "flex size-14 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/50";
export const CANVAS_PANEL_SHELL_EMPTY_CLASS =
  "py-12 text-center text-[12px] text-white/45";
/** 侧栏首屏加载（居中 · 文案白/45 · spinner 走 CANVAS_SEMANTIC_STATUS_CLASS） */
export const CANVAS_PANEL_SHELL_LOADING_CLASS =
  "flex items-center justify-center gap-2 py-16 text-[12px] text-white/45";
export const CANVAS_PANEL_SHELL_LOADING_MORE_CLASS =
  "flex items-center justify-center gap-2 py-3 text-[11px] text-white/45";
export const CANVAS_PANEL_SHELL_LOADING_SPINNER_CLASS = `${CANVAS_SEMANTIC_STATUS_CLASS} animate-spin`;
export const CANVAS_PANEL_SHELL_ERROR_CLASS =
  "rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200";
export const CANVAS_PANEL_SHELL_LINK_BTN_CLASS =
  "text-[10px] text-white/85 hover:underline";
export const CANVAS_PANEL_SHELL_LINK_BTN_DANGER_CLASS =
  "inline-flex items-center gap-0.5 text-[10px] text-red-300/80 hover:underline disabled:opacity-40";

/** 侧栏列表项 */
export const CANVAS_PANEL_ITEM_TITLE_CLASS =
  "truncate text-[13px] font-medium text-white";
export const CANVAS_PANEL_ITEM_META_CLASS = "mt-0.5 text-[11px] text-white/55";
export const CANVAS_PANEL_ITEM_CARD_CLASS =
  "rounded-lg border border-white/10 bg-black/25 p-2";

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

