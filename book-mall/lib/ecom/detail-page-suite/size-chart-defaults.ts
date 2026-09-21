import type { DetailPageSuiteSizeChartTable } from "./types";

/** 户外冲锋衣 · 女款外套尺码（演示样例，用户须替换为本款真实数据） */
export const DEFAULT_OUTDOOR_SIZE_CHART_TABLE: DetailPageSuiteSizeChartTable = {
  title: "女款外套尺码",
  headers: ["尺码", "型号", "后中长", "胸围", "肩宽", "袖长"],
  rows: [
    ["XS", "155/80A", "61", "104", "40.5", "55.4"],
    ["S", "160/84A", "63", "108", "41.7", "57.2"],
    ["M", "165/88A", "65", "112", "42.9", "59"],
    ["L", "170/92A", "67", "116", "44.1", "60.8"],
    ["XL", "175/96A", "69", "120", "45.3", "62.6"],
    ["XXL", "180/100A", "71", "124", "46.5", "64.4"],
    ["3XL", "185/104A", "73", "128", "47.7", "66.2"],
  ],
  isDemo: true,
};

export function defaultDetailPageSuiteSizeChartTables(): DetailPageSuiteSizeChartTable[] {
  return [{ ...DEFAULT_OUTDOOR_SIZE_CHART_TABLE, rows: DEFAULT_OUTDOOR_SIZE_CHART_TABLE.rows.map((r) => [...r]) }];
}
