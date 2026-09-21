import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import { parseSuiteSlotKey } from "@/lib/detail-page-suite-slot-selection";
import type {
  DetailPageSuiteBrief,
  DetailPageSuiteProject,
  DetailPageSuiteSizeChartTable,
  DetailPageSuiteSlot,
} from "@/lib/detail-page-suite-types";

export type { DetailPageSuiteSizeChartTable };

export const DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL = "尺码数据总表图";
export const DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER =
  "[detail-page-suite:size-chart-render]";

export function isDetailPageSuiteSizeChartDataLabel(itemLabel: string | undefined): boolean {
  const label = itemLabel?.trim() ?? "";
  return (
    label === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL ||
    label.startsWith("尺码数据总表")
  );
}

export function isDetailPageSuiteSizeChartPromptMarker(prompt: string | undefined): boolean {
  return prompt?.trim() === DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER;
}

/** 尺码数据总表：本地 SVG 渲染出图，不经 Gateway 生图模型 */
export function isProgrammaticSizeChartRenderSlot(
  slot: Pick<DetailPageSuiteSlot, "item_label" | "positive_prompt">,
): boolean {
  return (
    isDetailPageSuiteSizeChartDataLabel(slot.item_label) &&
    isDetailPageSuiteSizeChartPromptMarker(slot.positive_prompt)
  );
}

export function partitionDetailPageSuiteImageGenKeys(
  project: DetailPageSuiteProject,
  keys: string[],
): { programmaticKeys: string[]; modelKeys: string[] } {
  const programmaticKeys: string[] = [];
  const modelKeys: string[] = [];
  for (const key of keys) {
    const parsed = parseSuiteSlotKey(key);
    if (!parsed) {
      modelKeys.push(key);
      continue;
    }
    const mod = project.suite.modules.find((m) => m.module_id === parsed.moduleId);
    const slot = mod
      ? resolveModuleDisplaySlots(mod).find((s) => s.item_key === parsed.slotKey)
      : undefined;
    if (slot && isProgrammaticSizeChartRenderSlot(slot)) programmaticKeys.push(key);
    else modelKeys.push(key);
  }
  return { programmaticKeys, modelKeys };
}

/** 与 book-mall size-chart-defaults 演示数据一致 */
export const DEMO_SIZE_CHART_TABLE: DetailPageSuiteSizeChartTable = {
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

export function resolveSizeChartTableIndexForLabel(itemLabel: string | undefined): number {
  const label = itemLabel?.trim() ?? "";
  if (label === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL) return 0;
  const m = label.match(/^尺码数据总表图 \((\d+)\)$/);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    return Number.isFinite(n) && n >= 2 ? n - 1 : 0;
  }
  return 0;
}

export function resolveSizeChartTableForSlot(
  brief: DetailPageSuiteBrief | null | undefined,
  tableIndex = 0,
): DetailPageSuiteSizeChartTable {
  const tables = brief?.sizeChart?.tables;
  if (tables?.length) {
    const t = tables[Math.min(Math.max(0, tableIndex), tables.length - 1)]!;
    if (t.headers?.length && t.rows?.length) return t;
  }
  return cloneSizeChartTable(DEMO_SIZE_CHART_TABLE);
}

export function resolvePrimarySizeChartTable(
  brief: DetailPageSuiteBrief | null | undefined,
): DetailPageSuiteSizeChartTable {
  return resolveSizeChartTableForSlot(brief, 0);
}

export function upsertSizeChartTableInBrief(
  brief: DetailPageSuiteBrief | null | undefined,
  tableIndex: number,
  table: DetailPageSuiteSizeChartTable,
): DetailPageSuiteBrief {
  const base = brief ?? {};
  const tables = [...(base.sizeChart?.tables ?? [])];
  while (tables.length <= tableIndex) {
    tables.push(cloneSizeChartTable(DEMO_SIZE_CHART_TABLE));
  }
  tables[tableIndex] = table;
  return { ...base, sizeChart: { ...(base.sizeChart ?? {}), tables } };
}

export function cloneSizeChartTable(
  table: DetailPageSuiteSizeChartTable,
): DetailPageSuiteSizeChartTable {
  return {
    ...table,
    headers: [...table.headers],
    rows: table.rows.map((r) => [...r]),
  };
}

function uniqueSizeChartTableTitle(
  title: string,
  existing: DetailPageSuiteSizeChartTable[],
): string {
  const base = title.trim() || "尺码表";
  const taken = new Set(existing.map((t) => t.title?.trim()).filter(Boolean));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}

/** 保证 brief 中至少有 minCount 张表（与已有「尺码数据总表」点位一一对应） */
export function ensureSizeChartBriefTableCount(
  brief: DetailPageSuiteBrief | null | undefined,
  minCount: number,
): DetailPageSuiteBrief {
  const base = brief ?? {};
  const tables = [...(base.sizeChart?.tables ?? [])];
  while (tables.length < minCount) {
    const template = cloneSizeChartTable(DEMO_SIZE_CHART_TABLE);
    template.title = uniqueSizeChartTableTitle(template.title ?? "女款外套尺码", tables);
    template.isDemo = true;
    tables.push(template);
  }
  return { ...base, sizeChart: { ...(base.sizeChart ?? {}), tables } };
}

/** 新增一张默认尺码表 + 对应 brief 表数据 */
export function appendDefaultSizeChartTableToBrief(
  brief: DetailPageSuiteBrief | null | undefined,
): { brief: DetailPageSuiteBrief; table: DetailPageSuiteSizeChartTable; label: string } {
  const base = brief ?? {};
  const tables = [...(base.sizeChart?.tables ?? [])];
  const template = cloneSizeChartTable(DEMO_SIZE_CHART_TABLE);
  template.title = uniqueSizeChartTableTitle(template.title ?? "女款外套尺码", tables);
  template.isDemo = true;
  tables.push(template);
  const slotLabel =
    tables.length <= 1
      ? DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL
      : `${DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL} (${tables.length})`;

  return {
    brief: { ...base, sizeChart: { ...(base.sizeChart ?? {}), tables } },
    table: template,
    label: slotLabel,
  };
}
