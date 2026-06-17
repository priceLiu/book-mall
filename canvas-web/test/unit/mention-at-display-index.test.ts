import { describe, expect, it } from "vitest";
import {
  findAllMentionRangesInDisplay,
  findMentionAtDisplayIndex,
  findMentionRangeAtDisplayIndex,
} from "@/lib/canvas/mention-at-display-index";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";

const mentionables: MentionableItem[] = [
  { id: "a", label: "图片 1", previewUrl: "https://x/1.png" },
  { id: "b", label: "图片 10", previewUrl: "https://x/10.png" },
];

describe("findMentionAtDisplayIndex", () => {
  it("hits mention by label at @", () => {
    const display = "@图片 1 游到湖中";
    expect(findMentionAtDisplayIndex(display, 0, mentionables)?.id).toBe("a");
    expect(findMentionAtDisplayIndex(display, 3, mentionables)?.id).toBe("a");
  });

  it("prefers longer label match", () => {
    const display = "@图片 10 动";
    const hit = findMentionRangeAtDisplayIndex(display, 5, mentionables);
    expect(hit?.item.id).toBe("b");
    expect(hit?.start).toBe(0);
    expect(hit?.end).toBe(6);
  });

  it("returns null outside mention", () => {
    const display = "@图片 1 游";
    expect(findMentionAtDisplayIndex(display, 6, mentionables)).toBeNull();
  });
});

describe("findAllMentionRangesInDisplay", () => {
  it("lists all mentions left to right", () => {
    const display = "@图片 1 和 @图片 10";
    const hits = findAllMentionRangesInDisplay(display, mentionables);
    expect(hits.map((h) => h.item.id)).toEqual(["a", "b"]);
  });
});
