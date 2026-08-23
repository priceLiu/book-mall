/** textarea 选区 · 供 portal 工具栏在 blur 后仍能读取 */

export type TextAreaSelectionRange = {
  start: number;
  end: number;
};

export function readTextAreaSelection(
  el: HTMLTextAreaElement | null,
  fallback?: TextAreaSelectionRange | null,
): TextAreaSelectionRange {
  if (el) {
    return { start: el.selectionStart, end: el.selectionEnd };
  }
  return fallback ?? { start: 0, end: 0 };
}

/** 优先使用非空选区（saved 或 live） */
export function resolveTextAreaSelection(
  el: HTMLTextAreaElement | null,
  saved: TextAreaSelectionRange | null,
  textLength: number,
): TextAreaSelectionRange {
  const live = readTextAreaSelection(el, saved);
  if (live.end > live.start) return live;
  if (saved && saved.end > saved.start) return saved;
  const pos = Math.min(live.start, textLength);
  return { start: pos, end: pos };
}

/** 光标所在行范围（无选区时块级格式仅改当前行） */
export function getTextLineRange(value: string, pos: number): TextAreaSelectionRange {
  const clamped = Math.max(0, Math.min(pos, value.length));
  const start = value.lastIndexOf("\n", clamped - 1) + 1;
  const nextBreak = value.indexOf("\n", clamped);
  const end = nextBreak === -1 ? value.length : nextBreak;
  return { start, end };
}
