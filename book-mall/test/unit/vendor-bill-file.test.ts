import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  assertAliyunConsumedetailBill,
  detectVendorBillFormat,
  detectVendorBillFileKind,
  excelBufferToCsvText,
  isSupportedVendorBillFilename,
  readVendorBillFileToCsvText,
} from "@/lib/finance/reconciliation-v2/vendor-bill-file";

const fixtureCsv = readFileSync(
  join(process.cwd(), "test/fixtures/aliyun-consumedetail-sample.csv"),
  "utf8",
);

describe("vendor-bill-file", () => {
  it("detects csv and excel extensions", () => {
    expect(detectVendorBillFileKind("bill.csv")).toBe("csv");
    expect(detectVendorBillFileKind("bill.tsv")).toBe("csv");
    expect(detectVendorBillFileKind("bill.xlsx")).toBe("excel");
    expect(detectVendorBillFileKind("bill.xls")).toBe("excel");
    expect(detectVendorBillFileKind("bill.pdf")).toBeNull();
  });

  it("reads csv buffer", async () => {
    const { csvText, kind } = await readVendorBillFileToCsvText({
      buffer: Buffer.from(fixtureCsv, "utf8"),
      filename: "sample.csv",
      vendor: "aliyun",
    });
    expect(kind).toBe("csv");
    expect(csvText).toContain("标识信息/账单明细ID");
    expect(assertAliyunConsumedetailBill(csvText)).toBeUndefined();
  });

  it("converts xlsx buffer to csv text with aliyun headers", async () => {
    const rows = fixtureCsv.trim().split("\n").map((line) => line.split(","));
    const header = rows[0]!;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      header,
      ...rows.slice(1).map((cells) => cells),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(isSupportedVendorBillFilename("test.xlsx")).toBe(true);
    const csvFromXlsx = excelBufferToCsvText(buffer);
    expect(csvFromXlsx).toContain("标识信息/账单明细ID");

    const { csvText, kind } = await readVendorBillFileToCsvText({
      buffer,
      filename: "sample.xlsx",
      vendor: "aliyun",
    });
    expect(kind).toBe("excel");
    expect(csvText).toContain("happyhorse-1.1-r2v");
  });

  it("detects aliyun vs kie format", () => {
    expect(detectVendorBillFormat(fixtureCsv)).toBe("aliyun");
  });
});
