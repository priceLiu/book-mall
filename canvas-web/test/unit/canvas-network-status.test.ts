import { describe, expect, it } from "vitest";
import {
  formatCanvasNetworkConnectionLabel,
  formatCanvasNetworkSpeedLabel,
  formatCanvasNetworkStatusLabel,
} from "@/lib/canvas/use-canvas-network-status";

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

  it("combines connection hints without 在线", () => {
    const label = formatCanvasNetworkStatusLabel({
      online: true,
      effectiveType: "4g",
      downlinkMbps: 10.5,
      rttMs: 80,
      throughputKbps: null,
    });
    expect(label).not.toContain("在线");
    expect(label).toContain("4G");
    expect(label).toContain("10.5 Mbps");
    expect(label).toContain("RTT 80ms");
  });
});

describe("formatCanvasNetworkConnectionLabel / SpeedLabel", () => {
  it("splits connection and speed for toolbar layout", () => {
    const status = {
      online: true,
      effectiveType: "4g",
      downlinkMbps: 10.5,
      rttMs: 80,
      throughputKbps: null,
    };
    expect(formatCanvasNetworkConnectionLabel(status)).toBe("4G · RTT 80ms");
    expect(formatCanvasNetworkSpeedLabel(status)).toBe("10.5 Mbps");
  });
});
