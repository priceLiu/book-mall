import { describe, expect, it } from "vitest";

import {
  buildDecomposePrompt,
  buildEditPrompt,
  clamp999,
  normalizedBbox,
} from "@/lib/image-layer-coords";

describe("image-layer-coords", () => {
  it("clamp999", () => {
    expect(clamp999(-5)).toBe(0);
    expect(clamp999(500)).toBe(500);
    expect(clamp999(1200)).toBe(999);
  });

  it("normalizedBbox", () => {
    expect(normalizedBbox(0, 0, 100, 200, 1000, 1000)).toEqual([0, 0, 100, 200]);
  });

  it("buildDecomposePrompt auto", () => {
    expect(buildDecomposePrompt([])).toContain("对图片做完整图层语义分离");
    expect(buildDecomposePrompt([])).toContain("从底图移除");
    expect(buildDecomposePrompt([])).toContain("房间环境保持不变");
  });

  it("buildDecomposePrompt multi bbox", () => {
    const prompt = buildDecomposePrompt([
      [10, 20, 90, 80],
      [100, 100, 200, 200],
    ]);
    expect(prompt).toContain("区域1<bbox>10 20 90 80</bbox>");
    expect(prompt).toContain("区域2<bbox>100 100 200 200</bbox>");
  });

  it("buildEditPrompt", () => {
    expect(buildEditPrompt([1, 2, 3, 4], "改成红色")).toContain("<bbox>1 2 3 4</bbox>");
    expect(buildEditPrompt([1, 2, 3, 4], "改成红色")).toContain("改成红色");
  });
});
