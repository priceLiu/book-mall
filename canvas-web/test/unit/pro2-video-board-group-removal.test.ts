import { describe, expect, it } from "vitest";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { applyPro2VideoBoardGroupRemoval } from "@/lib/canvas/pro2-spawn-video-board-group";

describe("applyPro2VideoBoardGroupRemoval", () => {
  it("marks video column dismissed and removes board cells when group deleted", () => {
    const groupId = "grp-video";
    const columnId = "col-video";
    const cellId = "cell-1";
    const prev: CanvasFlowNode[] = [
      {
        id: groupId,
        type: "group",
        position: { x: 0, y: 0 },
        data: { pro2Kind: "video-board", pro2ControllerNodeId: columnId },
      },
      {
        id: columnId,
        type: "story-pro2-video",
        position: { x: 0, y: 0 },
        data: { pro2VisualGroupId: groupId, rows: [{ key: "1", frameIndex: 1 }] },
      },
      {
        id: cellId,
        type: "sbv1-video-engine",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2MediaRole: "video",
          pro2ControllerNodeId: columnId,
          pro2GroupId: groupId,
          pro2RowKey: "1",
        },
      },
    ];
    const next = prev.filter((n) => n.id !== groupId);
    const patched = applyPro2VideoBoardGroupRemoval(prev, next);
    expect(patched.some((n) => n.id === groupId)).toBe(false);
    expect(patched.some((n) => n.id === cellId)).toBe(false);
    const column = patched.find((n) => n.id === columnId);
    expect(
      (column?.data as { pro2VisualGroupDismissed?: boolean })
        .pro2VisualGroupDismissed,
    ).toBe(true);
    expect(
      (column?.data as { pro2VisualGroupId?: string }).pro2VisualGroupId,
    ).toBeUndefined();
  });
});
