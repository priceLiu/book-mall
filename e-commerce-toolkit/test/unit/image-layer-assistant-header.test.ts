import { describe, expect, it } from "vitest";

import { resolveImageLayerAssistantHeader } from "@/lib/image-layer-assistant-header";

describe("resolveImageLayerAssistantHeader", () => {
  it("describes 背景与主体 for later reuse after 模特换装", () => {
    expect(resolveImageLayerAssistantHeader("bg-replace", true).title).toBe("背景与主体");
    expect(resolveImageLayerAssistantHeader("bg-replace", false).description).toMatch(
      /Seedream/,
    );
  });
});
