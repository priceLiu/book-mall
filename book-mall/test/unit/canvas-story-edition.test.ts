import { describe, expect, it } from "vitest";
import {
  canvasProjectEditionFromListHints,
  canvasProjectHasCollaboration,
} from "@/lib/canvas/canvas-story-edition";

describe("canvasProjectEditionFromListHints", () => {
  it("detects pro2 from meta without full canvas", () => {
    expect(
      canvasProjectEditionFromListHints(
        { edition: "pro2", crewBulletinAnchor: { tasks: [] } },
        [],
      ),
    ).toBe("pro2");
  });

  it("falls back to node types when meta has no edition", () => {
    expect(
      canvasProjectEditionFromListHints(null, ["story-pro2-frame"]),
    ).toBe("pro2");
  });
});

describe("canvasProjectHasCollaboration", () => {
  it("locks when crew bulletin anchor exists", () => {
    expect(
      canvasProjectHasCollaboration({
        crewBulletinAnchor: { tasks: [] },
      }),
    ).toBe(true);
  });

  it("locks when linked script package id exists", () => {
    expect(
      canvasProjectHasCollaboration({
        linkedScriptPackageAssetId: "pkg-1",
      }),
    ).toBe(true);
  });

  it("does not lock plain pro2 meta", () => {
    expect(canvasProjectHasCollaboration({ edition: "pro2" })).toBe(false);
  });
});
