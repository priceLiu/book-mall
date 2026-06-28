import { describe, expect, it } from "vitest";
import { canvasProjectEditionFromGraph } from "@/lib/canvas/project-edition-detect";

describe("canvasProjectEditionFromGraph", () => {
  it("detects pro2 from graph.meta when nodes are empty", () => {
    expect(
      canvasProjectEditionFromGraph({
        schemaVersion: 3,
        nodes: [],
        edges: [],
        meta: {
          edition: "pro2",
          crewBulletinAnchor: {
            linkedScriptPackageAssetId: "pkg-1",
            crewBulletin: { tasks: [], scriptTitle: "x", totalEpisodes: 1, publishedAt: "" },
          },
        },
      }),
    ).toBe("pro2");
  });

  it("falls back to standard for empty graph without meta", () => {
    expect(
      canvasProjectEditionFromGraph({
        schemaVersion: 2,
        nodes: [],
        edges: [],
      }),
    ).toBe("standard");
  });
});
