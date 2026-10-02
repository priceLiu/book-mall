import type {
  DetailPageSuiteBrief,
  DetailPageSuiteModuleState,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";

export const APLUS_PRODUCT_VERTICALS = [
  "fashion_apparel",
  "bags",
  "digital_3c",
  "footwear",
  "jewelry",
  "outdoor_gear",
  "loungewear",
  "kitchenware",
  "baby_maternal",
] as const;

export type AplusProductVertical = (typeof APLUS_PRODUCT_VERTICALS)[number];

const SCENE_USAGE_COMMON = ["通勤", "办公", "居家", "户外", "礼品"];
const SCENE_DETAIL_COMMON = ["材质", "结构", "功能", "局部", "工艺", "细节"];
const SCENE_ANGLE_COMMON = ["45", "正面", "侧面", "背面"];

export function normalizeAplusProductVertical(
  raw: string | undefined,
): AplusProductVertical {
  const v = raw?.trim();
  if (v === "apparel") return "fashion_apparel";
  if (v === "general") return "fashion_apparel";
  if (APLUS_PRODUCT_VERTICALS.includes(v as AplusProductVertical)) {
    return v as AplusProductVertical;
  }
  return "fashion_apparel";
}

/** module_id → 按品类优先排序的 label 关键词（匹配 candidate_pool 项） */
const PRIORITY_BY_VERTICAL: Record<
  AplusProductVertical,
  Partial<Record<string, string[]>>
> = {
  fashion_apparel: {
    aplus_usage_scene: ["通勤", "办公", "户外", "居家"],
    aplus_scene_atmo: ["氛围", "生活方式"],
    aplus_product_detail: ["面料", "版型", "工艺", "细节", "局部"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
  },
  bags: {
    aplus_usage_scene: ["通勤", "户外", "礼品", "办公", "居家"],
    aplus_scene_atmo: ["氛围", "生活方式"],
    aplus_product_detail: ["五金", "结构", "材质", "功能", "标识", "局部", "缝线"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
  },
  digital_3c: {
    aplus_usage_scene: SCENE_USAGE_COMMON,
    aplus_scene_atmo: ["氛围", "生活方式"],
    aplus_product_detail: ["结构", "接口", "功能", "屏幕", "材质", "局部"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
    aplus_core_sp: ["单卖点", "双卖点", "三卖点", "多卖点"],
  },
  footwear: {
    aplus_usage_scene: ["运动", "户外", "通勤", "日常", "街头"],
    aplus_product_detail: ["鞋底", "缓震", "材质", "走线", "透气", "防滑"],
    aplus_multi_angle: ["侧面", "45", "鞋底", "正面", "背面"],
  },
  jewelry: {
    aplus_usage_scene: ["送礼", "约会", "通勤", "仪式", "日常"],
    aplus_product_detail: ["镶嵌", "材质", "工艺", "微距", "刻字", "光泽"],
    aplus_multi_angle: ["正面", "45", "佩戴", "细节", "礼盒"],
  },
  outdoor_gear: {
    aplus_usage_scene: ["露营", "徒步", "户外", "旅行", "野餐"],
    aplus_product_detail: ["结构", "材质", "功能", "收纳", "防水", "轻量"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
  },
  loungewear: {
    aplus_usage_scene: ["居家", "卧室", "客厅", "休闲", "周末"],
    aplus_product_detail: ["面料", "亲肤", "走线", "版型", "柔软", "透气"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
  },
  kitchenware: {
    aplus_usage_scene: ["厨房", "居家", "做饭", "收纳", "租房"],
    aplus_product_detail: ["不粘", "材质", "密封", "把手", "清洗", "耐用"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
  },
  baby_maternal: {
    aplus_usage_scene: ["居家", "喂养", "出行", "夜间", "护理"],
    aplus_product_detail: ["材质", "安全", "防漏", "亲肤", "消毒", "透气"],
    aplus_multi_angle: SCENE_ANGLE_COMMON,
  },
};

function rankPoolItems(pool: string[], priorities: string[]): string[] {
  if (priorities.length === 0) return [...pool];
  const score = (label: string) => {
    const t = label.trim();
    const idx = priorities.findIndex((p) => t.includes(p));
    return idx >= 0 ? idx : priorities.length + pool.indexOf(label);
  };
  return [...pool].sort((a, b) => score(a) - score(b));
}

export function autoMatchAplusSelectedItems(
  mod: Pick<DetailPageSuiteModuleState, "module_id" | "candidate_pool" | "generate_count">,
  opts: { vertical: AplusProductVertical },
): string[] {
  const n = Math.max(0, mod.generate_count);
  if (n === 0) return [];
  const pool = mod.candidate_pool.filter(Boolean);
  if (pool.length === 0) return [];
  const priorities = PRIORITY_BY_VERTICAL[opts.vertical][mod.module_id] ?? [];
  const ordered = rankPoolItems(pool, priorities);
  const selected: string[] = [];
  for (const label of ordered) {
    if (selected.length >= n) break;
    if (!selected.includes(label)) selected.push(label);
  }
  if (selected.length < n) {
    for (const label of pool) {
      if (selected.length >= n) break;
      if (!selected.includes(label)) selected.push(label);
    }
  }
  return selected.slice(0, n);
}

export function applyAutoMatchToSuite(
  suite: DetailPageSuiteState,
  brief: DetailPageSuiteBrief | null | undefined,
): DetailPageSuiteState {
  const vertical = normalizeAplusProductVertical(brief?.productVertical);
  const modules = suite.modules.map((m) => {
    if (!m.enable || m.generate_count < 1) return m;
    const selected = autoMatchAplusSelectedItems(m, { vertical });
    return { ...m, selected_item_list: selected };
  });
  return { ...suite, modules };
}
