import { describe, expect, it } from "vitest";

import { evaluateCreditOpsAlerts, cstCronDeadlineUtc } from "@/lib/billing/credit-ops-alerts";

describe("credit-ops-alerts", () => {
  it("cstCronDeadlineUtc — 01:00 CST", () => {
    const d = cstCronDeadlineUtc("2026-08-16");
    expect(d.toISOString()).toBe("2026-08-15T17:00:00.000Z");
  });

  it("OVERDUE_ITEMS → CRITICAL", () => {
    const alerts = evaluateCreditOpsAlerts({
      now: new Date("2026-08-16T10:00:00.000Z"),
      todayCst: "2026-08-16",
      overdueCount: 3,
      staleSubscriptionLotAccounts: 0,
      driftCount: 0,
      latestExpireJob: null,
      latestResetJob: null,
    });
    expect(alerts.some((a) => a.code === "OVERDUE_ITEMS" && a.level === "CRITICAL")).toBe(true);
  });

  it("CRON_NOT_RUN after 01:00 CST when no jobs", () => {
    const alerts = evaluateCreditOpsAlerts({
      now: new Date("2026-08-15T18:00:00.000Z"), // 02:00 CST Aug 16
      todayCst: "2026-08-16",
      overdueCount: 0,
      staleSubscriptionLotAccounts: 0,
      driftCount: 0,
      latestExpireJob: null,
      latestResetJob: null,
    });
    expect(alerts.filter((a) => a.code === "CRON_NOT_RUN").length).toBe(2);
  });

  it("no CRON_NOT_RUN before deadline", () => {
    const alerts = evaluateCreditOpsAlerts({
      now: new Date("2026-08-15T16:00:00.000Z"), // 00:00 CST Aug 16
      todayCst: "2026-08-16",
      overdueCount: 0,
      staleSubscriptionLotAccounts: 0,
      driftCount: 0,
      latestExpireJob: null,
      latestResetJob: null,
    });
    expect(alerts.some((a) => a.code === "CRON_NOT_RUN")).toBe(false);
  });
});
