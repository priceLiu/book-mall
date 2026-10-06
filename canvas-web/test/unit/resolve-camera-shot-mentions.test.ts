import { describe, expect, it } from "vitest";

import { resolveCameraShotTokensInPrompt } from "@/lib/canvas/resolve-camera-shot-mentions";

describe("resolveCameraShotTokensInPrompt", () => {
  it("expands cam token to scene + english prompt", () => {
    const id = "cam:01-缓慢推轨前进";
    const raw = `茶席 @<${id}> 结尾`;
    const out = resolveCameraShotTokensInPrompt(raw);
    expect(out).toContain("slow dolly forward");
    expect(out).toContain("茶席");
    expect(out).not.toContain(`@<${id}>`);
  });

  it("uses override scene when provided", () => {
    const id = "cam:01-缓慢推轨前进";
    const raw = `@<${id}>`;
    const out = resolveCameraShotTokensInPrompt(raw, {
      [id]: "自定义画面描述",
    });
    expect(out.startsWith("自定义画面描述")).toBe(true);
    expect(out).toContain("slow dolly forward");
  });
});
