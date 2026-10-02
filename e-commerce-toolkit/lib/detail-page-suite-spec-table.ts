import type {
  DetailPageSuiteBrief,
  DetailPageSuiteSizeChartTable,
} from "@/lib/detail-page-suite-types";

export const DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL = "商品参数总表图";
export const DETAIL_PAGE_SUITE_SPEC_CHART_PROMPT_MARKER =
  "[detail-page-suite:spec-table-render]";
export const AI_DETAIL_PAGE_SPEC_MODULE_ID = "aplus_spec_table";

export function isDetailPageSuiteSpecChartModuleId(moduleId: string): boolean {
  return moduleId === AI_DETAIL_PAGE_SPEC_MODULE_ID;
}

export function isDetailPageSuiteSpecChartDataLabel(itemLabel: string | undefined): boolean {
  const label = itemLabel?.trim() ?? "";
  return (
    label === DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL ||
    label.startsWith("商品参数总表")
  );
}

export function isDetailPageSuiteSpecChartPromptMarker(prompt: string | undefined): boolean {
  return prompt?.trim() === DETAIL_PAGE_SUITE_SPEC_CHART_PROMPT_MARKER;
}

export function isDetailPageSuiteTableDataModuleId(moduleId: string): boolean {
  return (
    moduleId === "mod7_size_table" ||
    moduleId === "aplus_size_capacity" ||
    isDetailPageSuiteSpecChartModuleId(moduleId)
  );
}

export function isProgrammaticSpecChartRenderSlot(slot: {
  item_label: string;
  positive_prompt?: string;
}): boolean {
  return (
    isDetailPageSuiteSpecChartDataLabel(slot.item_label) &&
    isDetailPageSuiteSpecChartPromptMarker(slot.positive_prompt)
  );
}

/** 与 book-mall spec-table-defaults 演示数据一致 */
export const DEMO_SPEC_CHART_TABLE: DetailPageSuiteSizeChartTable = {
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

export function resolveSpecChartTableIndexForLabel(itemLabel: string | undefined): number {
  const label = itemLabel?.trim() ?? "";
  if (label === DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL) return 0;
  const m = label.match(/^商品参数总表图 \((\d+)\)$/);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    return Number.isFinite(n) && n >= 2 ? n - 1 : 0;
  }
  return 0;
}

export function resolveSpecChartTableForSlot(
  brief: DetailPageSuiteBrief | null | undefined,
  tableIndex = 0,
): DetailPageSuiteSizeChartTable {
  const tables = brief?.specChart?.tables;
  if (tables?.length) {
    const t = tables[Math.min(Math.max(0, tableIndex), tables.length - 1)]!;
    if (t.headers?.length && t.rows?.length) return t;
  }
  return cloneSpecChartTable(DEMO_SPEC_CHART_TABLE);
}

export function upsertSpecChartTableInBrief(
  brief: DetailPageSuiteBrief | null | undefined,
  tableIndex: number,
  table: DetailPageSuiteSizeChartTable,
): DetailPageSuiteBrief {
  const base = brief ?? {};
  const tables = [...(base.specChart?.tables ?? [])];
  while (tables.length <= tableIndex) {
    tables.push(cloneSpecChartTable(DEMO_SPEC_CHART_TABLE));
  }
  tables[tableIndex] = table;
  return { ...base, specChart: { ...(base.specChart ?? {}), tables } };
}

export function cloneSpecChartTable(
  table: DetailPageSuiteSizeChartTable,
): DetailPageSuiteSizeChartTable {
  return {
    ...table,
    headers: [...table.headers],
    rows: table.rows.map((r) => [...r]),
  };
}

function uniqueSpecChartTableTitle(
  title: string,
  existing: DetailPageSuiteSizeChartTable[],
): string {
  const base = title.trim() || "商品规格参数";
  const taken = new Set(existing.map((t) => t.title?.trim()).filter(Boolean));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}

export function ensureSpecChartBriefTableCount(
  brief: DetailPageSuiteBrief | null | undefined,
  minCount: number,
): DetailPageSuiteBrief {
  const base = brief ?? {};
  const tables = [...(base.specChart?.tables ?? [])];
  while (tables.length < minCount) {
    const template = cloneSpecChartTable(DEMO_SPEC_CHART_TABLE);
    template.title = uniqueSpecChartTableTitle(template.title ?? "商品规格参数", tables);
    template.isDemo = true;
    tables.push(template);
  }
  return { ...base, specChart: { ...(base.specChart ?? {}), tables } };
}

export function appendDefaultSpecChartTableToBrief(
  brief: DetailPageSuiteBrief | null | undefined,
): { brief: DetailPageSuiteBrief; table: DetailPageSuiteSizeChartTable; label: string } {
  const base = brief ?? {};
  const tables = [...(base.specChart?.tables ?? [])];
  const template = cloneSpecChartTable(DEMO_SPEC_CHART_TABLE);
  template.title = uniqueSpecChartTableTitle(template.title ?? "商品规格参数", tables);
  template.isDemo = true;
  tables.push(template);
  const slotLabel =
    tables.length <= 1
      ? DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL
      : `${DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL} (${tables.length})`;

  return {
    brief: { ...base, specChart: { ...(base.specChart ?? {}), tables } },
    table: template,
    label: slotLabel,
  };
}
