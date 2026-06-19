import { describe, expect, it } from "vitest";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import {
  mentionSpansWithThumbGaps,
  resolveInlineMentionDelete,
} from "@/lib/canvas/mention-inline-delete";

const mentionables: MentionableItem[] = [
  { id: "a", label: "图片 1", previewUrl: "https://x/1.png" },
  { id: "b", label: "图片 3", previewUrl: "https://x/3.png" },
];

describe("resolveInlineMentionDelete", () => {
  it("Backspace 一次删掉 @图片 1 及尾随空格", () => {
    const display = "抓向 @图片 1      ";
    const spans = mentionSpansWithThumbGaps(display, mentionables);
    expect(spans).toHaveLength(1);
    const cursor = spans[0]!.end;
    const r = resolveInlineMentionDelete(
      display,
      cursor,
      cursor,
      mentionables,
      "Backspace",
    );
    expect(r?.next).toBe("抓向 ");
    expect(r?.caret).toBe(spans[0]!.start);
  });

  it("连续 Backspace 可删掉多个相同 @mention", () => {
    let display = "末 @图片 1      @图片 1      @图片 3      ";
    for (let i = 0; i < 3; i++) {
      const spans = mentionSpansWithThumbGaps(display, mentionables);
      const last = spans[spans.length - 1]!;
      const r = resolveInlineMentionDelete(
        display,
        last.end,
        last.end,
        mentionables,
        "Backspace",
      );
      expect(r).not.toBeNull();
      display = r!.next;
    }
    expect(display.trim()).toBe("末");
    expect(display.includes("@")).toBe(false);
  });

  it("Delete 在 mention 开头向前删", () => {
    const display = "抓向 @图片 1      继续";
    const start = display.indexOf("@");
    const r = resolveInlineMentionDelete(
      display,
      start,
      start,
      mentionables,
      "Delete",
    );
    expect(r?.next).toBe("抓向       继续");
    expect(r?.caret).toBe(start);
  });
});
