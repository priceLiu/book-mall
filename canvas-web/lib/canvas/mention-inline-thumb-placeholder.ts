import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";

/** em space · textarea 与 mirror 各占用相同字符数以对齐换行 */
export const MENTION_THUMB_SLOT_CHAR = "\u2003";

export function mentionThumbSlotLength(edition: "pro2" | "sbv1"): number {
  return edition === "sbv1" ? 2 : 1;
}

export function mentionThumbSlotString(edition: "pro2" | "sbv1"): string {
  return MENTION_THUMB_SLOT_CHAR.repeat(mentionThumbSlotLength(edition));
}

export function stripMentionThumbSlots(display: string): string {
  if (!display.includes(MENTION_THUMB_SLOT_CHAR)) return display;
  return display.replace(new RegExp(`${MENTION_THUMB_SLOT_CHAR}+`, "g"), "");
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
  let count = 0;
  let i = startIndex;
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
