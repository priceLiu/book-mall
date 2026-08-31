/** 电商工具箱 · 右侧助手会话区气泡与选项区样式（种草视频 / 产品主图 / 详情页统一） */

/** 折叠态悬浮输入外框（全站助手统一品牌蓝描边） */
export const ECOM_ASSISTANT_FLOATING_COMPOSER_SHELL_CLASS =
  "rounded-2xl border border-[var(--ecom-chrome-accent)] bg-white p-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-[var(--ecom-chrome-accent)]/25 transition-[box-shadow,ring-color] hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] hover:ring-[var(--ecom-chrome-accent)]/40";

/** 展开态 composer 底栏（折叠悬浮时省略顶部分割线，避免与蓝框叠层） */
export const ECOM_ASSISTANT_COMPOSER_SHELL_BASE =
  "shrink-0 bg-[var(--ecom-assistant-composer-bg)] p-4";

/** 折叠悬浮 composer 内层（外框已有 padding，内层略收紧） */
export const ECOM_ASSISTANT_COMPOSER_SHELL_COMPACT =
  "shrink-0 bg-[var(--ecom-assistant-composer-bg)] p-0.5";

export const ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER =
  "border-t border-[var(--ecom-assistant-border)]";

export const ECOM_ASSISTANT_BUBBLE_CLASS =
  "border border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bubble-bg)] text-[#1d1d1f]";

export const ECOM_ASSISTANT_USER_BUBBLE_CLASS = "bg-[#0071e3] text-white";

/** 用户短回复气泡（与产品主图助手一致：宽度随内容，上限 95%） */
export const ECOM_ASSISTANT_USER_MESSAGE_BUBBLE_BASE =
  "max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed";

export const ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE =
  "max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed";

export const ECOM_ASSISTANT_CHOICE_SHELL_CLASS =
  "w-full max-w-[95%] rounded-2xl border border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bubble-bg)] px-3.5 py-3";
