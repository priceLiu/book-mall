import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, upsertMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gatewayStatsCounter: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}));

import {
  getProjectedDashboardCards,
  GATEWAY_STATS_DEFAULT_TTL_MS,
} from "@/lib/gateway/stats-counter";

const COMPUTED = {
  inProgress: 7,
  succeeded: 100,
  failed: 3,
  cancelled: 1,
  slowWarn: 2,
  backgroundWait: 1,
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    scopeKey: "global",
    bucket: "live",
    inProgress: 5,
    succeeded: 50,
    failed: 2,
    cancelled: 0,
    queued: 0,
    slowWarn: 1,
    backgroundWait: 0,
    computedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("getProjectedDashboardCards 自愈投影", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    upsertMock.mockResolvedValue(undefined);
  });

  it("新鲜行命中：直接返回缓存，不重算", async () => {
    findUniqueMock.mockResolvedValue(row({ computedAt: new Date() }));
    const recompute = vi.fn(async () => COMPUTED);

    const cards = await getProjectedDashboardCards({
      scopeKey: "global",
      recompute,
    });

    expect(recompute).not.toHaveBeenCalled();
    expect(cards.inProgress).toBe(5);
    expect(cards.succeeded).toBe(50);
  });

  it("行缺失：重算并回填", async () => {
    findUniqueMock.mockResolvedValue(null);
    const recompute = vi.fn(async () => COMPUTED);

    const cards = await getProjectedDashboardCards({
      scopeKey: "global",
      recompute,
    });

    expect(recompute).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(cards).toEqual(COMPUTED);
  });

  it("行过期：重算并回填", async () => {
    findUniqueMock.mockResolvedValue(
      row({
        computedAt: new Date(Date.now() - GATEWAY_STATS_DEFAULT_TTL_MS - 1000),
      }),
    );
    const recompute = vi.fn(async () => COMPUTED);

    const cards = await getProjectedDashboardCards({
      scopeKey: "global",
      recompute,
    });

    expect(recompute).toHaveBeenCalledTimes(1);
    expect(cards).toEqual(COMPUTED);
  });

  it("投影读异常：退回直接重算（不抛）", async () => {
    findUniqueMock.mockRejectedValue(new Error("db down"));
    const recompute = vi.fn(async () => COMPUTED);

    const cards = await getProjectedDashboardCards({
      scopeKey: "global",
      recompute,
    });

    expect(recompute).toHaveBeenCalledTimes(1);
    expect(cards).toEqual(COMPUTED);
  });
});
