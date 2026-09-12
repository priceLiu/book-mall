import { describe, expect, it } from "vitest";

import { resolveCanvasEdgeFocusTone } from "@/components/canvas/edges/canvas-edge-focus-context";

describe("resolveCanvasEdgeFocusTone", () => {
  it("returns up when target is in focus set", () => {
    const focus = new Set(["child", "group"]);
    expect(resolveCanvasEdgeFocusTone("src", "child", focus)).toBe("up");
  });

  it("returns down when source is in focus set", () => {
    const focus = new Set(["src"]);
    expect(resolveCanvasEdgeFocusTone("src", "child", focus)).toBe("down");
  });

  it("returns null when focus is empty or missing", () => {
    expect(resolveCanvasEdgeFocusTone("src", "child", null)).toBeNull();
    expect(resolveCanvasEdgeFocusTone("src", "child", new Set())).toBeNull();
  });
});
