import { describe, expect, it } from "vitest";

import {
  normalizeEcomStoryboardVideoModelKey,
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";

describe("normalizeEcomStoryboardVideoModelKey", () => {
  it("maps HappyHorse / Wan T2V to R2V for reference-based ecom video", () => {
    expect(normalizeEcomStoryboardVideoModelKey("happyhorse-1.1-t2v")).toBe(
      "happyhorse-1.1-r2v",
    );
    expect(normalizeEcomStoryboardVideoModelKey("wan2.7-t2v")).toBe("wan2.7-r2v");
  });

  it("maps HappyHorse I2V to R2V", () => {
    expect(normalizeEcomStoryboardVideoModelKey("happyhorse-1.1-i2v")).toBe(
      "happyhorse-1.1-r2v",
    );
  });
});

describe("resolveStoryboardVideoModel", () => {
  it("resolves HappyHorse 1.1 T2V to bailian R2V (not Volcengine fallback)", () => {
    const modelKey = resolveStoryboardVideoModel("happyhorse-1.1-t2v");
    expect(modelKey).toBe("happyhorse-1.1-r2v");
    expect(resolveStoryboardVideoProvider(modelKey)).toBe("bailian");
  });

  it("throws for unknown model instead of silent doubao-seedance", () => {
    expect(() => resolveStoryboardVideoModel("not-a-real-model")).toThrow(
      /暂不支持电商分镜成片/,
    );
  });
});
