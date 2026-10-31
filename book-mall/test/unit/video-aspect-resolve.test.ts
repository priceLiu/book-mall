import { describe, expect, it } from "vitest";

import { resolveCanvasVideoAspectRatio } from "@/lib/canvas/video-aspect-resolve";

describe("resolveCanvasVideoAspectRatio", () => {
  it("prefers node aspect over stale params adaptive", () => {
    expect(
      resolveCanvasVideoAspectRatio(
        { ratio: "adaptive", aspect_ratio: "adaptive" },
        "16:9",
      ),
    ).toBe("16:9");
  });

  it("uses params when node aspect missing", () => {
    expect(resolveCanvasVideoAspectRatio({ ratio: "9:16" }, undefined)).toBe(
      "9:16",
    );
  });
});
