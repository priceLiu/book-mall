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
    expect(buildDecomposePrompt([])).toContain("完整图层语义分离");
  });

  it("buildEditPrompt", () => {
    expect(buildEditPrompt([1, 2, 3, 4], "改成红色")).toContain("<bbox>1 2 3 4</bbox>");
    expect(buildEditPrompt([1, 2, 3, 4], "改成红色")).toContain("改成红色");
  });
});
