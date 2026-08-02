import { describe, expect, it, vi } from "vitest";

import {
  findPro2CharacterThreeViewNodeForRow,
  findPro2FrameImageNodeForRow,
  maybeClearHubPendingSceneSyncGroup,
} from "@/lib/canvas/pro2-group-row-resolve";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function charColumn(id: string, pendingGroupId?: string): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-character",
    position: { x: 0, y: 0 },
    data: pendingGroupId
      ? { pro2PendingSyncGroupId: pendingGroupId }
      : {},
  };
}

function threeViewNode(
  id: string,
  columnId: string,
  rowKey: string,
  groupId: string,
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-three-view",
    parentId: groupId,
    position: { x: 0, y: 0 },
    data: {
      pro2ControllerNodeId: columnId,
      pro2RowKey: rowKey,
      pro2GroupId: groupId,
    },
  };
}

describe("findPro2CharacterThreeViewNodeForRow", () => {
  it("returns node in pending sync group when multiple groups exist", () => {
    const columnId = "col-char";
    const group1 = "grp-1";
    const group2 = "grp-2";
    const nodes: CanvasFlowNode[] = [
      charColumn(columnId, group2),
      threeViewNode("tv-g1", columnId, "hero", group1),
      threeViewNode("tv-g2", columnId, "hero", group2),
    ];
    expect(
      findPro2CharacterThreeViewNodeForRow(nodes, columnId, "hero")?.id,
    ).toBe("tv-g2");
  });

  it("falls back to first match when no pending group", () => {
    const columnId = "col-char";
    const group1 = "grp-1";
    const group2 = "grp-2";
    const nodes: CanvasFlowNode[] = [
      charColumn(columnId),
      threeViewNode("tv-g1", columnId, "hero", group1),
      threeViewNode("tv-g2", columnId, "hero", group2),
    ];
    expect(
      findPro2CharacterThreeViewNodeForRow(nodes, columnId, "hero")?.id,
    ).toBe("tv-g1");
  });
});

describe("findPro2FrameImageNodeForRow", () => {
  it("scopes to pending sync group", () => {
    const columnId = "col-frame";
    const group1 = "grp-f1";
    const group2 = "grp-f2";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-frame",
        position: { x: 0, y: 0 },
        data: { pro2PendingSyncGroupId: group2 },
      },
      {
        id: "img-g1",
        type: "story-pro2-image",
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "f1",
          pro2GroupId: group1,
          pro2MediaRole: "frame",
        },
      },
      {
        id: "img-g2",
        type: "story-pro2-image",
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "f1",
          pro2GroupId: group2,
          pro2MediaRole: "frame",
        },
      },
    ];
    expect(findPro2FrameImageNodeForRow(nodes, columnId, "f1")?.id).toBe(
      "img-g2",
    );
  });
});

describe("maybeClearHubPendingSceneSyncGroup", () => {
  it("clears hub pending when last scene image in group completes", () => {
    const hubId = "hub-1";
    const groupId = "scene-g1";
    const nodes: CanvasFlowNode[] = [
      {
        id: hubId,
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: { pro2PendingSyncSceneGroupId: groupId },
      },
      {
        id: "s-done",
        type: "story-pro2-image",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2HubNodeId: hubId,
          pro2MediaRole: "scene",
          pro2GroupId: groupId,
          runtime: { status: "done" },
        },
      },
    ];
    const updateNodeData = vi.fn();
    maybeClearHubPendingSceneSyncGroup(nodes, "s-done", updateNodeData);
    expect(updateNodeData).toHaveBeenCalledWith(hubId, {
      pro2PendingSyncSceneGroupId: undefined,
    });
  });

  it("keeps pending while another scene image is still running", () => {
    const hubId = "hub-1";
    const groupId = "scene-g1";
    const nodes: CanvasFlowNode[] = [
      {
        id: hubId,
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: { pro2PendingSyncSceneGroupId: groupId },
      },
      {
        id: "s-done",
        type: "story-pro2-image",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2HubNodeId: hubId,
          pro2MediaRole: "scene",
          pro2GroupId: groupId,
          runtime: { status: "done" },
        },
      },
      {
        id: "s-run",
        type: "story-pro2-image",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2HubNodeId: hubId,
          pro2MediaRole: "scene",
          pro2GroupId: groupId,
          runtime: { status: "running" },
        },
      },
    ];
    const updateNodeData = vi.fn();
    maybeClearHubPendingSceneSyncGroup(nodes, "s-done", updateNodeData);
    expect(updateNodeData).not.toHaveBeenCalled();
  });
});
