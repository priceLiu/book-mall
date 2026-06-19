import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";
import {
  INLINE_MENTION_LEADING_SPACES,
  inlineMentionThumbReserveSpaces,
} from "@/lib/canvas/mention-inline-thumb-metrics";

/** em space · textarea 与 mirror 各占用相同字符数以对齐缩略图 */
export const MENTION_THUMB_SLOT_CHAR = "\u2003";
/** en space · 占位符两侧留白，便于光标移动与编辑 */
export const MENTION_THUMB_PAD_CHAR = "\u2002";

const SLOT_RUN_RE = new RegExp(
  `[${MENTION_THUMB_PAD_CHAR}]*${MENTION_THUMB_SLOT_CHAR}+[${MENTION_THUMB_PAD_CHAR}]*`,
  "g",
);

export function mentionThumbSlotLength(_edition: "pro2" | "sbv1"): number {
  /** 1 个 em space ≈ 1em 宽 · 与内联缩略图同高同宽 */
  return 1;
}

export function mentionThumbSlotString(_edition: "pro2" | "sbv1"): string {
  const core = MENTION_THUMB_SLOT_CHAR.repeat(mentionThumbSlotLength(_edition));
  const padBefore = MENTION_THUMB_PAD_CHAR.repeat(2);
  const padAfter = MENTION_THUMB_PAD_CHAR.repeat(1);
  return `${padBefore}${core}${padAfter}`;
}

export function stripMentionThumbSlots(display: string): string {
  if (
    !display.includes(MENTION_THUMB_SLOT_CHAR) &&
    !display.includes(MENTION_THUMB_PAD_CHAR)
  ) {
    return display;
  }
  return display.replace(SLOT_RUN_RE, "");
}

/** 内联 mention badge：@mention 后补足够普通空格，给左侧 16px 缩略图留出流式宽度 */
export function ensureInlineThumbTextGaps(
  display: string,
  mentionables: MentionableItem[],
  fontSizePx = 13,
): string {
  const stripped = stripMentionThumbSlots(display);
  const ranges = findAllMentionRangesInDisplay(stripped, mentionables);
  if (ranges.length === 0) return stripped;

  const reserveSpaces = inlineMentionThumbReserveSpaces(fontSizePx);
  let result = "";
  let cursor = 0;

  for (const range of ranges) {
    result += stripped.slice(cursor, range.start);

    if (range.item.previewUrl) {
      let existingBefore = 0;
      for (let j = range.start - 1; j >= 0 && stripped[j] === " "; j--) {
        existingBefore += 1;
      }
      const prevIdx = range.start - existingBefore - 1;
      const prevChar = prevIdx >= 0 ? stripped[prevIdx] : undefined;
      if (prevChar !== undefined && !/\s/.test(prevChar)) {
        const needBefore = Math.max(
          0,
          INLINE_MENTION_LEADING_SPACES - existingBefore,
        );
        if (needBefore > 0) {
          result += " ".repeat(needBefore);
        }
      }
    }

    result += stripped.slice(range.start, range.end);
    cursor = range.end;
    if (!range.item.previewUrl) continue;

    const tail = stripped.slice(cursor);
    const existing = tail.match(/^ */)?.[0]?.length ?? 0;
    const need = Math.max(0, reserveSpaces - existing);
    if (need > 0) {
      result += " ".repeat(need);
    }
  }
  result += stripped.slice(cursor);
  return result;
}

/** @deprecated 旧 invisible 占位 · 仅 strip 迁移用 */
export function ensureMentionThumbSlots(
  display: string,
  mentionables: MentionableItem[],
  edition: "pro2" | "sbv1",
): string {
  const stripped = stripMentionThumbSlots(display);
  const slot = mentionThumbSlotString(edition);
  const ranges = findAllMentionRangesInDisplay(stripped, mentionables);
  if (ranges.length === 0) return stripped;

  let result = "";
  let cursor = 0;
  for (const range of ranges) {
    result += stripped.slice(cursor, range.end);
    cursor = range.end;
    if (range.item.previewUrl) result += slot;
  }
  result += stripped.slice(cursor);
  return result;
}

export function countMentionThumbSlotsAt(
  display: string,
  startIndex: number,
  edition: "pro2" | "sbv1",
): number {
  const expected = mentionThumbSlotLength(edition);
  let i = startIndex;
  while (i < display.length && display[i] === MENTION_THUMB_PAD_CHAR) {
    i += 1;
  }
  let count = 0;
  while (
    count < expected &&
    i < display.length &&
    display[i] === MENTION_THUMB_SLOT_CHAR
  ) {
    count += 1;
    i += 1;
  }
  return count;
}

/** 跳过 @label 后的占位 run（pad + em slots + pad） */
export function skipMentionThumbSlotRun(
  display: string,
  startIndex: number,
): number {
  let i = startIndex;
  while (i < display.length && display[i] === MENTION_THUMB_PAD_CHAR) {
    i += 1;
  }
  while (i < display.length && display[i] === MENTION_THUMB_SLOT_CHAR) {
    i += 1;
  }
  while (i < display.length && display[i] === MENTION_THUMB_PAD_CHAR) {
    i += 1;
  }
  return i - startIndex;
}
