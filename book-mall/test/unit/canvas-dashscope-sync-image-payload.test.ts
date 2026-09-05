import { describe, expect, it } from "vitest";

import { isCanvasDashscopeSyncImageTaskPayload } from "@/lib/canvas/canvas-constants";

describe("isCanvasDashscopeSyncImageTaskPayload", () => {
  it("matches multimodal-image-sync job kind", () => {
    expect(
      isCanvasDashscopeSyncImageTaskPayload({
        kind: "image-engine",
        dashscopeJobKind: "multimodal-image-sync",
        gatewayLogId: "log1",
      }),
    ).toBe(true);
  });

  it("matches sync dashscope image-engine with gateway log", () => {
    expect(
      isCanvasDashscopeSyncImageTaskPayload({
        kind: "image-engine",
        providerKind: "DASHSCOPE",
        syncGatewaySubmit: true,
        gatewayLogId: "log1",
        modelKey: "qwen-image-3.0-pro",
      }),
    ).toBe(true);
  });

  it("rejects async wan27 without sync flag", () => {
    expect(
      isCanvasDashscopeSyncImageTaskPayload({
        kind: "image-engine",
        providerKind: "DASHSCOPE",
        dashscopeJobKind: "wan27-image",
        gatewayLogId: "log1",
      }),
    ).toBe(false);
  });
});
