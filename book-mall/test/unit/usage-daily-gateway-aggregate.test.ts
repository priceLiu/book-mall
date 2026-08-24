import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  aggregateGatewayDaily,
  rollupGatewayByDimensionKey,
} from "@/lib/finance/usage-daily/gateway-daily-aggregate";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gatewayRequestLog: {
      findMany: vi.fn(),
    },
  },
}));

const mockLogs = [
  {
    submittedAt: new Date("2026-08-21T10:00:00+08:00"),
    status: "SUCCEEDED" as const,
    clientSource: "CANVAS" as const,
    clientPage: "canvas/story-pro",
    model: "deepseek-v4-flash",
    canonicalModelKey: "deepseek-v4-flash",
    channelSnapshot: "bilibili",
    credentialAliasSnapshot: null,
    promptTokens: 1000,
    completionTokens: 500,
    costSnapshotYuan: 0.01,
    estimatedVendorCostYuan: 0.01,
  },
  {
    submittedAt: new Date("2026-08-21T11:00:00+08:00"),
    status: "FAILED" as const,
    clientSource: "TOOL" as const,
    clientPage: "platform-assistant/chat",
    model: "deepseek-chat",
    canonicalModelKey: null,
    channelSnapshot: "bilibili",
    credentialAliasSnapshot: null,
    promptTokens: null,
    completionTokens: null,
    costSnapshotYuan: null,
    estimatedVendorCostYuan: null,
  },
];

describe("aggregateGatewayDaily", () => {
  beforeEach(() => {
    vi.mocked(prisma.gatewayRequestLog.findMany).mockReset();
  });

  it("aggregates by day, app, model, credential", async () => {
    vi.mocked(prisma.gatewayRequestLog.findMany).mockResolvedValue(mockLogs as never);

    const rows = await aggregateGatewayDaily({
      period: { from: "2026-08-21", to: "2026-08-21" },
      providerKind: "DEEPSEEK",
    });

    const total = rows.find((r) => r.dimension === "TOTAL" && r.day === "2026-08-21");
    expect(total?.requestCount).toBe(1);
    expect(total?.failedCount).toBe(1);

    const app = rows.find((r) => r.dimension === "APP");
    expect(app?.dimensionKey).toContain("CANVAS");

    const cred = rows.find((r) => r.dimension === "CREDENTIAL");
    expect(cred?.dimensionKey).toBe("gw-platform-pool");
  });

  it("rollupGatewayByDimensionKey sums across days", () => {
    const rows = [
      {
        day: "2026-08-20",
        dimension: "APP" as const,
        dimensionKey: "CANVAS/canvas",
        dimensionLabel: "CANVAS · canvas",
        requestCount: 2,
        failedCount: 0,
        promptTokens: 100,
        completionTokens: 50,
        estimatedCostYuan: 0.02,
      },
      {
        day: "2026-08-21",
        dimension: "APP" as const,
        dimensionKey: "CANVAS/canvas",
        dimensionLabel: "CANVAS · canvas",
        requestCount: 3,
        failedCount: 1,
        promptTokens: 200,
        completionTokens: 80,
        estimatedCostYuan: 0.03,
      },
    ];
    const rolled = rollupGatewayByDimensionKey(rows, "APP");
    expect(rolled).toHaveLength(1);
    expect(rolled[0]?.requestCount).toBe(5);
    expect(rolled[0]?.failedCount).toBe(1);
  });
});
