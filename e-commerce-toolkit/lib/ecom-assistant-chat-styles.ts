/** 电商工具箱 · 右侧助手会话区气泡与选项区样式（种草视频 / 产品主图 / 详情页统一） */

/** 折叠态悬浮输入外框（浅灰描边，内边距尽量小） */
export const ECOM_ASSISTANT_FLOATING_COMPOSER_SHELL_CLASS =
  "rounded-2xl border border-[var(--ecom-divider)] bg-white p-1 shadow-[0_8px_32px_rgba(0,0,0,0.08)]";

/** 展开态 composer 底栏 */
export const ECOM_ASSISTANT_COMPOSER_SHELL_BASE =
  "shrink-0 bg-[var(--ecom-assistant-composer-bg)] px-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] pt-3 pr-3";

/** 折叠悬浮 composer 内层（贴外框，无额外留白） */
export const ECOM_ASSISTANT_COMPOSER_SHELL_COMPACT =
  "shrink-0 bg-transparent p-0";

/** 输入行：发送钮靠右，间距收紧 */
export const ECOM_ASSISTANT_COMPOSER_ROW_CLASS =
  "flex w-full items-center gap-1";

/** 助手输入框（悬浮 / 展开共用） */
export const ECOM_ASSISTANT_COMPOSER_TEXTAREA_CLASS =
  "min-h-[2.25rem] min-w-0 flex-1 resize-y rounded-lg border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-2 py-1.5 text-sm leading-snug text-[var(--ecom-ink)] outline-none placeholder:text-[var(--ecom-subtle)] focus:border-[var(--ecom-border-soft)] disabled:opacity-50";

export const ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER =
  "border-t border-[var(--ecom-assistant-border)]";

export const ECOM_ASSISTANT_BUBBLE_CLASS =
  "border border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bubble-bg)] text-[var(--ecom-ink)]";

export const ECOM_ASSISTANT_USER_BUBBLE_CLASS = "bg-[var(--ecom-primary)] text-white";

/** 用户短回复气泡（与产品主图助手一致：宽度随内容，上限 95%） */
export const ECOM_ASSISTANT_USER_MESSAGE_BUBBLE_BASE =
  "max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed";

export const ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE =
  "max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed";

export const ECOM_ASSISTANT_CHOICE_SHELL_CLASS =
  "w-full max-w-[95%] rounded-2xl border border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bubble-bg)] px-3.5 py-3";
