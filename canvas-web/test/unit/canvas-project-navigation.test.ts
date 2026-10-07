import { describe, expect, it } from "vitest";

import {
  parseCanvasProjectIdFromPath,
  shouldRestoreCanvasHistoryLockOnPopstate,
} from "@/lib/canvas/canvas-project-navigation";

describe("canvas-project-navigation", () => {
  it("parses canvas project id from path", () => {
    expect(parseCanvasProjectIdFromPath("/canvas/abc")).toBe("abc");
    expect(parseCanvasProjectIdFromPath("/canvas/abc/")).toBe("abc");
    expect(parseCanvasProjectIdFromPath("/projects")).toBeNull();
  });

  it("detects wrong-canvas popstate", () => {
    expect(
      shouldRestoreCanvasHistoryLockOnPopstate(
        "/canvas/b",
        "/canvas/a",
      ),
    ).toBe(true);
    expect(
      shouldRestoreCanvasHistoryLockOnPopstate("/canvas/b", "/canvas/b"),
    ).toBe(false);
    expect(
      shouldRestoreCanvasHistoryLockOnPopstate("/canvas/b", "/projects"),
    ).toBe(false);
  });
});
