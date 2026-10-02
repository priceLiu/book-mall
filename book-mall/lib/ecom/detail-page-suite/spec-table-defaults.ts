import type { DetailPageSuiteSizeChartTable } from "./types";

/** 通用商品参数（演示样例，上架前须替换为本款真实数据） */
export const DEFAULT_PRODUCT_SPEC_TABLE: DetailPageSuiteSizeChartTable = {
  title: "商品规格参数",
  headers: ["参数", "值"],
  rows: [
    ["品牌", "示例品牌"],
    ["品名", "示例商品"],
    ["型号", "X-2026"],
    ["材质", "锦纶 + 聚酯纤维"],
    ["尺寸", "见包装说明"],
    ["净重", "约 480g"],
    ["产地", "中国"],
  ],
  isDemo: true,
};

export function defaultDetailPageSuiteSpecChartTables(): DetailPageSuiteSizeChartTable[] {
  return [
    {
      ...DEFAULT_PRODUCT_SPEC_TABLE,
      rows: DEFAULT_PRODUCT_SPEC_TABLE.rows.map((r) => [...r]),
    },
  ];
}
