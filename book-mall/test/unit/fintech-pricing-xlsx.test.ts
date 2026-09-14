import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

import {
  fintechMultiplierToDiscountRate,
  parseFintechPricingXlsx,
} from "@/lib/pricing/fintech-pricing-xlsx";

describe("fintech-pricing-xlsx", () => {
  it("fintechMultiplierToDiscountRate: 0.835 → 16.5% 节省", () => {
    expect(fintechMultiplierToDiscountRate(0.835)).toBeCloseTo(0.165, 3);
  });

  it("parses sample xlsx when present", () => {
    const sample = path.resolve(
      __dirname,
      "../../doc/finance/samples/fintech-ai-报价单0818.xlsx",
    );
    if (!fs.existsSync(sample)) {
      return;
    }
    const { rows } = parseFintechPricingXlsx(fs.readFileSync(sample));
    expect(rows.length).toBeGreaterThan(5);
    const seedance720 = rows.find(
      (r) => r.canonicalModelKey === "seedance-2.0" && r.tierRaw === "720P",
    );
    expect(seedance720?.vendor).toBe("fintech");
    expect(seedance720?.listCostYuan).toBe(1);
    expect(seedance720?.note).toContain("云厂商=volcengine");
    const kling720 = rows.find(
      (r) => r.canonicalModelKey === "kling-3.0-video" && r.tierRaw === "720P",
    );
    expect(kling720?.vendor).toBe("fintech");
    expect(kling720?.note).toContain("云厂商=aliyun");
    expect(kling720?.listCostYuan).toBeLessThanOrEqual(1);
  });
});
