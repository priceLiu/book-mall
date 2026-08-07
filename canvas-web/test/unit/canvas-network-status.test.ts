import { describe, expect, it } from "vitest";
import { formatCanvasNetworkStatusLabel } from "./use-canvas-network-status";

describe("formatCanvasNetworkStatusLabel", () => {
  it("shows offline", () => {
    expect(
      formatCanvasNetworkStatusLabel({
        online: false,
        effectiveType: null,
        downlinkMbps: null,
        rttMs: null,
        throughputKbps: null,
      }),
    ).toBe("离线");
  });

  it("combines connection hints", () => {
    const label = formatCanvasNetworkStatusLabel({
      online: true,
      effectiveType: "4g",
      downlinkMbps: 10.5,
      rttMs: 80,
      throughputKbps: null,
    });
    expect(label).toContain("在线");
    expect(label).toContain("4G");
    expect(label).toContain("10.5 Mbps");
    expect(label).toContain("RTT 80ms");
  });
});
