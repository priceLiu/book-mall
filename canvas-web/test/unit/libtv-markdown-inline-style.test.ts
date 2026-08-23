import { describe, expect, it } from "vitest";

import {
  applyTagInlineStyleAction,
  parseTagInlineStyleToken,
  splitTagMarkdownInlineStyles,
  stripTagInlineStyleMarkers,
} from "@/lib/canvas/libtv-markdown-inline-style";
import { applyMarkdownFormatAction } from "@/lib/canvas/libtv-markdown-format";

describe("libtv-markdown-inline-style", () => {
  it("parses font size and color token", () => {
    expect(parseTagInlineStyleToken("14px|#ff6600")).toEqual({
      fontSizePx: 14,
      color: "#ff6600",
    });
  });

  it("wraps selection with inline style markers", () => {
    const src = "标题建议：亮点一";
    const result = applyTagInlineStyleAction(src, 5, 7, {
      fontSizePx: 16,
      color: "#fbbf24",
    });
    expect(result.next).toBe(
      "标题建议：{{16px|#fbbf24}}亮点{{/}}一",
    );
    expect(result.selectionStart).toBe(5 + "{{16px|#fbbf24}}".length);
    expect(result.selectionEnd).toBe(result.selectionStart + "亮点".length);
  });

  it("updates style inside existing wrapped block", () => {
    const src = "前缀{{11px|#ffffff}}选中文本{{/}}后缀";
    const innerStart = src.indexOf("选中文本");
    const innerEnd = innerStart + "选中文本".length;
    const result = applyTagInlineStyleAction(src, innerStart, innerEnd, {
      color: "#f87171",
    });
    expect(result.next).toBe("前缀{{11px|#f87171}}选中文本{{/}}后缀");
  });

  it("splits markdown into styled segments", () => {
    const parts = splitTagMarkdownInlineStyles(
      "普通{{14px|#60a5fa}}蓝色{{/}}结尾",
    );
    expect(parts).toEqual([
      { kind: "md", text: "普通" },
      { kind: "styled", style: { fontSizePx: 14, color: "#60a5fa" }, text: "蓝色" },
      { kind: "md", text: "结尾" },
    ]);
  });

  it("clear removes inline style markers from selection only", () => {
    const src = "A{{16px|#fff}}B{{/}}C";
    const cleared = applyMarkdownFormatAction("clear", src, 0, src.length);
    expect(cleared.next).toBe("ABC");
    expect(stripTagInlineStyleMarkers(src)).toBe("ABC");
  });

  it("does not apply inline style without selection", () => {
    const src = "标题建议：亮点";
    const result = applyTagInlineStyleAction(src, 3, 3, { color: "#fbbf24" });
    expect(result.next).toBe(src);
  });

  it("applies color to partial selection inside styled block", () => {
    const src = "前缀{{14px|#fff}}亮点{{/}}后缀";
    const start = src.indexOf("亮点");
    const end = start + "亮点".length;
    const result = applyTagInlineStyleAction(src, start, end, { color: "#f87171" });
    expect(result.next).toBe("前缀{{14px|#f87171}}亮点{{/}}后缀");
  });
});
