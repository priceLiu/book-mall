import { describe, expect, it } from "vitest";

import {
  assertCanvasProviderMatchesModelRoute,
  canvasProviderIdForGateway,
} from "@/lib/canvas/canvas-gateway-run";

describe("canvasProviderIdForGateway · Kimi 百炼归一", () => {
  it("legacy gateway:moonshot + kimi-k3 → gateway:bailian", () => {
    expect(canvasProviderIdForGateway("gateway:moonshot", "kimi-k3")).toBe(
      "gateway:bailian",
    );
  });

  it("assertCanvasProviderMatchesModelRoute 不因 legacy moonshot provider 拦截", () => {
    expect(() =>
      assertCanvasProviderMatchesModelRoute("gateway:moonshot", "kimi-k3"),
    ).not.toThrow();
  });
});
