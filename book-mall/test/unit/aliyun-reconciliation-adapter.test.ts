import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAliyunConsumedetailCsvSync } from "@/lib/finance/reconciliation-v2/aliyun-consumedetail-v2-adapter";

const fixturePath = join(__dirname, "../fixtures/aliyun-consumedetail-sample.csv");

describe("aliyun consumedetail v2 adapter", () => {
  const csv = readFileSync(fixturePath, "utf8");

  it("parses wan2.7-image 93 imgs @ ¥0.2", () => {
    const { lines } = parseAliyunConsumedetailCsvSync(csv, {
      "wan2.7-image": "wan2.7-image",
    });
    const row = lines.find((l) => l.modelKey === "wan2.7-image");
    expect(row).toBeDefined();
    expect(row!.vendorUnits).toBe(93);
    expect(row!.listUnitYuan).toBe(0.2);
    expect(row!.vendorListYuan).toBeCloseTo(18.6, 2);
    expect(row!.unitKind).toBe("IMAGE");
  });

  it("parses HappyHorse 1080P 153s", () => {
    const { lines } = parseAliyunConsumedetailCsvSync(csv, {
      "happyhorse-1.1-r2v": "happyhorse-1.1-r2v",
    });
    const row = lines.find((l) => l.modelKey.includes("r2v") && l.tierRaw === "1080P");
    expect(row).toBeDefined();
    expect(row!.vendorUnits).toBe(153);
    expect(row!.vendorListYuan).toBeCloseTo(183.6, 1);
  });

  it("splits qwen3.5-flash input/output tokens", () => {
    const { lines } = parseAliyunConsumedetailCsvSync(csv, {
      "qwen3.5-flash": "qwen3.5-flash",
    });
    const inp = lines.find((l) => l.tokenDirection === "input");
    const out = lines.find((l) => l.tokenDirection === "output");
    expect(inp?.vendorUnits).toBeCloseTo(393.843, 3);
    expect(out?.vendorUnits).toBeCloseTo(150.269, 3);
  });

  it("skips free quota rows with zero usage", () => {
    const { rows, lines } = parseAliyunConsumedetailCsvSync(csv);
    expect(rows.length).toBe(9);
    expect(lines.every((l) => l.vendorUnits > 0 || l.vendorListYuan > 0)).toBe(true);
  });
});
