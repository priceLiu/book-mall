import { describe, expect, it } from "vitest";

import { resolveWan27MultiRefTargetDimensions } from "@/lib/ecom/ecom-dashscope-image-normalize";

describe("resolveWan27MultiRefTargetDimensions", () => {
  it("keeps width ≥240 on tall detail strips (151×4094)", () => {
    const { width, height } = resolveWan27MultiRefTargetDimensions(151, 4094);
    expect(width).toBeGreaterThanOrEqual(240);
    expect(height).toBeGreaterThanOrEqual(240);
    expect(height / width).toBeLessThanOrEqual(8);
    expect(width).toBeGreaterThanOrEqual(512);
    expect(height).toBe(4094);
    expect(height / width).toBeLessThanOrEqual(8.001);
  });
});
