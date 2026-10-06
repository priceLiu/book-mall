import { describe, expect, it } from "vitest";

import {
  assertCanvasVideoTrimOutputDurationForTest,
  trimDurationSlackSecForTest,
} from "@/lib/canvas-video-edit/canvas-video-trim-assert";

describe("canvas video trim duration assert", () => {
  it("accepts output within slack", () => {
    expect(
      assertCanvasVideoTrimOutputDurationForTest(5.1, 5, 15),
    ).toBe(5.1);
  });

  it("rejects full-length output when clip should be shorter", () => {
    expect(() =>
      assertCanvasVideoTrimOutputDurationForTest(14.8, 5, 15),
    ).toThrow(/仍为全长/);
  });

  it("slack scales with clip length", () => {
    expect(trimDurationSlackSecForTest(2)).toBeGreaterThanOrEqual(0.55);
    expect(trimDurationSlackSecForTest(30)).toBe(3);
  });
});
