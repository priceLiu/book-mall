import { describe, expect, it } from "vitest";

import { diffReconciliation } from "@/lib/billing/reconciliation-diff";

/** 验收标准 §3：当月 happyhorse 视频成本对账。 */
describe("diffReconciliation — 视频成本三端对账（容差 5%）", () => {
  const internal = { "happyhorse-r2v": 12.15 };

  it("厂商账单一致 → OK", () => {
    const r = diffReconciliation(internal, { "happyhorse-r2v": 12.15 });
    expect(r.rows[0].status).toBe("OK");
    expect(r.rows[0].diffYuan).toBe(0);
  });

  it("厂商偏高且超容差 → OVER（diff>0）", () => {
    const r = diffReconciliation(internal, { "happyhorse-r2v": 13.0 });
    expect(r.rows[0].status).toBe("OVER");
    expect(r.rows[0].diffYuan).toBeCloseTo(0.85, 6);
  });

  it("厂商偏高但在 5% 容差内 → OK", () => {
    const r = diffReconciliation(internal, { "happyhorse-r2v": 12.5 });
    expect(r.rows[0].status).toBe("OK");
  });

  it("厂商偏低且超容差 → UNDER（diff<0）", () => {
    const r = diffReconciliation(internal, { "happyhorse-r2v": 10.0 });
    expect(r.rows[0].status).toBe("UNDER");
    expect(r.rows[0].diffYuan).toBeCloseTo(-2.15, 6);
  });

  it("仅内部有记录 → MISSING_VENDOR", () => {
    const r = diffReconciliation(internal, {});
    expect(r.rows[0].status).toBe("MISSING_VENDOR");
  });

  it("仅厂商有记录 → MISSING_INTERNAL", () => {
    const r = diffReconciliation({}, { "happyhorse-r2v": 12.15 });
    expect(r.rows[0].status).toBe("MISSING_INTERNAL");
  });

  it("总额聚合正确", () => {
    const r = diffReconciliation({ a: 12.15, b: 24.3 }, { a: 12.15, b: 24.3 });
    expect(r.totalInternal).toBeCloseTo(36.45, 6);
    expect(r.totalVendor).toBeCloseTo(36.45, 6);
  });
});
