import { describe, expect, it } from "vitest";

import {
  applyStatusBump,
  emptyStatusCounts,
  gatewayStatusToBucket,
} from "@/lib/gateway/stats-counter";

describe("gatewayStatusToBucket", () => {
  it("映射 Gateway 状态到桶", () => {
    expect(gatewayStatusToBucket("PENDING")).toBe("inProgress");
    expect(gatewayStatusToBucket("RUNNING")).toBe("inProgress");
    expect(gatewayStatusToBucket("SUCCEEDED")).toBe("succeeded");
    expect(gatewayStatusToBucket("FAILED")).toBe("failed");
    expect(gatewayStatusToBucket("CANCELLED")).toBe("cancelled");
  });
});

describe("applyStatusBump 状态迁移计数", () => {
  it("新建：null → inProgress 只 +1 在飞", () => {
    const c = applyStatusBump(emptyStatusCounts(), null, "inProgress");
    expect(c).toEqual({
      inProgress: 1,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      queued: 0,
    });
  });

  it("终态：inProgress → succeeded（在飞-1，成功+1）", () => {
    const start = { ...emptyStatusCounts(), inProgress: 3, succeeded: 1 };
    const c = applyStatusBump(start, "inProgress", "succeeded");
    expect(c.inProgress).toBe(2);
    expect(c.succeeded).toBe(2);
  });

  it("inProgress → failed", () => {
    const start = { ...emptyStatusCounts(), inProgress: 1 };
    const c = applyStatusBump(start, "inProgress", "failed");
    expect(c.inProgress).toBe(0);
    expect(c.failed).toBe(1);
  });

  it("queued → inProgress（dispatch 出队入飞）", () => {
    const start = { ...emptyStatusCounts(), queued: 2 };
    const c = applyStatusBump(start, "queued", "inProgress");
    expect(c.queued).toBe(1);
    expect(c.inProgress).toBe(1);
  });

  it("钳制：不为负", () => {
    const c = applyStatusBump(emptyStatusCounts(), "inProgress", "succeeded");
    expect(c.inProgress).toBe(0);
    expect(c.succeeded).toBe(1);
  });

  it("同桶迁移净零，且不动其它桶", () => {
    const start = { ...emptyStatusCounts(), inProgress: 5, succeeded: 2 };
    const c = applyStatusBump(start, "inProgress", "inProgress");
    expect(c).toEqual(start);
  });

  it("未知/无关桶不受影响", () => {
    const start = { ...emptyStatusCounts(), inProgress: 1, cancelled: 4 };
    const c = applyStatusBump(start, "inProgress", "succeeded");
    expect(c.cancelled).toBe(4);
    expect(c.queued).toBe(0);
  });
});
