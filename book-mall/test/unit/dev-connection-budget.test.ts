import { describe, expect, it } from "vitest";
import {
  DEV_POLL_WORKER_CONNECTION_LIMIT,
  DEV_POLL_WORKER_COUNT,
  getDevConnectionBudget,
} from "@/lib/dev-connection-budget";

describe("dev-connection-budget", () => {
  it("computes estimated total from mall + poll workers", () => {
    const prev = process.env.PRISMA_CONNECTION_LIMIT;
    process.env.PRISMA_CONNECTION_LIMIT = "30";
    const budget = getDevConnectionBudget();
    expect(budget.pollWorkerCount).toBe(DEV_POLL_WORKER_COUNT);
    expect(budget.pollWorkerLimit).toBe(DEV_POLL_WORKER_CONNECTION_LIMIT);
    expect(budget.estimatedTotal).toBe(
      30 + DEV_POLL_WORKER_COUNT * DEV_POLL_WORKER_CONNECTION_LIMIT,
    );
    if (prev === undefined) delete process.env.PRISMA_CONNECTION_LIMIT;
    else process.env.PRISMA_CONNECTION_LIMIT = prev;
  });

  it("flags overBudget when total exceeds recommendedMax", () => {
    const prev = process.env.PRISMA_CONNECTION_LIMIT;
    process.env.PRISMA_CONNECTION_LIMIT = "100";
    const budget = getDevConnectionBudget();
    expect(budget.overBudget).toBe(true);
    expect(budget.hints.some((h) => h.includes("dev:all"))).toBe(true);
    if (prev === undefined) delete process.env.PRISMA_CONNECTION_LIMIT;
    else process.env.PRISMA_CONNECTION_LIMIT = prev;
  });
});
