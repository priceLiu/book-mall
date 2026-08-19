import { describe, expect, it } from "vitest";

import { gatewayRouteDisplayName } from "@/lib/gateway/gateway-model-capabilities";

const DEEPSEEK_CATALOG = {
  displayName: "DeepSeek Chat Flash",
  canonicalKey: "deepseek-chat",
};

describe("gatewayRouteDisplayName · DeepSeek V4 routes", () => {
  it("distinguishes flash / pro / legacy chat under one canonical", () => {
    expect(gatewayRouteDisplayName(DEEPSEEK_CATALOG, "deepseek-v4-flash")).toBe(
      "DeepSeek V4 Flash",
    );
    expect(gatewayRouteDisplayName(DEEPSEEK_CATALOG, "deepseek-v4-pro")).toBe(
      "DeepSeek V4 Pro",
    );
    expect(gatewayRouteDisplayName(DEEPSEEK_CATALOG, "deepseek-chat")).toBe(
      "DeepSeek Chat（旧 ID → V4 Flash）",
    );
  });
});
