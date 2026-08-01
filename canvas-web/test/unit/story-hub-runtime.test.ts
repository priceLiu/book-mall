import { describe, expect, it } from "vitest";

import {
  hubAggregateStatus,
  hubSectionCountsAsInflight,
  hubSectionHasTerminalError,
  hubSectionIsReady,
  hubSectionIsRunning,
  clearHubSectionMdForForceFresh,
  clearHubSectionRuntimesForForceFresh,
} from "@/lib/canvas/story-hub-runtime";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function hubNode(
  data: Record<string, unknown>,
  id = "hub-1",
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
    data,
  };
}

describe("hubSectionIsRunning", () => {
  it("pending without taskId counts as running (optimistic enqueue)", () => {
    const node = hubNode({
      storyboardRuntime: { status: "pending" },
      storyboardMd: "",
    });
    expect(hubSectionIsRunning(node, "storyboard")).toBe(true);
    expect(hubAggregateStatus(node)).toBe("running");
  });

  it("pending with taskId counts as running", () => {
    const node = hubNode({
      storyboardRuntime: { status: "pending", taskId: "t-1" },
    });
    expect(hubSectionIsRunning(node, "storyboard")).toBe(true);
  });

  it("aggregate running when sequential chain has pending sections", () => {
    const node = hubNode({
      outlineRuntime: { status: "done", taskId: "t-outline" },
      outlineMd: "# 大纲",
      characterRuntime: { status: "pending" },
      sceneRuntime: { status: "pending" },
      storyboardRuntime: { status: "pending" },
      storyboardMd: "| 镜号 | 场景 |\n| --- | --- |",
    });
    expect(hubAggregateStatus(node)).toBe("running");
  });
});

describe("hubSectionHasTerminalError", () => {
  it("detects section error runtime", () => {
    const node = hubNode({ characterRuntime: { status: "error" } });
    expect(hubSectionHasTerminalError(node, "character")).toBe(true);
    expect(hubSectionHasTerminalError(node, "scene")).toBe(false);
  });
});

describe("hubSectionCountsAsInflight", () => {
  it("ignores pending without taskId", () => {
    expect(hubSectionCountsAsInflight({ status: "pending" })).toBe(false);
    expect(
      hubSectionCountsAsInflight({ status: "pending", taskId: "t1" }),
    ).toBe(true);
  });
});

describe("clearHubSectionRuntimesForForceFresh", () => {
  it("clears only requested sections", () => {
    expect(
      clearHubSectionRuntimesForForceFresh(["character", "storyboard"]),
    ).toEqual({
      characterRuntime: undefined,
      storyboardRuntime: undefined,
    });
  });
});

describe("clearHubSectionMdForForceFresh", () => {
  it("clears only requested section markdown fields", () => {
    expect(
      clearHubSectionMdForForceFresh(["character", "storyboard"]),
    ).toEqual({
      characterMd: "",
      storyboardMd: "",
    });
  });
});

describe("hubSectionIsReady", () => {
  it("does not treat outline-embedded pack as complete when dedicated fields are empty", () => {
    const node = hubNode({
      outlineMd: [
        "# 故事大纲",
        "",
        "## 角色设定",
        "| 角色 | 描述 |",
        "| --- | --- |",
        "| 女主 | 测试 |",
      ].join("\n"),
      characterMd: "",
      sceneMd: "",
      storyboardMd: "",
    });
    expect(hubSectionIsReady(node, "character")).toBe(false);
    expect(hubSectionIsReady(node, "scene")).toBe(false);
    expect(hubSectionIsReady(node, "storyboard")).toBe(false);
    expect(hubAggregateStatus(node)).toBe("idle");
  });

  it("returns true when dedicated markdown exists and runtime is idle", () => {
    const node = hubNode({
      outlineMd: "# 故事大纲",
      characterMd: "| 角色 | 描述 |\n| --- | --- |\n| 女主 | 测试 |",
      sceneMd: "| 场景 | 描述 |\n| --- | --- |\n| 堂屋 | 测试 |",
      storyboardMd:
        "| 镜号 | 场景 | 台词 |\n| --- | --- | --- |\n| 1 | 堂屋 | 你好 |",
    });
    expect(hubSectionIsReady(node, "character")).toBe(true);
    expect(hubSectionIsReady(node, "scene")).toBe(true);
    expect(hubSectionIsReady(node, "storyboard")).toBe(true);
  });
});
