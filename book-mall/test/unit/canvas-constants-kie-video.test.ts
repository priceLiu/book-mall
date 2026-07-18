import { describe, expect, it } from "vitest";

import {
  isCanvasKieVideoTaskPayload,
  isCanvasVolcengineVideoTaskPayload,
} from "@/lib/canvas/canvas-constants";

describe("isCanvasKieVideoTaskPayload", () => {
  it("matches sbv1 KIE video-engine payload", () => {
    expect(
      isCanvasKieVideoTaskPayload({
        kind: "video-engine",
        providerKind: "KIE",
        kieModel: "kling-1.0/video",
      }),
    ).toBe(true);
  });

  it("does not match volcengine video", () => {
    expect(
      isCanvasVolcengineVideoTaskPayload({
        kind: "video-engine",
        providerKind: "VOLCENGINE",
      }),
    ).toBe(true);
    expect(
      isCanvasKieVideoTaskPayload({
        kind: "video-engine",
        providerKind: "VOLCENGINE",
      }),
    ).toBe(false);
  });
});
