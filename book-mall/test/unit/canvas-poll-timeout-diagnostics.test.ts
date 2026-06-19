import { describe, expect, it } from "vitest";

import {
  canvasPollTimeoutFailCode,
  canvasPollTimeoutFailMessage,
  type CanvasPollTimeoutDiagnostic,
} from "@/lib/canvas/canvas-poll-timeout-diagnostics";
import {
  getCanvasVolcengineVideoTimeoutMin,
  resolveCanvasSubmittedTaskTimeoutMin,
} from "@/lib/canvas/canvas-constants";

describe("canvas poll timeout diagnostics", () => {
  it("maps vendor_still_running to timeout_vendor_running", () => {
    expect(canvasPollTimeoutFailCode("vendor_still_running")).toBe(
      "timeout_vendor_running",
    );
  });

  it("describes vendor still running in fail message", () => {
    const diag: CanvasPollTimeoutDiagnostic = {
      kind: "canvas_poll_timeout",
      at: "2026-06-19T00:00:00.000Z",
      waitedMs: 1_800_000,
      timeoutMin: 30,
      pollCount: 100,
      cause: "vendor_still_running",
      vendorStatus: "running",
    };
    expect(canvasPollTimeoutFailMessage(diag)).toContain("火山任务仍在生成");
    expect(canvasPollTimeoutFailMessage(diag)).toContain("running");
  });

  it("describes sync bug when vendor already succeeded", () => {
    const diag: CanvasPollTimeoutDiagnostic = {
      kind: "canvas_poll_timeout",
      at: "2026-06-19T00:00:00.000Z",
      waitedMs: 1_200_000,
      timeoutMin: 20,
      pollCount: 50,
      cause: "vendor_already_succeeded",
      vendorStatus: "succeeded",
    };
    expect(canvasPollTimeoutFailMessage(diag)).toContain("未及时同步");
  });
});

describe("canvas volcengine video timeout", () => {
  it("uses 45 min default for volcengine video tasks", () => {
    expect(getCanvasVolcengineVideoTimeoutMin()).toBe(45);
    expect(
      resolveCanvasSubmittedTaskTimeoutMin({
        inputPayload: { providerKind: "VOLCENGINE", kind: "video-engine" },
      }),
    ).toBe(45);
    expect(
      resolveCanvasSubmittedTaskTimeoutMin({
        inputPayload: { providerKind: "KIE", kind: "image-engine" },
      }),
    ).toBe(20);
  });
});
