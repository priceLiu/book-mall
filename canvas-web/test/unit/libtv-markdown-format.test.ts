import { describe, expect, it } from "vitest";

import { applyMarkdownFormatAction } from "@/lib/canvas/libtv-markdown-format";

describe("libtv-markdown-format line scope", () => {
  it("applies heading to current line only when no selection", () => {
    const src = "第一行\n第二行\n第三行";
    const cursor = src.indexOf("第二");
    const result = applyMarkdownFormatAction("h2", src, cursor, cursor);
    expect(result.next).toBe("第一行\n## 第二行\n第三行");
  });

  it("clears format on current line only when no selection", () => {
    const src = "# 标题\n正文";
    const cursor = 0;
    const result = applyMarkdownFormatAction("clear", src, cursor, cursor);
    expect(result.next).toBe("标题\n正文");
  });
});
