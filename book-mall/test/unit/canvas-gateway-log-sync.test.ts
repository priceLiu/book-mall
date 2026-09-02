import { describe, expect, it } from "vitest";

import { isCanvasVideoResultUrl } from "@/lib/canvas/canvas-gateway-log-sync";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/gateway-log-record-info";

describe("canvas gateway log sync", () => {
  it("detects canvas video result URLs", () => {
    expect(isCanvasVideoResultUrl("https://cdn.example/a.mp4")).toBe(true);
    expect(isCanvasVideoResultUrl("https://oss.example/node-video/abc")).toBe(
      true,
    );
    expect(isCanvasVideoResultUrl("https://cdn.example/a.jpg")).toBe(false);
  });

  it("reconcile only targets non-terminal gateway logs", () => {
    expect(isGatewayLogTerminalStatus("RUNNING")).toBe(false);
    expect(isGatewayLogTerminalStatus("SUCCEEDED")).toBe(true);
  });
});
