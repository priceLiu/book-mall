import { describe, expect, it } from "vitest";

import {
  isPlainLibtvTextContent,
  LIBTV_PLAIN_TEXT_WRAP_CLASS,
} from "@/lib/canvas/libtv-plain-text-display";

describe("isPlainLibtvTextContent", () => {
  it("treats long single-line prompts as plain text", () => {
    expect(
      isPlainLibtvTextContent(
        "Ghibli style, Xiaoya (red hair girl) and Xiaomu floating in space",
      ),
    ).toBe(true);
  });

  it("detects markdown headings", () => {
    expect(isPlainLibtvTextContent("# 故事大纲\n\n正文")).toBe(false);
  });

  it("detects GFM tables", () => {
    expect(isPlainLibtvTextContent("| a | b |\n| --- | --- |")).toBe(false);
  });
});

describe("LIBTV_PLAIN_TEXT_WRAP_CLASS", () => {
  it("includes wrap utilities", () => {
    expect(LIBTV_PLAIN_TEXT_WRAP_CLASS).toContain("whitespace-pre-wrap");
    expect(LIBTV_PLAIN_TEXT_WRAP_CLASS).toContain("break-words");
  });
});
