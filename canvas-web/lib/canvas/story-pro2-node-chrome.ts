/**
 * 影视专业版 2.0 · 视觉常量（设计规范：docs/story-pro2-design-spec.md）
 */

export const PRO2_NODE_ACCENT = "#9f8fef";
export const PRO2_NODE_ACCENT_SOFT = "rgba(159, 143, 239, 0.1)";
/** 节点卡片描边 · 低对比灰紫（未选中 · 图 4） */
export const PRO2_NODE_BORDER = "rgba(255, 255, 255, 0.1)";
/** 节点选中描边 · 仅边框高亮（图 3） */
export const PRO2_NODE_BORDER_SELECTED = "rgba(255, 255, 255, 0.42)";

export function pro2NodeBorderColor(selected?: boolean): string {
  return selected ? PRO2_NODE_BORDER_SELECTED : PRO2_NODE_BORDER;
}
/** 输入坞描边 */
export const PRO2_DOCK_BORDER = "rgba(255, 255, 255, 0.08)";
export const PRO2_DOCK_SHELL_BG =
  "linear-gradient(165deg, rgba(22, 22, 28, 0.96) 0%, rgba(16, 16, 20, 0.98) 100%)";
/** 输入坞内部分隔线 · 极浅灰 */
export const PRO2_DOCK_DIVIDER = "border-white/[0.06]";

/** 控制类薄卡（列摘要等） */
export const PRO2_CONTROL_CARD_WIDTH = 360;
export const PRO2_CONTROL_CARD_HEIGHT = 140;

/** 2.0 文本节点（LibTV 卡片 · 默认尺寸，可拉伸） */
export const PRO2_TEXT_NODE_WIDTH = 280;
export const PRO2_TEXT_NODE_MIN_WIDTH = 240;
export const PRO2_TEXT_NODE_MIN_HEIGHT = 220;
/** 卡片主体默认高度（不含上方「文本节点 N」标签行） */
export const PRO2_TEXT_NODE_CARD_HEIGHT = 260;
/** React Flow 节点登记默认高度 ≈ 标签行 + 卡片 */
export const PRO2_TEXT_NODE_HEIGHT = PRO2_TEXT_NODE_CARD_HEIGHT + 28;

/** 2.0 脚本生成器 / 脚本表格节点 */
export const PRO2_SCRIPT_NODE_WIDTH = 480;
export const PRO2_SCRIPT_NODE_MIN_WIDTH = 360;
export const PRO2_SCRIPT_NODE_CARD_HEIGHT = 300;
export const PRO2_SCRIPT_NODE_MIN_HEIGHT = 220;
export const PRO2_SCRIPT_NODE_HEIGHT = PRO2_SCRIPT_NODE_CARD_HEIGHT + 28;

/** 2.0 图片节点（LibTV 薄卡） */
export const PRO2_IMAGE_NODE_WIDTH = 280;
export const PRO2_IMAGE_NODE_MIN_WIDTH = 220;
export const PRO2_IMAGE_NODE_CARD_HEIGHT = 280;
export const PRO2_IMAGE_NODE_MIN_HEIGHT = 240;
export const PRO2_IMAGE_NODE_HEIGHT = PRO2_IMAGE_NODE_CARD_HEIGHT + 28;

/** 2.0 三视图角色节点（图 3 · 横向矩形 · contain 完整显示） */
export const PRO2_CHARACTER_THREE_VIEW_WIDTH = 400;
export const PRO2_CHARACTER_THREE_VIEW_HEIGHT = 280;
export const PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH = 320;
export const PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT = 160;
export const PRO2_CHARACTER_THREE_VIEW_CARD_HEIGHT = 252;

/** 2.0 统一输入坞（固定横向长方形 · 内容区可滚动） */
export const PRO2_DOCK_WIDTH = 560;
export const PRO2_DOCK_HEIGHT = 240;

/** 2.0 分镜图板节点（图 4 · 双列瀑布流） */
export const PRO2_FRAME_BOARD_WIDTH = 520;
export const PRO2_FRAME_BOARD_HEIGHT = 480;
export const PRO2_FRAME_BOARD_MIN_WIDTH = 400;
export const PRO2_FRAME_BOARD_MIN_HEIGHT = 320;

/** 2.0 媒体组容器（分镜图 / 三视图 · 图 1） */
export const PRO2_MEDIA_GROUP_BG = "#141418";
export const PRO2_MEDIA_GROUP_DOT_GRID =
  "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)";
export const PRO2_MEDIA_GROUP_DOT_SIZE = "14px 14px";
export const PRO2_MEDIA_GROUP_BORDER = "rgba(255, 255, 255, 0.08)";
export const PRO2_MEDIA_GROUP_BORDER_SELECTED = "rgba(255, 255, 255, 0.2)";
export const PRO2_MEDIA_GROUP_SHELL_CLASS =
  "pro2-media-group-node relative h-full w-full overflow-visible rounded-[20px]";

/** 媒体图片卡：无边框、无底色；nodrag 保证仅标题栏拖动 */
export const PRO2_MEDIA_CARD_SHELL_CLASS =
  "nodrag overflow-hidden rounded-xl";

/** 2.0 媒体节点标题栏 · 唯一拖动手柄 */
export const PRO2_MEDIA_NODE_TITLE_CLASS =
  "mb-1.5 flex min-h-[22px] shrink-0 cursor-grab items-center gap-1.5 px-0.5 text-[11px] text-white/55 active:cursor-grabbing";

/** 2.0 文本 / 脚本节点标题栏 · 整行宽 · 唯一拖动手柄 */
export const PRO2_TEXT_NODE_TITLE_CLASS =
  "flex w-full min-h-[26px] shrink-0 cursor-grab items-center gap-1.5 px-1 text-[11px] text-white/55 active:cursor-grabbing";

/** 列摘要薄卡 */
export const PRO2_COLUMN_CARD_WIDTH = 320;
export const PRO2_COLUMN_CARD_HEIGHT = 120;

export const PRO2_CARD_SHELL_CLASS =
  "rounded-xl border bg-[var(--canvas-surface)]/90 shadow-sm transition-shadow";

/** @deprecated 选中态改由 pro2NodeBorderColor 控制边框，不再使用 ring */
export const PRO2_CARD_SELECTED_CLASS = "";

export const PRO2_CARD_TITLE_CLASS =
  "text-[12px] font-semibold tracking-wide text-violet-100";

/** @deprecated 薄卡不再使用副标题；仅浮动检视/助手内必要时保留 */
export const PRO2_CARD_SUBTITLE_CLASS = "text-[10px] text-white/55";

export const PRO2_STAGE_BADGE_CLASS =
  "rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-100";

/** 检视 / 浮层主按钮 */
export const PRO2_INSPECTOR_ACTION_BTN_CLASS =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-500/15 px-2 text-[12px] font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40";

export const PRO2_ACTION_BTN_SPLIT_CLASS =
  "inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-violet-400/35 bg-violet-500/12 px-2 py-2 text-[11px] font-medium text-violet-100 hover:bg-violet-500/22 disabled:cursor-not-allowed disabled:opacity-40";

export const PRO2_HINT_LABEL_CLASS =
  "text-[10px] font-medium text-violet-200/70";

export const PRO2_TEMPLATE_CHIP_CLASS =
  "rounded-md border px-2 py-1 text-[10px] text-violet-100/90 transition";

export const PRO2_TEMPLATE_CHIP_SELECTED_CLASS =
  "border-violet-400/45 bg-violet-500/20 text-violet-50";

export const PRO2_INFO_PANEL_CLASS =
  "rounded-lg border border-violet-400/25 bg-violet-500/8 px-3 py-2.5";

export const PRO2_LINK_BTN_CLASS =
  "nodrag inline-flex items-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-50 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40";

export const PRO2_TEXTAREA_CLASS =
  "nodrag w-full resize-y overflow-y-auto rounded border border-violet-400/20 bg-black/40 px-2 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-45";

/** NodeResizer · 外框线隐藏，仅角点把手（见 globals.css） */
export const PRO2_NODE_RESIZER_COLOR = "transparent";
export const PRO2_NODE_RESIZER_LINE = {
  border: "none",
  borderColor: "transparent",
  opacity: 0,
};
export const PRO2_NODE_RESIZER_HANDLE = {
  background: "rgba(255,255,255,0.25)",
  border: "1px solid rgba(255,255,255,0.15)",
  width: 7,
  height: 7,
  borderRadius: 2,
};
export const PRO2_NODE_HANDLE_CLASS =
  "!h-2 !w-2 !border-white/25 !bg-white/30 transition-opacity";

/** 输入坞内 textarea · 无边框 */
export const PRO2_DOCK_TEXTAREA_CLASS =
  "nodrag w-full resize-none border-0 bg-transparent text-[13px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-45";

export const PRO2_SAVE_TO_ASSETS_BTN_CLASS =
  "nodrag w-full rounded border border-violet-400/25 bg-violet-500/8 px-2 py-1.5 text-[11px] text-violet-100 hover:bg-violet-500/15 disabled:opacity-40";

export const PRO2_UPLOAD_DROPZONE_CLASS =
  "nodrag flex w-full items-center gap-2 rounded border border-dashed border-violet-400/25 bg-violet-500/8 px-2 py-2 text-left text-[11px] text-white/80 transition hover:border-violet-400/45 hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-45";

export const PRO2_REF_THUMB_CLASS =
  "group relative size-14 overflow-hidden rounded border border-violet-400/20 bg-black/40";

export const PRO2_GUIDE_PANEL_CLASS =
  "nodrag shrink-0 rounded-lg border border-violet-400/15 bg-gradient-to-br from-violet-950/30 to-transparent px-2.5 py-2";

export const PRO2_GUIDE_TITLE_CLASS =
  "mb-1.5 text-[10px] font-medium uppercase tracking-wider text-violet-300/70";

export const PRO2_GUIDE_STEP_ICON_CLASS =
  "mt-0.5 size-3 shrink-0 text-violet-400/60";

export const PRO2_GUIDE_STEP_NUM_CLASS = "font-mono text-[9px] text-violet-400/50";

export const PRO2_NODE_SHELL_FOOTER_CLASS =
  "shrink-0 border-t border-violet-400/12 bg-violet-950/20 px-3 py-2";

/** 剧本创作助手 · pro2 主题（禁止 green/emerald） */
export type StoryAssistantChrome = {
  titleText: string;
  tabActive: string;
  tabIdle: string;
  threadActive: string;
  collapsedTab: string;
  panelBorder: string;
  userBubble: string;
  userBubbleDock: string;
  sendBtn: string;
  inputFocus: string;
  pulseDot: string;
  cursorBlink: string;
  packHint: string;
  previewBtn: string;
  expandBtn: string;
};

export const PRO2_ASSISTANT_CHROME: StoryAssistantChrome = {
  titleText: "text-violet-200",
  tabActive: "border-violet-400/45 bg-violet-500/15 text-violet-50",
  tabIdle: "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80",
  threadActive: "border-violet-400/45 bg-violet-500/15 text-violet-50",
  collapsedTab:
    "border-violet-400/30 text-violet-200 hover:border-violet-400/50",
  panelBorder: "border-violet-400/30",
  userBubble: "ml-auto max-w-[85%] bg-violet-950 text-violet-50",
  userBubbleDock: "ml-4 bg-violet-950/90 text-violet-50",
  sendBtn:
    "bg-violet-500/20 text-violet-100 hover:bg-violet-500/30 disabled:opacity-40",
  inputFocus: "focus:border-violet-400/40",
  pulseDot: "bg-violet-400/80",
  cursorBlink: "bg-violet-300/90",
  packHint: "text-violet-200/85",
  previewBtn:
    "border-violet-400/30 text-violet-100 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-40",
  expandBtn:
    "border-violet-400/30 text-violet-200 hover:bg-violet-500/10",
};

export const PRO_ASSISTANT_CHROME: StoryAssistantChrome = {
  titleText: "text-emerald-300",
  tabActive: "border-emerald-400/45 bg-emerald-500/15 text-emerald-100",
  tabIdle: "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80",
  threadActive: "border-emerald-400/45 bg-emerald-500/15 text-emerald-50",
  collapsedTab:
    "border-emerald-400/30 text-emerald-200 hover:border-emerald-400/50",
  panelBorder: "border-emerald-400/30",
  userBubble: "ml-auto max-w-[85%] bg-emerald-950 text-emerald-50",
  userBubbleDock: "ml-4 bg-emerald-950/90 text-emerald-50",
  sendBtn:
    "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-40",
  inputFocus: "focus:border-emerald-400/40",
  pulseDot: "bg-emerald-400/80",
  cursorBlink: "bg-emerald-300/90",
  packHint: "text-cyan-200/85",
  previewBtn:
    "border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40",
  expandBtn:
    "border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10",
};
