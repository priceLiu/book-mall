import { describe, expect, it, vi } from "vitest";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { restoreServerInflightNodeRuntimes } from "@/lib/canvas/restore-server-inflight-node-runtimes";
import {
  hubHasServerInflightLlmTask,
  hubNodeLocalRuntimeForTaskPick,
  pickPreferredCanvasTask,
  pickPreferredCanvasTaskForScope,
  preferredTasksByNode,
  pickStoryRowApplyTask,
  shouldSkipStoryRowTaskApply,
} from "@/lib/canvas/task-pick";
import { shouldRestoreSbv1VideoRuntimeToDone } from "@/lib/canvas/sbv1-image-task-apply";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();

function task(
  partial: Partial<CanvasTaskRecord> & Pick<CanvasTaskRecord, "id" | "status">,
): CanvasTaskRecord {
  return {
    nodeId: "node-1",
    model: "happyhorse-1.0-r2v",
    createdAt: minsAgo(30),
    updatedAt: minsAgo(5),
    ...partial,
  } as CanvasTaskRecord;
}

describe("pickPreferredCanvasTask", () => {
  it("prefers succeeded video over newer failed retry", () => {
    const pick = pickPreferredCanvasTask([
      task({
        id: "ok",
        status: "SUCCEEDED",
        updatedAt: minsAgo(10),
        ossUrl: "https://cdn.example/ok.mp4",
      }),
      task({
        id: "fail",
        status: "FAILED",
        updatedAt: minsAgo(2),
        failCode: "timeout_poll_error",
        failMessage: "gateway recordInfo timeout",
      }),
    ]);
    expect(pick?.id).toBe("ok");
  });

  it("prefers bound SUCCEEDED task when local runtime still running", () => {
    const pick = pickPreferredCanvasTask(
      [
        task({
          id: "done",
          status: "SUCCEEDED",
          updatedAt: minsAgo(10),
          completedAt: minsAgo(10),
          ossUrl: "https://cdn.example/ok.png",
        }),
        task({
          id: "other",
          status: "SUBMITTED",
          updatedAt: minsAgo(1),
          submittedAt: minsAgo(1),
        }),
      ],
      { localRuntime: { status: "running", taskId: "done" } },
    );
    expect(pick?.id).toBe("done");
  });

  it("does not pick stale SUCCEEDED when local pending without taskId", () => {
    const pick = pickPreferredCanvasTask(
      [
        task({
          id: "old",
          status: "SUCCEEDED",
          updatedAt: minsAgo(20),
          ossUrl: "https://cdn.example/old.png",
        }),
      ],
      { localRuntime: { status: "pending" } },
    );
    expect(pick).toBeUndefined();
  });

  it("prefers server inflight when local pending without taskId", () => {
    const pick = pickPreferredCanvasTask(
      [
        task({
          id: "old",
          status: "SUCCEEDED",
          updatedAt: minsAgo(20),
          ossUrl: "https://cdn.example/old.png",
        }),
        task({
          id: "new",
          status: "SUBMITTED",
          updatedAt: minsAgo(1),
          submittedAt: minsAgo(1),
        }),
      ],
      { localRuntime: { status: "pending" } },
    );
    expect(pick?.id).toBe("new");
  });

  it("pickPreferredCanvasTaskForScope forwards local pending runtime", () => {
    const pick = pickPreferredCanvasTaskForScope(
      [
        task({
          id: "old-char",
          status: "SUCCEEDED",
          llmSection: "character",
          updatedAt: minsAgo(15),
          textOutput: "| 角色 | 描述 |",
        }),
      ],
      { llmSection: "character" },
      { status: "pending" },
    );
    expect(pick).toBeUndefined();
  });

  it("prefers bound FAILED over older SUCCEEDED when local runtime is error", () => {
    const pick = pickPreferredCanvasTask(
      [
        task({
          id: "old-ok",
          status: "SUCCEEDED",
          updatedAt: minsAgo(10),
          ossUrl: "https://cdn.example/ok.mp4",
        }),
        task({
          id: "new-fail",
          status: "FAILED",
          updatedAt: minsAgo(1),
          failCode: "FAILED",
          failMessage:
            "Output data is suspected of being involved in IP infringement",
        }),
      ],
      { localRuntime: { status: "error", taskId: "new-fail" } },
    );
    expect(pick?.id).toBe("new-fail");
  });

  it("prefers bound FAILED over older SUCCEEDED when local row still pending", () => {
    const pick = pickPreferredCanvasTaskForScope(
      [
        task({
          id: "old-ok",
          status: "SUCCEEDED",
          updatedAt: minsAgo(12),
          ossUrl: "https://cdn.example/old.png",
          storyScope: { rowKey: "沈知意", mediaKind: "threeView" },
        }),
        task({
          id: "new-fail",
          status: "FAILED",
          updatedAt: minsAgo(2),
          failMessage: "prompt too long",
          storyScope: { rowKey: "沈知意", mediaKind: "threeView" },
        }),
      ],
      { rowKey: "沈知意", mediaKind: "threeView" },
      { status: "pending", taskId: "new-fail" },
      "n_XJ1uOoTH",
    );
    expect(pick?.id).toBe("new-fail");
  });
});

describe("shouldSkipStoryRowTaskApply", () => {
  it("does not skip SUCCEEDED without preview URL when local pending without taskId", () => {
    expect(
      shouldSkipStoryRowTaskApply(
        { status: "pending" },
        task({
          id: "done-no-url",
          status: "SUCCEEDED",
          updatedAt: minsAgo(1),
          completedAt: minsAgo(1),
        }),
        "node-1",
      ),
    ).toBe(false);
  });
});

describe("pickStoryRowApplyTask", () => {
  it("prefers SUCCEEDED over bound stale SUBMITTED in same scope", () => {
    const pick = pickStoryRowApplyTask(
      [
        task({
          id: "stale-sub",
          status: "SUBMITTED",
          updatedAt: minsAgo(2),
          submittedAt: minsAgo(2),
          storyScope: { rowKey: "hero", mediaKind: "threeView" },
        }),
        task({
          id: "done",
          status: "SUCCEEDED",
          updatedAt: minsAgo(1),
          completedAt: minsAgo(1),
          ossUrl: "https://cdn.example/hero.png",
          storyScope: { rowKey: "hero", mediaKind: "threeView" },
        }),
      ],
      { rowKey: "hero", mediaKind: "threeView" },
      { status: "running", taskId: "stale-sub" },
    );
    expect(pick?.id).toBe("done");
  });

  it("prefers bound FAILED over older SUCCEEDED when local runtime is error", () => {
    const pick = pickStoryRowApplyTask(
      [
        task({
          id: "old-ok",
          status: "SUCCEEDED",
          updatedAt: minsAgo(10),
          ossUrl: "https://cdn.example/ok.mp4",
          storyScope: { rowKey: "shot-1", mediaKind: "video" },
        }),
        task({
          id: "new-fail",
          status: "FAILED",
          updatedAt: minsAgo(1),
          failMessage:
            "Output data is suspected of being involved in IP infringement",
          storyScope: { rowKey: "shot-1", mediaKind: "video" },
        }),
      ],
      { rowKey: "shot-1", mediaKind: "video" },
      { status: "error", taskId: "new-fail" },
    );
    expect(pick?.id).toBe("new-fail");
  });
});

describe("restoreServerInflightNodeRuntimes", () => {
  it("sbv1-video-engine idle 时从服务端 SUBMITTED 恢复 running", () => {
    const node: CanvasFlowNode = {
      id: "video-1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: { runtime: { status: "idle" } },
    };
    const updateNodeData = vi.fn();
    restoreServerInflightNodeRuntimes(
      [node],
      [
        task({
          id: "task-1",
          nodeId: "video-1",
          status: "SUBMITTED",
          submittedAt: minsAgo(1),
        }),
      ],
      updateNodeData,
      vi.fn(),
    );
    expect(updateNodeData).toHaveBeenCalledWith(
      "video-1",
      expect.objectContaining({
        runtime: expect.objectContaining({
          status: "running",
          taskId: "task-1",
        }),
      }),
    );
  });

  it("已有成片时仍把服务端进行中任务挂回生图节点", () => {
    const node: CanvasFlowNode = {
      id: "img-1",
      type: "sbv1-image",
      position: { x: 0, y: 0 },
      data: {
        ossUrl: "https://cdn.example/old.png",
        runtime: {
          status: "done",
          ossUrl: "https://cdn.example/old.png",
        },
      },
    };
    const updateNodeData = vi.fn();
    restoreServerInflightNodeRuntimes(
      [node],
      [
        task({
          id: "old-ok",
          nodeId: "img-1",
          status: "SUCCEEDED",
          completedAt: minsAgo(20),
          updatedAt: minsAgo(20),
          ossUrl: "https://cdn.example/old.png",
        }),
        task({
          id: "regen",
          nodeId: "img-1",
          status: "DISPATCHING",
          createdAt: minsAgo(1),
          submittedAt: minsAgo(1),
        }),
      ],
      updateNodeData,
      vi.fn(),
    );
    expect(updateNodeData).toHaveBeenCalledWith(
      "img-1",
      expect.objectContaining({
        runtime: expect.objectContaining({
          status: "pending",
          taskId: "regen",
        }),
      }),
    );
  });

  it("已有成片时仍把服务端进行中任务挂回生视频节点", () => {
    const node: CanvasFlowNode = {
      id: "video-1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: {
        runtime: {
          status: "idle",
          ossUrl: "https://cdn.example/old.mp4",
        },
      },
    };
    const updateNodeData = vi.fn();
    restoreServerInflightNodeRuntimes(
      [node],
      [
        task({
          id: "regen-v",
          nodeId: "video-1",
          status: "QUEUED",
          createdAt: minsAgo(1),
        }),
      ],
      updateNodeData,
      vi.fn(),
    );
    expect(updateNodeData).toHaveBeenCalledWith(
      "video-1",
      expect.objectContaining({
        runtime: expect.objectContaining({
          status: "pending",
          taskId: "regen-v",
        }),
      }),
    );
  });
});

describe("script hub task pick", () => {
  it("hubNodeLocalRuntimeForTaskPick reads section pending runtime", () => {
    const node: CanvasFlowNode = {
      id: "hub-1",
      type: "story-pro2-script-hub",
      data: {
        outlineRuntime: { status: "pending" },
        characterRuntime: { status: "done", taskId: "old" },
      },
      position: { x: 0, y: 0 },
    };
    expect(hubNodeLocalRuntimeForTaskPick(node)?.status).toBe("pending");
  });

  it("preferredTasksByNode prefers inflight over stale SUCCEEDED for hub", () => {
    const node: CanvasFlowNode = {
      id: "hub-1",
      type: "story-pro2-script-hub",
      data: { outlineRuntime: { status: "pending" } },
      position: { x: 0, y: 0 },
    };
    const pick = preferredTasksByNode(
      [
        task({
          id: "old-done",
          nodeId: "hub-1",
          status: "SUCCEEDED",
          updatedAt: minsAgo(30),
          textOutput: "done",
          storyScope: { llmSection: "outline" },
        }),
        task({
          id: "new-run",
          nodeId: "hub-1",
          status: "SUBMITTED",
          updatedAt: minsAgo(1),
          submittedAt: minsAgo(1),
          storyScope: { llmSection: "outline" },
        }),
      ],
      [node],
    ).get("hub-1");
    expect(pick?.id).toBe("new-run");
  });

  it("hubHasServerInflightLlmTask detects active hub LLM tasks", () => {
    const tasks = [
      task({
        id: "run-1",
        nodeId: "hub-1",
        status: "SUBMITTED",
        updatedAt: minsAgo(1),
      }),
    ];
    expect(hubHasServerInflightLlmTask("hub-1", tasks)).toBe(true);
    expect(hubHasServerInflightLlmTask("hub-2", tasks)).toBe(false);
  });
});

describe("shouldRestoreSbv1VideoRuntimeToDone", () => {
  it("does not restore error just because an older video exists", () => {
    expect(
      shouldRestoreSbv1VideoRuntimeToDone({
        status: "error",
        hasInflightTask: false,
        uploading: false,
        runSessionActive: false,
        currentMediaUrl: "",
        boundTaskSucceeded: false,
      }),
    ).toBe(false);
  });

  it("does not restore pending when only historical video exists", () => {
    expect(
      shouldRestoreSbv1VideoRuntimeToDone({
        status: "pending",
        hasInflightTask: false,
        uploading: false,
        runSessionActive: false,
        currentMediaUrl: "",
        boundTaskSucceeded: false,
      }),
    ).toBe(false);
  });

  it("restores pending when this generation already succeeded", () => {
    expect(
      shouldRestoreSbv1VideoRuntimeToDone({
        status: "pending",
        hasInflightTask: false,
        uploading: false,
        runSessionActive: false,
        currentMediaUrl: "",
        boundTaskSucceeded: true,
      }),
    ).toBe(true);
  });
});
