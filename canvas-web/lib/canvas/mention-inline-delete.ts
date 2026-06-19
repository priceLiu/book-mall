import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";
import { inlineMentionThumbReserveSpaces } from "@/lib/canvas/mention-inline-thumb-metrics";
import { stripMentionThumbSlots } from "@/lib/canvas/mention-inline-thumb-placeholder";

export type MentionDeleteSpan = { start: number; end: number };

/** @mention 本体 + 为内联 badge 预留的尾随空格（Backspace/Delete 一次删净） */
export function mentionSpansWithThumbGaps(
  display: string,
  mentionables: MentionableItem[],
): MentionDeleteSpan[] {
  const cleaned = stripMentionThumbSlots(display);
  const ranges = findAllMentionRangesInDisplay(cleaned, mentionables);
  const reserve = inlineMentionThumbReserveSpaces() + 2;

  return ranges.map((r) => {
    let end = r.end;
    let spaces = 0;
    while (end < cleaned.length && cleaned[end] === " " && spaces < reserve) {
      end += 1;
      spaces += 1;
    }
    return { start: r.start, end };
  });
}

function spansIntersecting(
  spans: MentionDeleteSpan[],
  selStart: number,
  selEnd: number,
): MentionDeleteSpan | null {
  for (const span of spans) {
    if (selEnd <= span.start || selStart >= span.end) continue;
    return span;
  }
  return null;
}

/**
 * 内联缩略图模式下：Backspace / Delete / 选中删除时整段移除 @mention。
 * 返回 null 则走浏览器默认删字。
 */
export function resolveInlineMentionDelete(
  display: string,
  selStart: number,
  selEnd: number,
  mentionables: MentionableItem[],
  key: "Backspace" | "Delete",
): { next: string; caret: number } | null {
  const cleaned = stripMentionThumbSlots(display);
  const spans = mentionSpansWithThumbGaps(cleaned, mentionables);
  if (spans.length === 0) return null;

  if (selStart !== selEnd) {
    const hit = spansIntersecting(spans, selStart, selEnd);
    if (!hit) return null;
    let start = selStart;
    let end = selEnd;
    for (const span of spans) {
      if (span.end <= start || span.start >= end) continue;
      start = Math.min(start, span.start);
      end = Math.max(end, span.end);
    }
    const next = cleaned.slice(0, start) + cleaned.slice(end);
    return { next, caret: start };
  }

  const cursor = selStart;

  if (key === "Backspace") {
    for (const span of spans) {
      if (cursor > span.start && cursor <= span.end) {
        const next = cleaned.slice(0, span.start) + cleaned.slice(span.end);
        return { next, caret: span.start };
      }
    }
    return null;
  }

  for (const span of spans) {
    if (cursor >= span.start && cursor < span.end) {
      const next = cleaned.slice(0, span.start) + cleaned.slice(span.end);
      return { next, caret: span.start };
    }
  }
  return null;
}
