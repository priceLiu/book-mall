/**
 * 厂商账单文件 → CSV 文本；按 vendor 或表头自动识别格式。
 * 支持 .csv / .tsv / .xls / .xlsx
 */
import { read, utils } from "xlsx";

import {
  isDeepseekAmountBillCsv,
  isDeepseekCostBillCsv,
  DEEPSEEK_AMOUNT_BILL_MARKER,
  DEEPSEEK_COST_BILL_MARKER,
} from "./deepseek-usage-v2-adapter";
import { isKieUsageBillCsv, KIE_USAGE_BILL_MARKER } from "./kie-usage-v2-adapter";

const ALIYUN_BILL_MARKER = "标识信息/账单明细ID";

const EXT_CSV = new Set(["csv", "tsv", "txt"]);
const EXT_XLS = new Set(["xls", "xlsx", "xlsm", "xltx", "xltm"]);

export type VendorBillFileKind = "csv" | "excel";
export type VendorBillFormat = "aliyun" | "kie" | "deepseek";

export function detectVendorBillFileKind(filename: string): VendorBillFileKind | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_CSV.has(ext)) return "csv";
  if (EXT_XLS.has(ext)) return "excel";
  return null;
}

export function isSupportedVendorBillFilename(filename: string): boolean {
  return detectVendorBillFileKind(filename) != null;
}

/** Excel 首 sheet → CSV。 */
export function excelBufferToCsvText(buffer: Buffer): string {
  const wb = read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel 文件无工作表");
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Excel 工作表为空");
  }
  return utils.sheet_to_csv(sheet, { FS: ",", RS: "\n", blankrows: false });
}

function normalizeCsvText(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

export function detectVendorBillFormat(csvText: string): VendorBillFormat | null {
  if (csvText.includes(ALIYUN_BILL_MARKER)) return "aliyun";
  if (isKieUsageBillCsv(csvText)) return "kie";
  if (isDeepseekCostBillCsv(csvText) || isDeepseekAmountBillCsv(csvText)) return "deepseek";
  return null;
}

export function assertVendorBillFormat(csvText: string, expected?: VendorBillFormat): VendorBillFormat {
  const detected = detectVendorBillFormat(csvText);
  if (!detected) {
    throw new Error(
      "无法识别账单格式：须为阿里云 consumedetail、KIE usage_data 或 DeepSeek usage_data（cost / amount CSV）",
    );
  }
  if (expected && detected !== expected) {
    const labels: Record<VendorBillFormat, string> = {
      aliyun: "阿里云 consumedetail",
      kie: "KIE usage_data",
      deepseek: "DeepSeek usage_data",
    };
    throw new Error(
      `所选厂商为 ${expected}，但文件像是 ${labels[detected]} 格式，请检查厂商选择与文件是否匹配`,
    );
  }
  return expected ?? detected;
}

/** @deprecated 使用 assertVendorBillFormat */
export function assertAliyunConsumedetailBill(csvText: string): void {
  assertVendorBillFormat(csvText, "aliyun");
}

/** 读取上传文件为 CSV 文本（Excel 会先转为 CSV）。 */
export async function readVendorBillFileToCsvText(input: {
  buffer: Buffer;
  filename: string;
  vendor?: VendorBillFormat;
}): Promise<{ csvText: string; kind: VendorBillFileKind; format: VendorBillFormat }> {
  const kind = detectVendorBillFileKind(input.filename);
  if (!kind) {
    throw new Error("不支持的文件格式，请上传 CSV、TSV 或 Excel（.xls / .xlsx）");
  }

  let csvText: string;
  if (kind === "excel") {
    csvText = excelBufferToCsvText(input.buffer);
  } else {
    csvText = normalizeCsvText(input.buffer.toString("utf8"));
    if (!csvText && input.buffer.length > 0) {
      csvText = normalizeCsvText(input.buffer.toString("latin1"));
    }
  }

  if (!csvText) {
    throw new Error("文件内容为空");
  }

  const format = assertVendorBillFormat(csvText, input.vendor);
  return { csvText, kind, format };
}

export {
  ALIYUN_BILL_MARKER,
  KIE_USAGE_BILL_MARKER,
  DEEPSEEK_COST_BILL_MARKER,
  DEEPSEEK_AMOUNT_BILL_MARKER,
};
