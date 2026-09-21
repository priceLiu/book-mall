import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

import {
  defaultDetailPageSuiteSizeChartTables,
  DEFAULT_OUTDOOR_SIZE_CHART_TABLE,
} from "./size-chart-defaults";
import { renderSizeChartPng } from "./size-chart-render";
import type { DetailPageSuiteBrief, DetailPageSuiteSizeChartTable } from "./types";

export function resolveSizeChartTableForSlot(
  brief: DetailPageSuiteBrief | null | undefined,
  tableIndex = 0,
): DetailPageSuiteSizeChartTable {
  const tables = brief?.sizeChart?.tables;
  if (tables?.length) {
    const t = tables[Math.min(tableIndex, tables.length - 1)]!;
    if (t.headers?.length && t.rows?.length) return t;
  }
  const defaults = defaultDetailPageSuiteSizeChartTables();
  return defaults[tableIndex] ?? DEFAULT_OUTDOOR_SIZE_CHART_TABLE;
}

export function ensureBriefSizeChartDefaults(
  brief: DetailPageSuiteBrief | null | undefined,
): DetailPageSuiteBrief {
  const base = brief ?? {};
  if (base.sizeChart?.tables?.length) return base;
  return {
    ...base,
    sizeChart: {
      tables: defaultDetailPageSuiteSizeChartTables(),
    },
  };
}

export function validateSizeChartTableForRender(
  table: DetailPageSuiteSizeChartTable,
): string | null {
  if (!table.headers?.length) return "尺码表缺少表头";
  if (!table.rows?.length) return "请录入至少一行尺码数据";
  for (const row of table.rows) {
    if (!row.some((c) => String(c).trim())) continue;
    if (String(row[0] ?? "").trim()) return null;
  }
  return "请录入至少一行尺码数据";
}

export async function uploadRenderedSizeChartPng(opts: {
  userId: string;
  table: DetailPageSuiteSizeChartTable;
}): Promise<string> {
  const err = validateSizeChartTableForRender(opts.table);
  if (err) throw new Error(err);
  const buf = await renderSizeChartPng(opts.table);
  return uploadCanvasUserBuffer({
    userId: opts.userId,
    buf,
    contentType: "image/png",
    ext: "png",
  });
}
