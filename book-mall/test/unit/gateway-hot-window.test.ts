import { describe, expect, it } from "vitest";

import {
  applyGatewayLogQueryMode,
  buildGatewayLogHotWhere,
  gatewayLogHotCutoffDate,
  getGatewayLogHotRetentionHours,
  parseGatewayLogQueryMode,
} from "@/lib/gateway/gateway-hot-window";

describe("gateway-hot-window", () => {
  it("parseGatewayLogQueryMode 默认 live", () => {
    expect(parseGatewayLogQueryMode(null)).toBe("live");
    expect(parseGatewayLogQueryMode("history")).toBe("history");
  });

  it("buildGatewayLogHotWhere 包含在飞与近窗终态", () => {
    const cutoff = new Date("2026-06-23T11:00:00.000Z");
    const where = buildGatewayLogHotWhere(cutoff);
    expect(where).toEqual({
      OR: [
        { status: { in: ["PENDING", "RUNNING"] } },
        { completedAt: { gte: cutoff } },
      ],
    });
  });

  it("applyGatewayLogQueryMode history 不加热区", () => {
    const base = { actorBookUserId: "u1" };
    expect(applyGatewayLogQueryMode(base, "history")).toEqual(base);
    const cutoff = gatewayLogHotCutoffDate();
    const live = applyGatewayLogQueryMode(base, "live") as {
      AND: [typeof base, ReturnType<typeof buildGatewayLogHotWhere>];
    };
    expect(live.AND[0]).toEqual(base);
    expect(live.AND[1]).toEqual(buildGatewayLogHotWhere(cutoff));
  });

  it("默认热保留 1 小时", () => {
    expect(getGatewayLogHotRetentionHours()).toBe(1);
  });
});
