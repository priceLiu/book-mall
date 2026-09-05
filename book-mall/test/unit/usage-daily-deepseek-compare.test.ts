import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { aggregateDeepseekVendorDaily } from "@/lib/finance/usage-daily/deepseek-vendor-daily-aggregate";
import { compareDailyUsage } from "@/lib/finance/usage-daily/daily-reconcile";
import type { GatewayDailyRow } from "@/lib/finance/usage-daily/types";

const costFixture = readFileSync(
  join(process.cwd(), "test/fixtures/deepseek-cost-sample.csv"),
  "utf8",
);
const amountFixture = readFileSync(
  join(process.cwd(), "test/fixtures/deepseek-amount-sample.csv"),
  "utf8",
);

/** 8/21：canvas Key 3545 次 vs bilibili 38 次 */
const amount821Only = `user_id,start_time_iso,end_time_iso,model,api_key_name,api_key,type,price,amount
e97b61e8-5b65-495a-ac39-2087a74273f8,2026-08-21T00:00:00+08:00,2026-08-22T00:00:00+08:00,deepseek-v4-flash,canvas,sk-918f***********************3f8,input_cache_hit_tokens,0.00000002,100
e97b61e8-5b65-495a-ac39-2087a74273f8,2026-08-21T00:00:00+08:00,2026-08-22T00:00:00+08:00,deepseek-v4-flash,canvas,sk-918f***********************3f8,request_count,,3545
e97b61e8-5b65-495a-ac39-2087a74273f8,2026-08-21T00:00:00+08:00,2026-08-22T00:00:00+08:00,deepseek-v4-flash,bilibili,sk-f9ddd***********************e497,request_count,,38
`;

const cost821Only = `user_id,start_time_iso,end_time_iso,model,wallet_type,cost,currency
e97b61e8-5b65-495a-ac39-2087a74273f8,2026-08-21T00:00:00+08:00,2026-08-22T00:00:00+08:00,deepseek-v4-flash,Paid,93.8802776000000000,CNY
`;

describe("aggregateDeepseekVendorDaily", () => {
  it("parses cost + amount CSV by CST day and channel", () => {
    const rows = aggregateDeepseekVendorDaily({
      costCsv: costFixture,
      amountCsv: amountFixture,
      period: { from: "2026-08-01", to: "2026-08-21" },
    });
    expect(rows.length).toBeGreaterThan(0);
    const aug21Flash = rows.filter(
      (r) => r.day === "2026-08-21" && r.modelKey === "deepseek-v4-flash",
    );
    expect(aug21Flash.some((r) => r.costYuan > 90)).toBe(true);
    expect(rows.some((r) => r.channelKey === "gw-platform-pool")).toBe(true);
  });
});

describe("compareDailyUsage — 8/21 canvas vs Gateway gap", () => {
  it("flags MISSING_PLATFORM for gw-canvas-pro2 when vendor canvas >> gateway", () => {
    const vendorDaily = aggregateDeepseekVendorDaily({
      costCsv: cost821Only,
      amountCsv: amount821Only,
      period: { from: "2026-08-21", to: "2026-08-21" },
    });

    const gatewayDaily: GatewayDailyRow[] = [
      {
        day: "2026-08-21",
        dimension: "CREDENTIAL",
        dimensionKey: "gw-platform-pool",
        dimensionLabel: "平台池",
        requestCount: 38,
        failedCount: 0,
        promptTokens: 10000,
        completionTokens: 5000,
        estimatedCostYuan: 1.5,
      },
      {
        day: "2026-08-21",
        dimension: "TOTAL",
        dimensionKey: "TOTAL",
        dimensionLabel: "合计",
        requestCount: 38,
        failedCount: 0,
        promptTokens: 10000,
        completionTokens: 5000,
        estimatedCostYuan: 1.5,
      },
    ];

    const compare = compareDailyUsage({ vendorDaily, gatewayDaily });
    const canvasRow = compare.find(
      (r) => r.day === "2026-08-21" && r.channelKey === "gw-canvas-pro2",
    );
    expect(canvasRow).toBeDefined();
    expect(canvasRow?.status).toBe("MISSING_PLATFORM");
    expect(canvasRow?.vendorRequests).toBe(3545);
    expect(canvasRow?.gatewayRequests).toBe(0);
    expect(canvasRow?.requestDiff).toBe(3545);

    const poolRow = compare.find(
      (r) => r.day === "2026-08-21" && r.channelKey === "gw-platform-pool",
    );
    expect(poolRow?.vendorRequests).toBe(38);
    expect(poolRow?.gatewayRequests).toBe(38);
  });
});
