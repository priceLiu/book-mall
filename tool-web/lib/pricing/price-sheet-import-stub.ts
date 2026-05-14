/**
 * 预留：用户上传价目（CSV / Excel 导出 / 百炼表格）解析与对齐。
 * 落地后与 {@link price-md-china-types} 的 `PriceSheetImportRow` 对接，再合并入 catalog 或生成 patch。
 */
import type { PriceSheetImportResult } from "./price-md-china-types";

/**
 * @param _bytes 上传文件字节（.csv / .xlsx 等）
 * @param fileName 原始文件名（用于溯源）
 */
export function parseUploadedPriceSheetPlaceholder(
  _bytes: Buffer,
  fileName: string,
): PriceSheetImportResult {
  return {
    ok: false,
    error: `价目表自动导入尚未实现：已记录文件名「${fileName}」。请将表头对齐「模型 / 输入元每百万Token / 输出元每百万Token / 地域」后走 PR 或运营工单；亦可先运行 pnpm pricing:extract-price-md 从 doc/price.md 导出快照。`,
  };
}
