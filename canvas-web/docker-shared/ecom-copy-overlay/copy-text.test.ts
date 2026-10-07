import { describe, expect, it } from "vitest";

import { defaultCopyOverlay, normalizeEcomCopyText, resolveEditorCopyText } from "./defaults";

describe("normalizeEcomCopyText", () => {
  it("preserves internal newlines", () => {
    expect(normalizeEcomCopyText("  国庆节，\r\n副标题  ")).toBe("国庆节，\n副标题");
  });
});

describe("resolveEditorCopyText", () => {
  it("prefers main layer text from overlay", () => {
    const overlay = defaultCopyOverlay("单行", 750);
    overlay.layers[0]!.text = "第一行\n第二行";
    expect(resolveEditorCopyText("单行", overlay)).toBe("第一行\n第二行");
  });
});
