import { describe, expect, it } from "vitest";

import {
  hubAggregateStatus,
  hubSectionIsRunning,
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
  it("pending without taskId is not running (queued for sequential pipeline)", () => {
    const node = hubNode({
      storyboardRuntime: { status: "pending" },
      storyboardMd: "",
    });
    expect(hubSectionIsRunning(node, "storyboard")).toBe(false);
  });

  it("pending with taskId counts as running", () => {
    const node = hubNode({
      storyboardRuntime: { status: "pending", taskId: "t-1" },
    });
    expect(hubSectionIsRunning(node, "storyboard")).toBe(true);
  });

  it("aggregate running only when a section is actively submitted", () => {
    const node = hubNode({
      outlineRuntime: { status: "done", taskId: "t-outline" },
      outlineMd: "# 大纲",
      characterRuntime: { status: "pending" },
      sceneRuntime: { status: "pending" },
      storyboardRuntime: { status: "pending" },
      storyboardMd: "| 镜号 | 场景 |\n| --- | --- |",
    });
    expect(hubAggregateStatus(node)).not.toBe("running");
  });
});
