import { describe, expect, it } from "vitest";

import {
  getCanvasBackgroundVideoTimeoutMin,
  isCanvasAsyncVideoEngineTaskPayload,
  isCanvasDashscopeVideoTaskPayload,
  resolveCanvasSubmittedTaskTimeoutMin,
} from "@/lib/canvas/canvas-constants";
import { shouldDeferCanvasBackgroundVideoTimeout } from "@/lib/canvas/canvas-submitted-task-timeout";
import { VIDEO_BACKGROUND_UI_MS } from "@/lib/gateway/video-task-wait-policy";

describe("canvas async video background policy", () => {
  it("VIDEO_BACKGROUND_UI_MS is 15 minutes", () => {
    expect(VIDEO_BACKGROUND_UI_MS).toBe(15 * 60 * 1000);
  });

  it("recognizes DashScope video-engine payload", () => {
    expect(
      isCanvasDashscopeVideoTaskPayload({
        providerKind: "DASHSCOPE",
        kind: "video-engine",
      }),
    ).toBe(true);
    expect(
      isCanvasAsyncVideoEngineTaskPayload({
        providerKind: "DASHSCOPE",
        kind: "video-engine",
      }),
    ).toBe(true);
  });

  it("DashScope video uses extended canvas timeout", () => {
    expect(
      resolveCanvasSubmittedTaskTimeoutMin({
        inputPayload: { providerKind: "DASHSCOPE", kind: "video-engine" },
      }),
    ).toBeGreaterThanOrEqual(45);
  });

  it("background hard cap defaults to 90 minutes", () => {
    expect(getCanvasBackgroundVideoTimeoutMin()).toBe(90);
  });

  it("defers timeout while vendor still running in background", () => {
    expect(
      shouldDeferCanvasBackgroundVideoTimeout({
        inBackground: true,
        cause: "vendor_still_running",
      }),
    ).toBe(true);
    expect(
      shouldDeferCanvasBackgroundVideoTimeout({
        inBackground: false,
        cause: "vendor_still_running",
      }),
    ).toBe(false);
  });
});
