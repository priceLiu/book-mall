import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countLibtvSelectedNonGroupNodes,
  resolveLibtvFloatingDockSelection,
  resolveLibtvSoleSelectedNodeId,
} from "@/lib/canvas/libtv-floating-dock-selection";

vi.mock("@/lib/canvas/libtv-detail-editor-open", () => ({
  libtvDetailEditorOpenForNode: () => false,
}));

const rf = (
  entries: { id: string; type: string; selected?: boolean }[],
) => entries.map((e) => ({ ...e, selected: e.selected ?? false }));

describe("resolveLibtvSoleSelectedNodeId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns RF sole selection when type matches", () => {
    const nodes = rf([
      { id: "a", type: "sbv1-image", selected: true },
      { id: "b", type: "story-pro2-image", selected: false },
    ]);
    expect(
      resolveLibtvSoleSelectedNodeId(nodes, "sbv1-image", {
        nodeId: null,
        nodeType: null,
      }),
    ).toBe("a");
  });

  it("does not use pin when RF selection is empty", () => {
    const nodes = rf([
      { id: "img1", type: "sbv1-image", selected: false },
      { id: "img2", type: "story-pro2-image", selected: false },
    ]);
    expect(resolveLibtvFloatingDockSelection(nodes)).toBeNull();
    expect(
      resolveLibtvSoleSelectedNodeId(nodes, "sbv1-image", {
        nodeId: "img1",
        nodeType: "sbv1-image",
      }),
    ).toBeNull();
  });

  it("does not use pin when RF has a different sole selection", () => {
    const nodes = rf([
      { id: "img1", type: "sbv1-image", selected: false },
      { id: "img2", type: "sbv1-image", selected: true },
    ]);
    expect(
      resolveLibtvSoleSelectedNodeId(nodes, "sbv1-image", {
        nodeId: "img1",
        nodeType: "sbv1-image",
      }),
    ).toBe("img2");
  });

  it("returns null on multi-select", () => {
    const nodes = rf([
      { id: "a", type: "sbv1-image", selected: true },
      { id: "b", type: "sbv1-image", selected: true },
    ]);
    expect(countLibtvSelectedNonGroupNodes(nodes)).toBe(2);
    expect(
      resolveLibtvSoleSelectedNodeId(nodes, "sbv1-image", {
        nodeId: "a",
        nodeType: "sbv1-image",
      }),
    ).toBeNull();
  });

  it("returns null while marquee selecting", () => {
    const nodes = rf([{ id: "a", type: "sbv1-image", selected: true }]);
    expect(
      resolveLibtvSoleSelectedNodeId(
        nodes,
        "sbv1-image",
        { nodeId: "a", nodeType: "sbv1-image" },
        { marqueeSelecting: true },
      ),
    ).toBeNull();
  });

  it("ignores pin when node type mismatches", () => {
    const nodes = rf([{ id: "a", type: "story-pro2-image", selected: false }]);
    expect(
      resolveLibtvSoleSelectedNodeId(nodes, "sbv1-image", {
        nodeId: "a",
        nodeType: "story-pro2-image",
      }),
    ).toBeNull();
  });
});
