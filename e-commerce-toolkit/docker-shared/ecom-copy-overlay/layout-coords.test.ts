import { describe, expect, it } from "vitest";

import { computeImageContainRect } from "./layout-coords";

describe("computeImageContainRect", () => {
  it("letterboxes wide image in tall frame", () => {
    const r = computeImageContainRect(320, 400, 750, 1000);
    expect(r.w).toBeCloseTo(320);
    expect(r.h).toBeCloseTo(320 * (1000 / 750));
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeGreaterThan(0);
  });

  it("centers square image in wide frame", () => {
    const r = computeImageContainRect(400, 300, 1000, 1000);
    expect(r.w).toBe(300);
    expect(r.h).toBe(300);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(0);
  });
});
