import { describe, expect, it } from "vitest";

import { taskIdsWhoseLatestGatewayLogFailed } from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";

describe("taskIdsWhoseLatestGatewayLogFailed", () => {
  it("最新日志失败时返回该任务", () => {
    expect(
      taskIdsWhoseLatestGatewayLogFailed([
        { storyTaskId: "a", status: "FAILED" },
        { storyTaskId: "a", status: "RUNNING" },
        { storyTaskId: "b", status: "SUCCEEDED" },
      ]),
    ).toEqual(["a"]);
  });

  it("更新的进行中日志盖过更早的失败", () => {
    expect(
      taskIdsWhoseLatestGatewayLogFailed([
        { storyTaskId: "a", status: "RUNNING" },
        { storyTaskId: "a", status: "FAILED" },
      ]),
    ).toEqual([]);
  });
});
