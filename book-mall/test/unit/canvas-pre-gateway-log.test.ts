import { describe, expect, it } from "vitest";

import {
  buildCanvasPendingLogRow,
  buildCanvasPendingLogRows,
} from "@/lib/canvas/canvas-pending-log-row";
import { isCanvasPreGatewayLogTask } from "@/lib/canvas/canvas-queue-without-log";
import type { CanvasQueuedTaskRow } from "@/lib/canvas/canvas-queue-without-log";

/** @deprecated alias */
const isCanvasVideoPreGatewayLogTask = isCanvasPreGatewayLogTask;

describe("isCanvasPreGatewayLogTask", () => {
  it("QUEUED / DISPATCHING / PENDING 视频任务计入待 Gateway log", () => {
    const payload = { kind: "video-engine", prompt: "test" };
    expect(
      isCanvasVideoPreGatewayLogTask({ status: "QUEUED", inputPayload: payload }),
    ).toBe(true);
    expect(
      isCanvasVideoPreGatewayLogTask({
        status: "DISPATCHING",
        inputPayload: payload,
      }),
    ).toBe(true);
    expect(
      isCanvasVideoPreGatewayLogTask({ status: "PENDING", inputPayload: payload }),
    ).toBe(true);
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

  it("生图 traffic 任务 QUEUED 计入", () => {
    expect(
      isCanvasPreGatewayLogTask({
        status: "QUEUED",
        inputPayload: { kind: "image-engine", prompt: "x" },
      }),
    ).toBe(true);
  });

  it("Story LLM SUBMITTED 且无 gatewayLogId 计入", () => {
    expect(
      isCanvasPreGatewayLogTask({
        status: "SUBMITTED",
        inputPayload: {
          kind: "story-outline-engine",
          prompt: "古风甜宠",
          providerId: "gw-openai",
        },
      }),
    ).toBe(true);
  });

  it("Story LLM 不走交通控流 QUEUED", () => {
    expect(
      isCanvasPreGatewayLogTask({
        status: "QUEUED",
        inputPayload: { kind: "story-outline-engine", prompt: "x" },
      }),
    ).toBe(false);
  });

  it("非画布引擎 payload 不计入", () => {
    expect(
      isCanvasPreGatewayLogTask({
        status: "QUEUED",
        inputPayload: { kind: "tts-engine" },
      }),
    ).toBe(false);
  });
});

describe("buildCanvasPendingLogRow", () => {
  const baseTask: CanvasQueuedTaskRow = {
    id: "task-llm-1",
    status: "SUBMITTED",
    projectId: "proj-1",
    projectName: "demo",
    nodeId: "hub-1",
    model: "gpt-4.1",
    queuedAt: null,
    createdAt: new Date().toISOString(),
    trafficStartedAt: new Date().toISOString(),
    dispatchAfter: null,
    waitMinutes: 0,
    payloadKind: "story-outline-engine",
    actorUserId: "user-1",
    inputPayload: {
      kind: "story-outline-engine",
      prompt: "主题：古风甜宠",
    },
  };

  it("Story LLM 合成 CHAT 排队行", () => {
    const row = buildCanvasPendingLogRow(baseTask);
    expect(row.requestKind).toBe("CHAT");
    expect(row.endpoint).toBe("/v1/chat/completions");
    expect(row.pending).toBe(true);
    expect(row.canvasTaskId).toBe("task-llm-1");
  });

  it("dedupe 保留未关联真实日志的 pending 行", () => {
    const pending = buildCanvasPendingLogRows([baseTask]);
    expect(pending).toHaveLength(1);
  });
});
