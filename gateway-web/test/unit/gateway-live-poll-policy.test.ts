import { describe, expect, it } from "vitest";

import {
  gatewayLivePollIntervalMs,
  gatewaySummaryPollIntervalMs,
  hasGatewayDynamicActivity,
  shouldGatewayLivePoll,
} from "@/lib/gateway-live-poll-policy";

describe("gateway-live-poll-policy", () => {
  const zero = { inProgress: 0, slowWarn: 0, backgroundWait: 0 };
  const active = { inProgress: 2, slowWarn: 0, backgroundWait: 0 };

  it("无动数据时不轮询", () => {
    expect(hasGatewayDynamicActivity(zero)).toBe(false);
    expect(shouldGatewayLivePoll(zero, false)).toBe(false);
    expect(gatewayLivePollIntervalMs(zero, false)).toBe(0);
    expect(gatewaySummaryPollIntervalMs(zero)).toBe(0);
  });

  it("有在飞时启用轮询", () => {
    expect(shouldGatewayLivePoll(active, false)).toBe(true);
    expect(gatewayLivePollIntervalMs(active, false)).toBe(8000);
    expect(gatewaySummaryPollIntervalMs(active)).toBe(10000);
  });

  it("列表在飞可单独触发轮询", () => {
    expect(shouldGatewayLivePoll(zero, true)).toBe(true);
  });
});
