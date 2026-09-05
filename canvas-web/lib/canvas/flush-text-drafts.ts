/** 画布内 MentionsEditable / MentionsTextarea 的草稿 debounce 提交事件 */
export const CANVAS_FLUSH_TEXT_DRAFTS_EVENT = "canvas:flush-text-drafts";

/**
 * 立即把所有输入框草稿写回 store（同步）。
 *
 * Dock 发送钮必须在 pointerdown 阶段调用：否则 blur 提交会在 mousedown 与 click
 * 之间改写 store，按钮 disabled 态翻转 / 重渲染会吞掉这一次 click（表现为「要点好几下」）。
 */
export function flushCanvasTextDrafts(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANVAS_FLUSH_TEXT_DRAFTS_EVENT));
}
