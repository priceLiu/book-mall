import type { EcomStylePreset, EcomStylePresetVertical } from "./types";

function layout(
  id: string,
  title: string,
  layoutPrompt: string,
  verticals: EcomStylePresetVertical[] = [],
  subtitle?: string,
): EcomStylePreset {
  return {
    id,
    kind: "sellpoint_layout",
    verticals,
    title,
    subtitle,
    layoutPrompt,
    sortOrder: 0,
  };
}

function trending(
  id: string,
  title: string,
  subtitle: string,
  visualPrompt: string,
  vertical: EcomStylePresetVertical,
  palette: string[],
): EcomStylePreset {
  return {
    id,
    kind: "trending_visual",
    verticals: [vertical],
    title,
    subtitle,
    visualPrompt,
    palette,
    sortOrder: 0,
  };
}

const SELLPOINT_LAYOUTS: EcomStylePreset[] = [];

const TRENDING_3C: EcomStylePreset[] = [
  trending(
    "tv-3c-esports",
    "冷峻电竞风",
    "契合核心玩家审美",
    "高对比暗色背景，霓虹点缀，产品轮廓光，电竞桌面氛围",
    "digital_3c",
    ["#FF6B00", "#1A1A1A", "#00D4FF"],
  ),
  trending(
    "tv-3c-minimal-tech",
    "简约科技风",
    "突出品质，适合办公/学习场景",
    "白/浅灰背景，柔和阴影，产品居中，克制排版",
    "digital_3c",
    ["#FF6B00", "#F5F5F7", "#1D1D1F"],
  ),
  trending(
    "tv-3c-warm-home",
    "暖阳居家风",
    "贴近放松的居家氛围",
    "暖色自然光，木质/布艺元素，生活化场景",
    "digital_3c",
    ["#FF6B00", "#F4E4D4", "#8B6914"],
  ),
  trending(
    "tv-3c-vibrant",
    "活力阳光风",
    "突出明亮活泼的产品属性",
    "高明度背景，清新配色，轻运动/户外暗示",
    "digital_3c",
    ["#FF6B00", "#87CEEB", "#FFD700"],
  ),
  trending(
    "tv-3c-business",
    "商务沉稳风",
    "适合职场与差旅场景",
    "深蓝/深灰背景，金属质感，简洁线条",
    "digital_3c",
    ["#2C3E50", "#ECF0F1", "#3498DB"],
  ),
  trending(
    "tv-3c-desk-aesthetic",
    "桌面美学风",
    "适合键鼠/音频/桌面配件",
    "整洁桌面俯拍，同色系配件搭配，Ins 风",
    "digital_3c",
    ["#E8E8ED", "#1D1D1F", "#007AFF"],
  ),
];

const TRENDING_FASHION: EcomStylePreset[] = [
  trending(
    "tv-fashion-office",
    "职场办公风",
    "干练通勤场景",
    "办公室/通勤光线，中性色背景，强调版型与质感",
    "fashion_apparel",
    ["#2C3E50", "#ECF0F1", "#95A5A6"],
  ),
  trending(
    "tv-fashion-casual",
    "日常休闲风",
    "周末出街氛围",
    "街头/咖啡馆自然光，轻松穿搭",
    "fashion_apparel",
    ["#F5F5F7", "#FF9500", "#34C759"],
  ),
  trending(
    "tv-fashion-street",
    "潮流街头风",
    "年轻潮流感",
    "高饱和点缀，涂鸦/城市背景虚化",
    "fashion_apparel",
    ["#1A1A1A", "#FF3B30", "#FFD60A"],
  ),
  trending(
    "tv-fashion-outdoor",
    "户外机能风",
    "功能与场景并重",
    "自然户外光，机能细节特写",
    "fashion_apparel",
    ["#3D5A45", "#87CEEB", "#F4A460"],
  ),
  trending(
    "tv-fashion-minimal",
    "极简高级风",
    "留白与质感",
    "大面积留白，低饱和，面料特写",
    "fashion_apparel",
    ["#FAFAFA", "#1D1D1F", "#C0C0C0"],
  ),
  trending(
    "tv-fashion-soft",
    "温柔气质风",
    "柔和女性向",
    "pastel 色调，柔光，生活化场景",
    "fashion_apparel",
    ["#FADADD", "#FFF5EE", "#D8BFD8"],
  ),
];

const TRENDING_BAGS: EcomStylePreset[] = [
  trending(
    "tv-bags-luxury",
    "轻奢质感风",
    "强调皮质与五金",
    "深色背景，侧光突出皮质纹理与五金反光",
    "bags",
    ["#1A1A1A", "#C9A962", "#4A4A4A"],
  ),
  trending(
    "tv-bags-commute",
    "通勤实用风",
    "都市通勤场景",
    "地铁/写字楼暗示，包型清晰，容量卖点",
    "bags",
    ["#34495E", "#ECF0F1", "#2ECC71"],
  ),
  trending(
    "tv-bags-travel",
    "旅行探索风",
    "大容量与耐用",
    "机场/旅途元素，动态携包",
    "bags",
    ["#3498DB", "#F39C12", "#ECF0F1"],
  ),
  trending(
    "tv-bags-street",
    "街头潮流风",
    "年轻背携",
    "街拍角度，潮流穿搭",
    "bags",
    ["#1A1A1A", "#E74C3C", "#F1C40F"],
  ),
  trending(
    "tv-bags-minimal",
    "极简结构风",
    "包型轮廓",
    "纯色背景，强调包型线条",
    "bags",
    ["#F5F5F7", "#1D1D1F", "#86868B"],
  ),
  trending(
    "tv-bags-cafe",
    "咖啡馆氛围风",
    "生活方式种草",
    "暖色室内，桌边静置或轻携",
    "bags",
    ["#D7CCC8", "#8D6E63", "#FFF8E1"],
  ),
];

const TRENDING_GENERIC: EcomStylePreset[] = [
  trending(
    "tv-gen-clean",
    "干净白底风",
    "通用电商主图",
    "纯白或浅灰渐变底，产品居中，轻微阴影",
    "generic",
    ["#FFFFFF", "#F5F5F7", "#86868B"],
  ),
  trending(
    "tv-gen-lifestyle",
    "生活场景风",
    "代入使用场景",
    "真实家居/办公场景，自然光",
    "generic",
    ["#FAFAFA", "#34C759", "#FF9500"],
  ),
  trending(
    "tv-gen-premium",
    "高端质感风",
    "提升品牌感",
    "暗色背景，轮廓光，精致排版",
    "generic",
    ["#1D1D1F", "#C9A962", "#4A4A4A"],
  ),
  trending(
    "tv-gen-fresh",
    "清新自然风",
    "明亮亲和",
    "高明度，绿植/自然元素点缀",
    "generic",
    ["#E8F5E9", "#81C784", "#FFFDE7"],
  ),
];

let sort = 0;
function withSort(items: EcomStylePreset[]): EcomStylePreset[] {
  return items.map((p) => ({ ...p, sortOrder: sort++ }));
}

export const ECOM_STYLE_PRESET_CATALOG: EcomStylePreset[] = withSort([
  ...SELLPOINT_LAYOUTS,
  ...TRENDING_3C,
  ...TRENDING_FASHION,
  ...TRENDING_BAGS,
  ...TRENDING_GENERIC,
]);

export function getStylePresetById(id: string): EcomStylePreset | null {
  const t = id.trim();
  return ECOM_STYLE_PRESET_CATALOG.find((p) => p.id === t) ?? null;
}

export function resolveStylePresets(ids: string[]): EcomStylePreset[] {
  const out: EcomStylePreset[] = [];
  for (const id of ids) {
    const p = getStylePresetById(id);
    if (p) out.push(p);
  }
  return out;
}

export function matchesVerticalSeed(
  preset: EcomStylePreset,
  vertical: EcomStylePresetVertical,
): boolean {
  if (preset.verticals.length === 0) return true;
  if (vertical === "generic") return true;
  return preset.verticals.includes(vertical) || preset.verticals.includes("generic");
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let s = hashSeed(seed || "0");
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function listStylePresetsFromSeed(opts: {
  kind: import("./types").EcomStylePresetKind;
  vertical?: EcomStylePresetVertical;
  limit?: number;
  offset?: number;
  seed?: string;
}): EcomStylePreset[] {
  const vertical = opts.vertical ?? "generic";
  let items = ECOM_STYLE_PRESET_CATALOG.filter(
    (p) => p.kind === opts.kind && matchesVerticalSeed(p, vertical),
  );
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  if (opts.seed) {
    items = shuffleWithSeed(items, opts.seed);
  }
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  return items.slice(offset, offset + limit);
}

export function suggestTrendingStylePresetsFromSeed(opts: {
  vertical?: EcomStylePresetVertical;
  limit?: number;
  seed?: string;
}): EcomStylePreset[] {
  return listStylePresetsFromSeed({
    kind: "trending_visual",
    vertical: opts.vertical ?? "generic",
    limit: opts.limit ?? 4,
    seed: opts.seed ?? String(Date.now()),
  });
}

export function isProVerticalId(id: string): id is EcomStylePresetVertical {
  return (
    id === "fashion_apparel" ||
    id === "bags" ||
    id === "digital_3c" ||
    id === "generic"
  );
}
