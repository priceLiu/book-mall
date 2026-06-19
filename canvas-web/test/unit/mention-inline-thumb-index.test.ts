import { describe, expect, it } from "vitest";
import {
  MENTION_THUMB_PAD_CHAR,
  MENTION_THUMB_SLOT_CHAR,
  mapDisplayIndexToRawIndex,
  mentionThumbSlotString,
  stripMentionThumbSlots,
} from "@/lib/canvas/mention-inline-thumb-placeholder";

describe("mapDisplayIndexToRawIndex", () => {
  it("returns same index when no em slots", () => {
    const raw = "hello  @图片 1     ";
    expect(mapDisplayIndexToRawIndex(raw, 7)).toBe(7);
  });

  it("maps stripped index past em slot runs", () => {
    const slot = mentionThumbSlotString("pro2");
    const raw = `@图片 1${slot} tail`;
    const stripped = stripMentionThumbSlots(raw);
    const atPos = stripped.indexOf("@");
    expect(mapDisplayIndexToRawIndex(raw, atPos)).toBe(0);
    const tailPos = stripped.indexOf("tail");
    expect(mapDisplayIndexToRawIndex(raw, tailPos)).toBe(
      raw.indexOf("tail"),
    );
  });

  it("handles pad chars inside slot runs", () => {
    const raw = `a${MENTION_THUMB_PAD_CHAR}${MENTION_THUMB_SLOT_CHAR}${MENTION_THUMB_PAD_CHAR}b`;
    expect(mapDisplayIndexToRawIndex(raw, 1)).toBe(raw.indexOf("b"));
  });
});
