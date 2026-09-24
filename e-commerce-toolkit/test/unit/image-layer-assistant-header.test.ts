import { describe, expect, it } from "vitest";

import { resolveImageLayerAssistantHeader } from "@/lib/image-layer-assistant-header";

describe("resolveImageLayerAssistantHeader", () => {
  it("describes 换背景 for later reuse after 模特换装", () => {
    expect(resolveImageLayerAssistantHeader("bg-replace", true).title).toBe("换背景");
    expect(resolveImageLayerAssistantHeader("bg-replace", false).description).toMatch(
      /右边/,
    );
  });
});
