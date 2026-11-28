import { imageEditorFilterPrompt } from "@/lib/image-editor-filter-prompts";

export type ImageEditorFilterPick = {
  id: string;
  label: string;
  preview: string;
};

export type ImageEditorFilterSection = {
  key: string;
  label: string;
  items: ImageEditorFilterPick[];
};

const pick = (id: string, label: string, preview: string): ImageEditorFilterPick => ({ id, label, preview });

/** 分类与文案对齐用户参考长图；「更多风格」保留长图未列但常用的条目。 */
export const IMAGE_EDITOR_FILTER_SECTIONS: ImageEditorFilterSection[] = [
  {
    key: "vivid",
    label: "鲜艳",
    items: [
      pick("vivid", "鲜艳", "saturate(1.65) contrast(1.12)"),
      pick("filter-bright", "明亮", "brightness(1.14) contrast(1.04)"),
      pick("clear", "通透", "brightness(1.14) contrast(1.04) saturate(0.88)"),
      pick("filter-sky", "天空", "brightness(1.1) saturate(1.18) hue-rotate(6deg)"),
      pick("filter-deep-blue", "湛蓝", "saturate(1.22) hue-rotate(12deg) contrast(1.06)"),
      pick("filter-clear-bright", "清亮", "brightness(1.12) saturate(1.08) contrast(1.02)"),
    ],
  },
  {
    key: "portrait",
    label: "人物",
    items: [
      pick("natural", "自然", "contrast(1.06) saturate(0.88)"),
      pick("portrait-fair", "白皙", "brightness(1.1) contrast(0.92) saturate(0.9)"),
      pick("portrait-smooth", "磨皮", "contrast(0.88) brightness(1.06) saturate(0.94)"),
      pick("filter-sunshine", "阳光", "brightness(1.12) saturate(1.14) sepia(8%)"),
      pick("portrait-warm-sun", "暖阳", "temperature(0.16) brightness(1.08) saturate(1.1)"),
      pick("portrait-pure", "清心", "saturate(0.9) brightness(1.06) contrast(0.96)"),
    ],
  },
  {
    key: "landscape",
    label: "风景",
    items: [
      pick("scape-blue-city", "蓝色之城", "saturate(1.2) hue-rotate(14deg) contrast(1.08)"),
      pick("scape-north", "一路向北", "saturate(0.88) contrast(1.1) brightness(1.02)"),
      pick("scape-quiet", "寂静", "saturate(0.72) contrast(0.9) brightness(1.04)"),
      pick("scape-ethereal", "Ethereal", "brightness(1.1) contrast(0.86) saturate(0.82)"),
      pick("scape-monet", "莫奈花园", "saturate(1.28) brightness(1.06) hue-rotate(4deg)"),
      pick("scape-oz", "绿野仙踪", "saturate(1.35) contrast(1.04) hue-rotate(-8deg)"),
    ],
  },
  {
    key: "lomo",
    label: "LOMO",
    items: [
      pick("lomo-classic", "经典LOMO", "contrast(1.12) saturate(1.15) sepia(10%)"),
      pick("lomo-nostalgia", "怀旧", "contrast(0.86) saturate(0.72) sepia(22%)"),
      pick("lomo-vignette", "暗角", "contrast(1.08) saturate(0.95) brightness(0.96)"),
      pick("lomo-hdr", "HDR", "contrast(1.24) saturate(1.2) clarity(0.2)"),
      pick("lomo-y1", "Y1", "contrast(0.92) saturate(0.85) sepia(8%)"),
      pick("lomo-y2", "Y2", "contrast(0.88) saturate(0.8) sepia(12%)"),
    ],
  },
  {
    key: "cinematic",
    label: "电影感",
    items: [
      pick("cine-minor", "小调", "contrast(1.1) saturate(0.88) brightness(0.96)"),
      pick("cine-cyber", "赛博朋克", "saturate(1.35) hue-rotate(18deg) contrast(1.14)"),
      pick("cine-dream", "入梦", "brightness(1.08) contrast(0.88) saturate(1.05)"),
      pick("cine-midsummer", "盛夏", "saturate(1.25) brightness(1.08) sepia(10%)"),
      pick("cine-white-tea", "白茶", "brightness(1.1) saturate(0.82) contrast(0.94)"),
      pick("cine-warm-winter", "暖冬", "temperature(0.18) contrast(1.04) saturate(0.9)"),
    ],
  },
  {
    key: "chinese-photo",
    label: "中国摄影",
    items: [
      pick("cn-distant-mountain", "远山", "contrast(1.06) saturate(0.88) brightness(1.02)"),
      pick("cn-picturesque", "如画", "saturate(1.05) contrast(1.08) sepia(4%)"),
      pick("cn-ink", "墨染", "saturate(0.55) contrast(1.12) brightness(0.98)"),
      pick("cn-forbidden-red", "故宫红", "saturate(1.22) hue-rotate(8deg) contrast(1.1)"),
      pick("cn-forest", "林间", "saturate(1.08) contrast(1.1) hue-rotate(-6deg)"),
      pick("cn-serenity", "宁静", "brightness(1.04) contrast(0.94) saturate(0.86)"),
    ],
  },
  {
    key: "art",
    label: "艺术",
    items: [
      pick("art-oil", "油画", "contrast(1.14) saturate(1.12) sepia(6%)"),
      pick("art-watercolor", "水彩", "brightness(1.08) contrast(0.84) saturate(1.15)"),
      pick("art-sketch", "素描", "grayscale(0.85) contrast(1.2)"),
      pick("art-neon", "霓虹", "saturate(1.65) contrast(1.18) hue-rotate(12deg)"),
      pick("art-phantom", "幻影", "brightness(1.06) contrast(0.9) saturate(0.78)"),
      pick("art-dreamland", "梦境", "brightness(1.1) saturate(1.08) contrast(0.88)"),
    ],
  },
  {
    key: "texture",
    label: "质感",
    items: [
      pick("film", "胶片", "sepia(18%) contrast(0.9) saturate(0.78)"),
      pick("texture-instax", "Instax", "brightness(1.08) contrast(0.92) saturate(1.05)"),
      pick("texture-vintage", "Vintage", "sepia(14%) contrast(0.88) saturate(0.82)"),
      pick("texture-grain", "颗粒", "contrast(1.06) saturate(0.88)"),
      pick("texture-light", "Light", "brightness(1.14) contrast(0.86) saturate(0.9)"),
      pick("texture-dreamy", "Dreamy", "brightness(1.08) contrast(0.82) saturate(0.95)"),
    ],
  },
  {
    key: "anime",
    label: "动漫",
    items: [
      pick("anime-jp", "日系", "saturate(1.22) brightness(1.06) contrast(1.04)"),
      pick("anime-miyazaki", "宫崎骏", "saturate(1.18) contrast(0.96) brightness(1.08)"),
      pick("anime-boy", "少年", "saturate(1.1) contrast(1.08) hue-rotate(4deg)"),
      pick("anime-sakura", "樱花", "saturate(1.25) brightness(1.06) hue-rotate(6deg)"),
      pick("anime-alps", "阿尔卑斯", "saturate(1.12) contrast(1.06) brightness(1.04)"),
      pick("anime-healing", "治愈", "brightness(1.08) saturate(0.95) contrast(0.92)"),
    ],
  },
  {
    key: "xiaohongshu",
    label: "小红书风",
    items: [
      pick("xhs-french-retro", "法式复古", "sepia(10%) contrast(0.94) saturate(0.9)"),
      pick("xhs-cinematic", "电影感", "contrast(1.12) saturate(0.92) sepia(6%)"),
      pick("cream", "奶油", "brightness(1.08) contrast(0.86) saturate(0.88) sepia(12%)"),
      pick("art-morandi", "莫兰迪", "saturate(0.65) contrast(0.92) brightness(1.04)"),
      pick("xhs-salt", "盐系", "saturate(0.82) contrast(0.96) brightness(1.06)"),
      pick("xhs-hk", "港风", "contrast(1.14) saturate(1.1) sepia(8%)"),
    ],
  },
  {
    key: "product-shot",
    label: "商品图",
    items: [
      pick("product-texture", "质感", "contrast(1.16) clarity(0.35) saturate(1.06)"),
      pick("product-clear", "通透", "brightness(1.1) saturate(0.92) contrast(1.04)"),
      pick("cool-white", "冷白皮", "temperature(-0.14) brightness(1.1) saturate(0.88)"),
      pick("product-premium", "高级感", "contrast(1.08) saturate(0.92) brightness(1.02)"),
      pick("product-minimal", "极简", "saturate(0.78) contrast(1.04) brightness(1.06)"),
      pick("product-morandi", "莫兰迪", "saturate(0.68) contrast(0.94) brightness(1.04)"),
    ],
  },
  {
    key: "premium-grey",
    label: "高级灰",
    items: [
      pick("grey-elegant", "优雅", "saturate(0.62) contrast(0.96) brightness(1.04)"),
      pick("grey-steady", "稳重", "saturate(0.55) contrast(1.06) brightness(0.98)"),
      pick("grey-chilly", "冷冽", "saturate(0.58) contrast(1.1) temperature(-0.1)"),
      pick("grey-restrained", "内敛", "saturate(0.5) contrast(0.94) brightness(1.02)"),
      pick("grey-quiet", "沉静", "saturate(0.48) contrast(0.9) brightness(1.05)"),
    ],
  },
  {
    key: "film-stock",
    label: "胶片",
    items: [
      pick("film-kodak", "Kodak", "sepia(16%) contrast(0.92) saturate(0.85)"),
      pick("film-fuji", "Fuji", "saturate(1.05) contrast(0.94) sepia(8%)"),
      pick("film-agfa", "Agfa", "contrast(1.02) saturate(0.9) sepia(12%)"),
      pick("film-ilford", "Ilford", "grayscale(0.92) contrast(1.1)"),
      pick("film-gold", "Gold", "temperature(0.2) sepia(14%) saturate(1.08)"),
      pick("film-portra", "Portra", "saturate(0.88) contrast(0.9) sepia(6%) brightness(1.04)"),
    ],
  },
  {
    key: "mood",
    label: "情绪",
    items: [
      pick("mood-melancholy", "忧郁", "saturate(0.72) contrast(0.9) brightness(0.96)"),
      pick("mood-lonely", "孤独", "saturate(0.65) contrast(0.94) brightness(0.94)"),
      pick("mood-silence", "寂静", "saturate(0.58) contrast(0.88) brightness(1.02)"),
      pick("mood-confused", "迷茫", "saturate(0.7) contrast(0.86) brightness(1.04)"),
      pick("mood-warmth", "温暖", "temperature(0.18) saturate(1.05) brightness(1.06)"),
    ],
  },
  {
    key: "natural-scene",
    label: "自然",
    items: [
      pick("nat-little-joy", "小确幸", "brightness(1.06) saturate(0.95) contrast(1.02)"),
      pick("nat-little-joy-2", "小确幸II", "brightness(1.08) saturate(1.02) contrast(0.98)"),
      pick("nat-self", "利己", "contrast(1.08) saturate(0.92) brightness(1.02)"),
      pick("nat-dawn", "清晨", "brightness(1.1) saturate(0.88) contrast(0.96)"),
      pick("nat-sunshine", "阳光", "brightness(1.12) saturate(1.12) sepia(6%)"),
    ],
  },
  {
    key: "retro",
    label: "复古",
    items: [
      pick("retro-glazed-tile", "琉璃瓦", "saturate(1.15) sepia(12%) contrast(1.06)"),
      pick("retro-youth", "少年往事", "sepia(18%) contrast(0.9) saturate(0.82)"),
      pick("retro-hk", "港风", "contrast(1.14) saturate(1.08) sepia(10%)"),
      pick("retro-sunset", "夕照", "temperature(0.22) saturate(1.1) contrast(1.04)"),
      pick("retro-era", "旧时光", "sepia(20%) contrast(0.86) saturate(0.75)"),
      pick("retro-film", "复古胶片", "sepia(16%) contrast(0.88) saturate(0.78)"),
    ],
  },
  {
    key: "blues",
    label: "蓝调",
    items: [
      pick("blue-calm", "沉静", "saturate(0.88) hue-rotate(10deg) contrast(0.94)"),
      pick("blue-deep", "幽蓝", "saturate(1.08) hue-rotate(18deg) contrast(1.08)"),
      pick("blue-glacier", "冰川", "saturate(0.95) hue-rotate(14deg) brightness(1.08)"),
      pick("blue-mist", "雾蓝", "brightness(1.06) saturate(0.9) hue-rotate(12deg)"),
      pick("blue-navy", "海军蓝", "saturate(1.1) contrast(1.12) hue-rotate(16deg)"),
      pick("blue-skyline", "天际", "brightness(1.1) saturate(1.15) hue-rotate(8deg)"),
    ],
  },
  {
    key: "fashion",
    label: "时尚",
    items: [
      pick("fashion-barbie", "芭比", "saturate(1.35) brightness(1.08) contrast(1.02)"),
      pick("fashion-violet", "紫罗兰", "saturate(1.2) hue-rotate(8deg) brightness(1.04)"),
      pick("fashion-sakura-pink", "樱粉", "saturate(1.25) brightness(1.06) temperature(0.08)"),
      pick("fashion-modern", "摩登", "contrast(1.12) saturate(1.08) clarity(0.2)"),
      pick("fashion-runway", "秀场", "contrast(1.14) saturate(0.95) brightness(1.02)"),
      pick("fashion-editorial", "大片", "contrast(1.1) saturate(0.92) brightness(0.98)"),
    ],
  },
  {
    key: "sweet-girl",
    label: "少女甜美",
    items: [
      pick("sweet-peach", "蜜桃", "saturate(1.22) brightness(1.08) temperature(0.1)"),
      pick("sweet-candy", "甜甜", "saturate(1.28) brightness(1.1) contrast(0.94)"),
      pick("sweet-cream", "奶油", "brightness(1.1) saturate(0.95) contrast(0.9)"),
      pick("sweet-soft", "软糖", "saturate(1.18) brightness(1.06) contrast(0.92)"),
      pick("sweet-yogurt", "酸奶", "brightness(1.08) saturate(1.05) temperature(0.06)"),
      pick("sweet-oolong", "蜜桃乌龙", "saturate(1.15) brightness(1.06) sepia(4%)"),
    ],
  },
  {
    key: "spring",
    label: "春意盎然",
    items: [
      pick("spring-tender", "嫩绿", "saturate(1.2) hue-rotate(-6deg) brightness(1.06)"),
      pick("spring-bloom", "花信", "saturate(1.25) brightness(1.08) temperature(0.08)"),
      pick("spring-breeze", "和风", "brightness(1.06) saturate(1.1) contrast(0.96)"),
      pick("spring-sprout", "新芽", "saturate(1.3) hue-rotate(-8deg) contrast(1.02)"),
      pick("spring-light", "浅春", "brightness(1.1) saturate(1.12) contrast(0.94)"),
    ],
  },
  {
    key: "refreshing",
    label: "清爽",
    items: [
      pick("fresh-mint", "薄荷", "saturate(1.05) brightness(1.08) temperature(-0.12)"),
      pick("fresh-sea-salt", "海盐", "saturate(0.92) brightness(1.1) temperature(-0.16)"),
      pick("fresh-soda", "汽水", "saturate(1.15) brightness(1.12) contrast(1.06)"),
      pick("fresh-ice", "冰沙", "brightness(1.14) saturate(1.08) contrast(1.04)"),
      pick("fresh-cool-wind", "凉风", "saturate(0.88) brightness(1.06) temperature(-0.14)"),
      pick("fresh-piercing", "透彻", "brightness(1.12) contrast(1.06) saturate(0.95)"),
    ],
  },
];

/** 参考图「基础」行 + 常用快捷项（首页与「基础」子页）。 */
export const IMAGE_EDITOR_FILTER_BASIC_QUICK: ImageEditorFilterPick[] = [
  pick("grayscale", "灰阶", "grayscale(1)"),
  pick("cool-tone-1", "冷调1", "hue-rotate(8deg) saturate(0.92) contrast(1.04)"),
  pick("filter-sunshine", "阳光", "brightness(1.12) saturate(1.14)"),
  pick("soft", "柔美", "brightness(1.08) contrast(0.78)"),
  pick("exposure-up", "曝光", "brightness(1.16) contrast(1.02)"),
  pick("vivid", "鲜艳", "saturate(1.65) contrast(1.12)"),
];

export const IMAGE_EDITOR_FILTER_BASIC_SHEET_EXTRA: ImageEditorFilterPick[] = [
  pick("natural", "自然", "contrast(1.06) saturate(0.88)"),
  pick("dehaze", "去雾", "brightness(1.04) contrast(1.24) saturate(1.12)"),
  pick("sharpen", "锐化", "contrast(1.18)"),
  pick("aqua", "碧波", "hue-rotate(18deg) saturate(1.25)"),
  pick("hyper", "全彩", "saturate(1.85) contrast(1.12)"),
  pick("invert", "反色", "invert(1)"),
];

const FILTER_GRADE_LOOKUP = new Map<string, ImageEditorFilterPick>();
for (const section of IMAGE_EDITOR_FILTER_SECTIONS) {
  for (const item of section.items) {
    FILTER_GRADE_LOOKUP.set(item.id, item);
  }
}
for (const item of IMAGE_EDITOR_FILTER_BASIC_QUICK) {
  FILTER_GRADE_LOOKUP.set(item.id, item);
}
for (const item of IMAGE_EDITOR_FILTER_BASIC_SHEET_EXTRA) {
  FILTER_GRADE_LOOKUP.set(item.id, item);
}

export function imageEditorFilterGradeMeta(id: string): { id: string; label: string; group: "filter"; preview: string; prompt: string } | undefined {
  const item = FILTER_GRADE_LOOKUP.get(id);
  if (!item) return undefined;
  const prompt = imageEditorFilterPrompt(id) ?? "";
  return { id: item.id, label: item.label, group: "filter", preview: item.preview, prompt };
}

export function filterSectionByKey(key: string): ImageEditorFilterSection | undefined {
  return IMAGE_EDITOR_FILTER_SECTIONS.find((section) => section.key === key);
}

/** 目录内所有滤镜 id（不含仅走内置的 duplicate 注册）。 */
export function imageEditorFilterCatalogIds(): string[] {
  return [...FILTER_GRADE_LOOKUP.keys()];
}