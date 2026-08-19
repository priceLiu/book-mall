import { describe, expect, it, vi } from "vitest";

import {
  clearOrphanPro2ThreeViewInflightInGroup,
  clearPro2ThreeViewInflightOutsideSyncGroup,
  findPro2CharacterThreeViewNodeForRow,
  findPro2FrameImageNodeForRow,
  maybeClearHubPendingSceneSyncGroup,
  reconcilePro2ThreeViewNodesWithColumnRows,
  scopePro2CharacterSyncGroupForThreeViewNode,
} from "@/lib/canvas/pro2-group-row-resolve";
import { countCanvasInflightWork } from "@/lib/canvas/story-column-runtime";
import {
  isLibtvFreestandingImageNode,
  isPro2PipelineThreeViewCell,
} from "@/lib/canvas/libtv-image-node-run";
import { pickStoryRowApplyTask } from "@/lib/canvas/task-pick";
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

describe("clearOrphanPro2ThreeViewInflightInGroup", () => {
  it("does not clear column runtime for other rows still generating", () => {
    const columnId = "col-char";
    const groupId = "grp-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {
          pro2PendingSyncGroupId: groupId,
          rows: [
            {
              key: "a",
              name: "甲",
              role: "主角",
              appearance: "红袍",
              runtime: { status: "running" },
            },
            {
              key: "b",
              name: "乙",
              role: "配角",
              appearance: "蓝衣",
              runtime: { status: "pending" },
            },
          ],
        },
      },
      threeViewNode("tv-a", columnId, "a", groupId),
      {
        ...threeViewNode("tv-b", columnId, "b", groupId),
        data: {
          ...threeViewNode("tv-b", columnId, "b", groupId).data,
          uploading: true,
          runtime: { status: "pending" },
        },
      },
    ];
    const updateNodeData = vi.fn();
    clearOrphanPro2ThreeViewInflightInGroup(
      columnId,
      ["a"],
      nodes,
      updateNodeData,
    );
    expect(updateNodeData).not.toHaveBeenCalledWith(columnId, expect.anything());
    expect(updateNodeData).not.toHaveBeenCalledWith(
      "tv-b",
      expect.objectContaining({ uploading: false }),
    );
  });
});

describe("scopePro2CharacterSyncGroupForThreeViewNode", () => {
  it("sets pending sync group to the three-view node parent group", () => {
    const columnId = "col-char";
    const groupId = "grp-new";
    const nodes: CanvasFlowNode[] = [
      charColumn(columnId),
      threeViewNode("tv-1", columnId, "hero", groupId),
    ];
    const updateNodeData = vi.fn();
    const scoped = scopePro2CharacterSyncGroupForThreeViewNode(
      columnId,
      "tv-1",
      nodes,
      updateNodeData,
    );
    expect(scoped).toBe(groupId);
    expect(updateNodeData).toHaveBeenCalledWith(columnId, {
      pro2PendingSyncGroupId: groupId,
    });
  });
});

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

describe("reconcilePro2ThreeViewNodesWithColumnRows", () => {
  it("re-applies row error instead of clearing stale inflight on the node", () => {
    const columnId = "col-char";
    const groupId = "grp-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {
          pro2PendingSyncGroupId: groupId,
          rows: [
            {
              key: "hero",
              name: "主角",
              runtime: {
                status: "error",
                failCode: "REQUEST_FAILED",
                failMessage: "生图服务暂时不可用，请稍后重试。",
              },
            },
          ],
        },
      },
      {
        id: "tv-1",
        type: "story-pro2-three-view",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "hero",
          pro2GroupId: groupId,
          uploading: true,
          runtime: { status: "pending" },
        },
      },
    ];
    const updateNodeData = vi.fn();
    reconcilePro2ThreeViewNodesWithColumnRows(nodes, columnId, updateNodeData);
    expect(updateNodeData).toHaveBeenCalledWith("tv-1", {
      uploading: false,
      uploadError: "生图服务暂时不可用，请稍后重试。",
      runtime: {
        status: "error",
        failCode: "REQUEST_FAILED",
        failMessage: "生图服务暂时不可用，请稍后重试。",
      },
    });
    expect(updateNodeData).not.toHaveBeenCalledWith("tv-1", {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
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

describe("countCanvasInflightWork · character rows", () => {
  it("does not count stale column pending when group node already shows result", () => {
    const columnId = "col-char";
    const groupId = "grp-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {
          pro2PendingSyncGroupId: groupId,
          rows: [
            {
              key: "hero",
              name: "主角",
              runtime: {
                status: "pending",
                ossUrl: "https://cdn.example/hero.png",
              },
            },
            {
              key: "rival",
              name: "反派",
              runtime: {
                status: "pending",
                ossUrl: "https://cdn.example/rival.png",
              },
            },
          ],
        },
      },
      {
        id: "tv-hero",
        type: "story-pro2-three-view",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "hero",
          pro2GroupId: groupId,
          ossUrl: "https://cdn.example/hero.png",
          runtime: { status: "done", ossUrl: "https://cdn.example/hero.png" },
        },
      },
      {
        id: "tv-rival",
        type: "story-pro2-three-view",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "rival",
          pro2GroupId: groupId,
          ossUrl: "https://cdn.example/rival.png",
          runtime: { status: "done", ossUrl: "https://cdn.example/rival.png" },
        },
      },
    ];

    expect(countCanvasInflightWork(nodes)).toBe(0);
  });

  it("counts active batch regen when group node is still generating", () => {
    const columnId = "col-char";
    const groupId = "grp-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {
          pro2PendingSyncGroupId: groupId,
          rows: [
            {
              key: "hero",
              name: "主角",
              runtime: {
                status: "pending",
                ossUrl: "https://cdn.example/hero-old.png",
              },
            },
          ],
        },
      },
      {
        id: "tv-hero",
        type: "story-pro2-three-view",
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          pro2ControllerNodeId: columnId,
          pro2RowKey: "hero",
          pro2GroupId: groupId,
          ossUrl: "https://cdn.example/hero-old.png",
          uploading: true,
          runtime: { status: "pending", taskId: "task-1" },
        },
      },
    ];

    expect(countCanvasInflightWork(nodes)).toBe(1);
  });
});

describe("pickStoryRowApplyTask · threeView", () => {
  it("prefers newer SUCCEEDED over stale SUBMITTED when row is still pending", () => {
    const pick = pickStoryRowApplyTask(
      [
        {
          id: "stale-submitted",
          nodeId: "col",
          kind: "IMAGE",
          status: "SUBMITTED",
          model: "test",
          ossUrl: null,
          ephemeralUrl: null,
          textOutput: null,
          failCode: null,
          failMessage: null,
          submittedAt: "2026-08-02T15:20:00.000Z",
          completedAt: null,
          createdAt: "2026-08-02T15:20:00.000Z",
          updatedAt: "2026-08-02T15:25:00.000Z",
          kieTaskId: null,
          storyScope: { rowKey: "hero", mediaKind: "threeView" },
        },
        {
          id: "fresh-done",
          nodeId: "col",
          kind: "IMAGE",
          status: "SUCCEEDED",
          model: "test",
          ossUrl: "https://cdn.example/hero.png",
          ephemeralUrl: null,
          textOutput: null,
          failCode: null,
          failMessage: null,
          submittedAt: "2026-08-02T15:21:00.000Z",
          completedAt: "2026-08-02T15:29:00.000Z",
          createdAt: "2026-08-02T15:21:00.000Z",
          updatedAt: "2026-08-02T15:29:00.000Z",
          kieTaskId: null,
          storyScope: { rowKey: "hero", mediaKind: "threeView" },
        },
      ],
      { rowKey: "hero", mediaKind: "threeView" },
      { status: "pending" },
    );
    expect(pick?.id).toBe("fresh-done");
  });
});

describe("isPro2PipelineThreeViewCell", () => {
  it("treats hub column three-view cells as pipeline (not freestanding)", () => {
    const pipeline = {
      type: "story-pro2-three-view" as const,
      data: { pro2ControllerNodeId: "col-char" },
    };
    expect(isPro2PipelineThreeViewCell(pipeline)).toBe(true);
    expect(isLibtvFreestandingImageNode(pipeline)).toBe(false);
  });

  it("treats orphan three-view without controller as freestanding", () => {
    const orphan = {
      type: "story-pro2-three-view" as const,
      data: {},
    };
    expect(isPro2PipelineThreeViewCell(orphan)).toBe(false);
    expect(isLibtvFreestandingImageNode(orphan)).toBe(true);
  });
});

describe("clearPro2ThreeViewInflightOutsideSyncGroup", () => {
  it("clears stale inflight on old group while new group is pending sync", () => {
    const columnId = "col-char";
    const oldGroup = "grp-old";
    const newGroup = "grp-new";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { pro2PendingSyncGroupId: newGroup },
      },
      {
        ...threeViewNode("tv-old", columnId, "hero", oldGroup),
        data: {
          ...threeViewNode("tv-old", columnId, "hero", oldGroup).data,
          uploading: true,
          runtime: { status: "pending" },
        },
      },
      threeViewNode("tv-new", columnId, "hero", newGroup),
    ];
    const updateNodeData = vi.fn();
    clearPro2ThreeViewInflightOutsideSyncGroup(
      columnId,
      ["hero"],
      nodes,
      updateNodeData,
    );
    expect(updateNodeData).toHaveBeenCalledWith("tv-old", {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
    expect(updateNodeData).not.toHaveBeenCalledWith(
      "tv-new",
      expect.objectContaining({ uploading: false }),
    );
  });
});

describe("findPro2CharacterThreeViewNodeForRow · stale visual group", () => {
  it("falls back to the live character-board group when visual group id is stale", () => {
    const columnId = "col-char";
    const staleGroup = "grp-deleted";
    const liveGroup = "grp-live";
    const nodes: CanvasFlowNode[] = [
      {
        id: columnId,
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { pro2VisualGroupId: staleGroup },
      },
      {
        id: liveGroup,
        type: "group",
        position: { x: 0, y: 0 },
        data: { pro2Kind: "character-board" },
      },
      threeViewNode("tv-minister", columnId, "char-minister", liveGroup),
    ];
    const found = findPro2CharacterThreeViewNodeForRow(
      nodes,
      columnId,
      "char-minister",
    );
    expect(found?.id).toBe("tv-minister");
  });
});
