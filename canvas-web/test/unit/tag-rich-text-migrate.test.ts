import { describe, expect, it } from "vitest";

import {
  isTagRichTextHtml,
  normalizeTagRichTextBody,
  tagRichTextToPlainText,
} from "@/lib/canvas/tag-rich-text-migrate";

describe("tag-rich-text-migrate", () => {
  it("detects HTML bodies", () => {
    expect(isTagRichTextHtml("<p>hello</p>")).toBe(true);
    expect(isTagRichTextHtml("# heading")).toBe(false);
  });

  it("migrates legacy markdown to HTML", () => {
    const html = normalizeTagRichTextBody("## Title\n\n**bold** text");
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("migrates legacy inline style markers", () => {
    const html = normalizeTagRichTextBody("{{14px|#ff0000}}red{{/}}");
    expect(html).toContain('font-size:14px');
    expect(html).toContain('color:#ff0000');
    expect(html).toContain("red");
  });

  it("converts HTML to plain text for export", () => {
    const plain = tagRichTextToPlainText("<h1>Hi</h1><p>line</p>");
    expect(plain).toContain("Hi");
    expect(plain).toContain("line");
  });
});
