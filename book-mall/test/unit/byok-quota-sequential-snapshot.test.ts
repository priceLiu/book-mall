import { describe, expect, it } from "vitest";

import { computeSequentialByokQuotaSnapshots } from "@/lib/finance/byok-quota-reconcile";

describe("computeSequentialByokQuotaSnapshots", () => {
  it("按时间序累计 used/remaining，每次套餐内扣次 +1", () => {
    const base = {
      ownerType: "USER" as const,
      ownerId: "u1",
      periodKey: "2026-06",
      byokTaskKind: "IMAGE_TO_VIDEO" as const,
      settlementKind: "BYOK_QUOTA_INCLUDED",
      quotaDelta: 1,
      monthlyIncluded: 20,
    };
    const snaps = computeSequentialByokQuotaSnapshots([
      {
        ...base,
        logId: "a",
        submittedAt: new Date("2026-06-13T07:02:50Z"),
      },
      {
        ...base,
        logId: "b",
        submittedAt: new Date("2026-06-13T07:13:01Z"),
      },
      {
        ...base,
        logId: "c",
        submittedAt: new Date("2026-06-13T07:23:03Z"),
      },
    ]);

    expect(snaps.get("a")).toEqual({ includedUsedAfter: 1, includedRemainingAfter: 19 });
    expect(snaps.get("b")).toEqual({ includedUsedAfter: 2, includedRemainingAfter: 18 });
    expect(snaps.get("c")).toEqual({ includedUsedAfter: 3, includedRemainingAfter: 17 });
  });
});
