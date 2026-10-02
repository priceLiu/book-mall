import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

import { renderSizeChartPng } from "./size-chart-render";
import {
  defaultDetailPageSuiteSpecChartTables,
  DEFAULT_PRODUCT_SPEC_TABLE,
} from "./spec-table-defaults";
import type { DetailPageSuiteBrief, DetailPageSuiteSizeChartTable } from "./types";

export function resolveSpecChartTableForSlot(
  brief: DetailPageSuiteBrief | null | undefined,
  tableIndex = 0,
): DetailPageSuiteSizeChartTable {
  const tables = brief?.specChart?.tables;
  if (tables?.length) {
    const t = tables[Math.min(tableIndex, tables.length - 1)]!;
    if (t.headers?.length && t.rows?.length) return t;
  }
  const defaults = defaultDetailPageSuiteSpecChartTables();
  return defaults[tableIndex] ?? DEFAULT_PRODUCT_SPEC_TABLE;
}

export function ensureBriefSpecChartDefaults(
  brief: DetailPageSuiteBrief | null | undefined,
): DetailPageSuiteBrief {
  const base = brief ?? {};
  if (base.specChart?.tables?.length) return base;
  return {
    ...base,
    specChart: {
      tables: defaultDetailPageSuiteSpecChartTables(),
    },
  };
}

export function validateSpecChartTableForRender(
  table: DetailPageSuiteSizeChartTable,
): string | null {
  if (!table.headers?.length) return "参数表缺少表头";
  if (!table.rows?.length) return "请录入至少一行参数数据";
  for (const row of table.rows) {
    if (!row.some((c) => String(c).trim())) continue;
    if (String(row[0] ?? "").trim()) return null;
  }
  return "请录入至少一行参数数据";
}

export async function uploadRenderedSpecChartPng(opts: {
  userId: string;
  table: DetailPageSuiteSizeChartTable;
}): Promise<string> {
  const err = validateSpecChartTableForRender(opts.table);
  if (err) throw new Error(err);
  const buf = await renderSizeChartPng(opts.table);
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf,
    contentType: "image/png",
    ext: "png",
  });
}
