import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";

/** em space · textarea 与 mirror 各占用相同字符数以对齐缩略图 */
export const MENTION_THUMB_SLOT_CHAR = "\u2003";
/** en space · 占位符两侧留白，便于光标移动与编辑 */
export const MENTION_THUMB_PAD_CHAR = "\u2002";

const SLOT_RUN_RE = new RegExp(
  `[${MENTION_THUMB_PAD_CHAR}]*${MENTION_THUMB_SLOT_CHAR}+[${MENTION_THUMB_PAD_CHAR}]*`,
  "g",
);

export function mentionThumbSlotLength(edition: "pro2" | "sbv1"): number {
  return edition === "sbv1" ? 4 : 3;
}

export function mentionThumbSlotString(edition: "pro2" | "sbv1"): string {
  const core = MENTION_THUMB_SLOT_CHAR.repeat(mentionThumbSlotLength(edition));
  const pad = MENTION_THUMB_PAD_CHAR.repeat(2);
  return `${pad}${core}${pad}`;
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

/** 每个带 preview 的 @mention 后插入固定占位（先 strip 再插入，避免漂移/重复） */
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
