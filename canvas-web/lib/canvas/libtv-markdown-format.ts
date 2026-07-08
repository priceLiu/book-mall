/** 标签 / 轻量 Markdown 编辑 · 选区格式化 */

export type MarkdownFormatAction =
  | "clear"
  | "h1"
  | "h2"
  | "h3"
  | "paragraph"
  | "bold"
  | "italic"
  | "ul"
  | "ol"
  | "hr";

function linePrefix(prefix: string, line: string): string {
  const trimmed = line.replace(/^#+\s*/, "").trim();
  return trimmed ? `${prefix}${trimmed}` : prefix.trimEnd();
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? linePrefix(prefix, line) : line))
    .join("\n");
}

function wrapSelection(text: string, start: number, end: number, wrap: string): {
  next: string;
  cursor: number;
} {
  const sel = text.slice(start, end);
  const inner = sel.startsWith(wrap) && sel.endsWith(wrap) ? sel.slice(wrap.length, -wrap.length) : sel;
  const wrapped =
    sel.startsWith(wrap) && sel.endsWith(wrap)
      ? inner
      : `${wrap}${inner || "文本"}${wrap}`;
  const next = `${text.slice(0, start)}${wrapped}${text.slice(end)}`;
  const cursor = start + wrapped.length;
  return { next, cursor };
}

export function applyMarkdownFormatAction(
  action: MarkdownFormatAction,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { next: string; selectionStart: number; selectionEnd: number } {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const hasSelection = end > start;

  if (action === "hr") {
    const insert = start === end ? "\n---\n" : `\n---\n`;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    const pos = start + insert.length;
    return { next, selectionStart: pos, selectionEnd: pos };
  }

  if (action === "bold") {
    const { next, cursor } = wrapSelection(value, start, end, "**");
    return { next, selectionStart: start, selectionEnd: cursor };
  }

  if (action === "italic") {
    const { next, cursor } = wrapSelection(value, start, end, "*");
    return { next, selectionStart: start, selectionEnd: cursor };
  }

  const block =
    action === "h1"
      ? "# "
      : action === "h2"
        ? "## "
        : action === "h3"
          ? "### "
          : action === "ul"
            ? "- "
            : action === "ol"
              ? "1. "
              : "";

  if (block) {
    const target = hasSelection ? value.slice(start, end) : value;
    const formatted = prefixLines(target, block);
    const next = hasSelection
      ? `${value.slice(0, start)}${formatted}${value.slice(end)}`
      : formatted;
    const pos = hasSelection ? start + formatted.length : next.length;
    return { next, selectionStart: start, selectionEnd: pos };
  }

  if (action === "paragraph") {
    const target = hasSelection ? value.slice(start, end) : value;
    const formatted = target
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
      .join("\n");
    const next = hasSelection
      ? `${value.slice(0, start)}${formatted}${value.slice(end)}`
      : formatted;
    const pos = hasSelection ? start + formatted.length : next.length;
    return { next, selectionStart: start, selectionEnd: pos };
  }

  if (action === "clear") {
    const target = hasSelection ? value.slice(start, end) : value;
    const formatted = target
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^#+\s+/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "");
    const next = hasSelection
      ? `${value.slice(0, start)}${formatted}${value.slice(end)}`
      : formatted;
    const pos = hasSelection ? start + formatted.length : next.length;
    return { next, selectionStart: start, selectionEnd: pos };
  }

  return { next: value, selectionStart: start, selectionEnd: end };
}
