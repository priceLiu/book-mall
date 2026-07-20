import { describe, expect, it } from "vitest";

import { isCanvasVideoPreGatewayLogTask } from "@/lib/canvas/canvas-queue-without-log";

describe("isCanvasVideoPreGatewayLogTask", () => {
  it("QUEUED / DISPATCHING / PENDING 视频任务计入待 Gateway log", () => {
    const payload = { kind: "video-engine", prompt: "test" };
    expect(isCanvasVideoPreGatewayLogTask({ status: "QUEUED", inputPayload: payload })).toBe(
      true,
    );
    expect(
      isCanvasVideoPreGatewayLogTask({ status: "DISPATCHING", inputPayload: payload }),
    ).toBe(true);
    expect(isCanvasVideoPreGatewayLogTask({ status: "PENDING", inputPayload: payload })).toBe(
      true,
    );
  });

  it("SUBMITTED 且无 gatewayLogId 仍计入（日志页可见窗口期）", () => {
    expect(
      isCanvasVideoPreGatewayLogTask({
        status: "SUBMITTED",
        inputPayload: { kind: "ai-video-engine", prompt: "x" },
      }),
    ).toBe(true);
  });

  it("SUBMITTED 且已有 gatewayLogId 不再计入", () => {
    expect(
      isCanvasVideoPreGatewayLogTask({
        status: "SUBMITTED",
        inputPayload: {
          kind: "ai-video-engine",
          gatewayLogId: "log-abc",
        },
      }),
    ).toBe(false);
  });

  it("非视频 payload 不计入", () => {
    expect(
      isCanvasVideoPreGatewayLogTask({
        status: "QUEUED",
        inputPayload: { kind: "image-engine" },
      }),
    ).toBe(false);
  });
});
