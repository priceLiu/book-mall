/** 标签 / 轻量 Markdown 编辑 · 选区格式化 */

import { stripTagInlineStyleMarkers } from "./libtv-markdown-inline-style";
import { getTextLineRange } from "./libtv-textarea-selection";

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

  /** 无选区时块级/清除仅作用于光标行，避免一改全文 */
  const resolveBlockRange = () =>
    end > start ? { start, end } : getTextLineRange(value, start);

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
    const { start: bStart, end: bEnd } = resolveBlockRange();
    const target = value.slice(bStart, bEnd);
    const formatted = prefixLines(target, block);
    const next = `${value.slice(0, bStart)}${formatted}${value.slice(bEnd)}`;
    const pos = bStart + formatted.length;
    return { next, selectionStart: bStart, selectionEnd: pos };
  }

  if (action === "paragraph") {
    const { start: bStart, end: bEnd } = resolveBlockRange();
    const target = value.slice(bStart, bEnd);
    const formatted = target
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
      .join("\n");
    const next = `${value.slice(0, bStart)}${formatted}${value.slice(bEnd)}`;
    const pos = bStart + formatted.length;
    return { next, selectionStart: bStart, selectionEnd: pos };
  }

  if (action === "clear") {
    const { start: bStart, end: bEnd } = resolveBlockRange();
    const target = value.slice(bStart, bEnd);
    const formatted = stripTagInlineStyleMarkers(
      target
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/^#+\s+/gm, "")
        .replace(/^[-*]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, ""),
    );
    const next = `${value.slice(0, bStart)}${formatted}${value.slice(bEnd)}`;
    const pos = bStart + formatted.length;
    return { next, selectionStart: bStart, selectionEnd: pos };
  }

  return { next: value, selectionStart: start, selectionEnd: end };
}
