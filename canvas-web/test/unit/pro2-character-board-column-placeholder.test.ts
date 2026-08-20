import { describe, expect, it } from "vitest";

import { isPro2CharacterBoardColumnVisualPlaceholder } from "@/lib/canvas/pro2-resolve-character-board-group";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("isPro2CharacterBoardColumnVisualPlaceholder", () => {
  const columnId = "char-col";

  it("returns false when no media group is linked", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { rows: [] },
      },
    ];
    expect(isPro2CharacterBoardColumnVisualPlaceholder(columnId, nodes)).toBe(
      false,
    );
  });

  it("returns true when pro2PendingSyncGroupId is set", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { pro2PendingSyncGroupId: "grp-1", rows: [] },
      },
      {
        id: "grp-1",
        type: "group",
        position: { x: 0, y: 0 },
        data: { pro2Kind: "character-board" },
      },
    ];
    expect(isPro2CharacterBoardColumnVisualPlaceholder(columnId, nodes)).toBe(
      true,
    );
  });

  it("returns true when group is linked via pro2ControllerNodeId", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { rows: [] },
      },
      {
        id: "grp-2",
        type: "group",
        position: { x: 0, y: 0 },
        data: { pro2ControllerNodeId: columnId, pro2Kind: "character-board" },
      },
    ];
    expect(isPro2CharacterBoardColumnVisualPlaceholder(columnId, nodes)).toBe(
      true,
    );
  });
});
