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
  /** 查看更多子页首格展示「无滤镜」 */
  sheetNoFilter?: boolean;
};

const pick = (id: string, label: string, preview: string): ImageEditorFilterPick => ({ id, label, preview });

/** 分类与文案对齐用户参考长图；「更多风格」保留长图未列但常用的条目。 */
/** 滤镜 Tab「基础」· 查看更多（参考图 IMAX / 怀旧时光…） */
export const IMAGE_EDITOR_BASIC_FILTER_SECTION: ImageEditorFilterSection = {
  key: "basic",
  label: "基础",
  sheetNoFilter: true,
  items: [
    pick("basic-imax", "IMAX胶片", "contrast(1.12) saturate(1.05) sepia(8%)"),
    pick("basic-nostalgia-time", "怀旧时光", "sepia(16%) contrast(0.9) saturate(0.85)"),
    pick("basic-chrome", "克罗姆", "contrast(1.22) saturate(1.15) clarity(0.2)"),
    pick("basic-romantic-purple", "浪漫紫", "saturate(1.15) hue-rotate(12deg) brightness(1.04)"),
    pick("basic-healing-tone", "治愈", "brightness(1.1) saturate(0.95) contrast(0.92)"),
    pick("basic-neon-dream", "霓幻", "saturate(1.45) hue-rotate(14deg) contrast(1.08)"),
    pick("basic-french-low", "法式低饱和", "saturate(0.72) contrast(0.94) brightness(1.06)"),
    pick("basic-mint-blue", "薄荷蓝", "saturate(1.05) temperature(-0.18) brightness(1.08)"),
    pick("basic-california", "加州", "brightness(1.12) saturate(1.18) temperature(0.16) sepia(10%)"),
  ],
};

export const IMAGE_EDITOR_FILTER_SECTIONS: ImageEditorFilterSection[] = [
  {
    key: "healing",
    label: "智愈",
    items: [
      pick("heal-glazed-tea", "琉璃茶", "saturate(0.95) brightness(1.06) contrast(0.96)"),
      pick("heal-youth", "少年意气", "saturate(1.08) contrast(1.06) brightness(1.04)"),
      pick("heal-shanghai", "沪上", "sepia(8%) contrast(0.94) saturate(0.9)"),
      pick("heal-lobby", "大堂", "contrast(1.04) brightness(1.02) saturate(0.88)"),
      pick("heal-popular", "大众", "saturate(0.92) contrast(1.02) brightness(1.04)"),
      pick("heal-love-letter", "小情书", "brightness(1.08) contrast(0.9) saturate(1.05)"),
    ],
  },
  {
    key: "vivid",
    label: "鲜艳",
    items: [
      pick("filter-vivid", "鲜艳", "saturate(1.65) contrast(1.12)"),
      pick("filter-bright", "明亮", "brightness(1.14) contrast(1.04)"),
      pick("product-clear", "通透", "brightness(1.1) saturate(0.92) contrast(1.04)"),
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
    key: "boy-power",
    label: "男友力",
    sheetNoFilter: true,
    items: [
      pick("boy-tn1", "青葱TN1", "saturate(1.08) brightness(1.1) temperature(-0.06) contrast(1.04)"),
      pick("boy-bitter-tea-tn2", "苦丁茶TN2", "saturate(0.92) contrast(0.96) temperature(-0.04) brightness(1.04)"),
      pick("boy-youth-tn3", "少年TN3", "contrast(1.14) saturate(1.05) clarity(0.18) brightness(1.02)"),
      pick("boy-old-street-tn5", "老街TN5", "saturate(0.78) contrast(0.94) sepia(10%) brightness(1.02)"),
      pick("boy-power-tn6", "男友力TN6", "contrast(1.06) saturate(1.02) brightness(1.04) temperature(0.02)"),
      pick("boy-tn11", "TN11", "saturate(1.12) hue-rotate(-14deg) contrast(1.08) brightness(1.02)"),
      pick("boy-hormone-tn12", "荷尔蒙TN12", "brightness(1.12) saturate(1.1) temperature(0.1) contrast(1.06)"),
      pick("boy-fresh-blue", "清新蓝", "saturate(1.05) temperature(-0.18) brightness(1.1) contrast(0.96)"),
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
    label: "中国颜色",
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
    key: "china-trend",
    label: "中国潮色",
    sheetNoFilter: true,
    items: [
      pick("cn-trend-mu1", "国风MU1", "saturate(1.05) contrast(1.06) sepia(6%)"),
      pick("cn-trend-mu7", "MU7-国风", "contrast(1.08) saturate(0.92) brightness(1.02)"),
      pick("cn-trend-sacred-gold", "圣鉴金", "temperature(0.16) saturate(1.12) contrast(1.08)"),
      pick("cn-trend-cinnabar", "朱砂红", "saturate(1.28) hue-rotate(6deg) contrast(1.1)"),
      pick("cn-trend-eaves-brown", "暮檐褐", "sepia(14%) contrast(0.94) saturate(0.88)"),
      pick("cn-trend-ink-black", "水墨黑", "saturate(0.35) contrast(1.14) brightness(0.96)"),
      pick("cn-trend-dawn-green", "晓山青", "saturate(1.05) hue-rotate(-12deg) brightness(1.04)"),
      pick("cn-trend-hibiscus", "木槿紫", "saturate(1.1) hue-rotate(12deg) contrast(0.96)"),
      pick("cn-trend-silver", "素晖银", "saturate(0.62) contrast(1.02) brightness(1.08)"),
      pick("cn-trend-sunset-orange", "落暖橘", "temperature(0.2) saturate(1.18) brightness(1.06)"),
      pick("cn-trend-dye-pink", "黛子粉", "saturate(1.12) brightness(1.08) contrast(0.94)"),
      pick("cn-trend-porcelain-blue", "青花蓝", "saturate(1.08) hue-rotate(16deg) contrast(1.04)"),
      pick("cn-trend-misty-gray", "烟雨灰", "saturate(0.55) contrast(0.92) brightness(1.06)"),
      pick("cn-trend-ink-green", "墨油绿", "saturate(0.85) hue-rotate(-18deg) contrast(1.1)"),
      pick("cn-trend-vine-yellow", "藤枝黄", "saturate(1.15) brightness(1.08) temperature(0.12)"),
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
    key: "oil-painting",
    label: "油画",
    sheetNoFilter: true,
    items: [
      pick("oil-light-cream", "淡奶油", "brightness(1.1) contrast(0.88) saturate(0.92) sepia(10%)"),
      pick("oil-soda", "苏打", "brightness(1.12) saturate(1.08) temperature(-0.1) contrast(1.04)"),
      pick("oil-silk", "丝绸", "saturate(0.88) contrast(0.94) brightness(1.06) clarity(0.12)"),
      pick("oil-gentle", "温柔", "saturate(1.05) brightness(1.08) temperature(0.08) contrast(0.9)"),
      pick("oil-pearlescent", "珠光", "brightness(1.16) contrast(0.92) saturate(1.02) clarity(0.2)"),
      pick("oil-matte-dark", "亚暗", "contrast(0.88) saturate(0.82) brightness(0.94)"),
      pick("oil-monet", "莫奈", "saturate(1.28) hue-rotate(8deg) contrast(1.08) brightness(1.04)"),
      pick("oil-painting-ii", "油画II", "contrast(1.22) saturate(1.35) sepia(8%)"),
      pick("oil-painting", "油画", "contrast(1.14) saturate(1.12) sepia(6%)"),
    ],
  },
  {
    key: "blue-comp",
    label: "蓝构",
    items: [
      pick("comp-blue-deep", "Deep", "saturate(1.05) contrast(1.1) brightness(0.96)"),
      pick("comp-blue-light", "LightBlue", "brightness(1.1) saturate(1.12) hue-rotate(8deg)"),
      pick("comp-blue-midnight", "Midnight", "saturate(0.9) contrast(1.12) brightness(0.92)"),
      pick("comp-blue-classic", "经典蓝", "saturate(1.1) hue-rotate(14deg) contrast(1.06)"),
      pick("comp-blue-cyan", "LightCyan", "brightness(1.08) saturate(1.05) hue-rotate(12deg)"),
      pick("comp-blue-ultra", "UltraBlue", "saturate(1.22) hue-rotate(18deg) contrast(1.08)"),
    ],
  },
  {
    key: "rhythm",
    label: "韵律",
    items: [
      pick("rhythm-spring-cherry", "春樱", "saturate(1.2) brightness(1.06) hue-rotate(4deg)"),
      pick("rhythm-midsummer", "盛夏", "saturate(1.25) brightness(1.08) sepia(10%)"),
      pick("rhythm-autumn", "秋夕", "saturate(1.05) sepia(12%) contrast(1.04)"),
      pick("rhythm-warm-winter", "冬暖", "temperature(0.18) contrast(1.04) saturate(0.9)"),
      pick("rhythm-evening", "晚风中", "saturate(0.9) brightness(1.04) contrast(0.94)"),
      pick("rhythm-winter-start", "立冬", "saturate(0.85) contrast(1.02) brightness(0.98)"),
    ],
  },
  {
    key: "psych-room",
    label: "心理室",
    items: [
      pick("psych-depressed", "郁闷", "saturate(0.7) contrast(0.88) brightness(0.94)"),
      pick("psych-calm", "平静", "saturate(0.82) contrast(0.94) brightness(1.04)"),
      pick("psych-oppressive", "压抑", "saturate(0.65) contrast(1.04) brightness(0.9)"),
      pick("psych-aloof", "高冷", "saturate(0.75) contrast(1.06) temperature(-0.12)"),
      pick("psych-steady", "沉稳", "saturate(0.6) contrast(1.08) brightness(0.96)"),
      pick("psych-warm", "热烈", "saturate(1.15) contrast(1.06) temperature(0.14)"),
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
      pick("product-cool-white", "冷白皮", "temperature(-0.14) brightness(1.1) saturate(0.88)"),
      pick("product-premium", "高级感", "contrast(1.08) saturate(0.92) brightness(1.02)"),
      pick("product-minimal", "极简", "saturate(0.78) contrast(1.04) brightness(1.06)"),
      pick("product-morandi", "莫兰迪", "saturate(0.68) contrast(0.94) brightness(1.04)"),
    ],
  },
  {
    key: "food",
    label: "美食",
    sheetNoFilter: true,
    items: [
      pick("food-chef", "料理家", "saturate(1.2) contrast(1.08) temperature(0.1)"),
      pick("food-midnight-diner", "深夜食堂", "brightness(0.94) contrast(1.12) saturate(1.05) sepia(8%)"),
      pick("food-bbq", "烧烤", "saturate(1.28) contrast(1.14) temperature(0.16)"),
      pick("food-eight-treasures", "八宝", "saturate(1.22) contrast(1.06) temperature(0.12)"),
      pick("food-bagel", "贝果", "brightness(1.08) saturate(1.1) sepia(10%)"),
      pick("food-snack-time", "小食光", "brightness(1.06) saturate(1.15) contrast(1.02)"),
      pick("cream", "奶油", "brightness(1.08) contrast(0.86) saturate(0.88) sepia(12%)"),
      pick("food-pink-bread", "粉花面包", "saturate(1.18) brightness(1.08) temperature(0.08)"),
      pick("food-brunch", "Brunch", "brightness(1.1) saturate(1.2) contrast(1.04)"),
      pick("food-grapefruit", "西柚", "saturate(1.25) brightness(1.06) hue-rotate(4deg)"),
      pick("food-souffle", "舒芙蕾", "brightness(1.12) contrast(0.9) saturate(1.05)"),
      pick("food-light-meal", "轻食", "saturate(1.08) brightness(1.08) contrast(0.96)"),
      pick("food-cuisine", "料理", "saturate(1.22) contrast(1.1) clarity(0.2)"),
      pick("food-soffle", "Soffle", "brightness(1.1) contrast(0.88) saturate(1.08)"),
      pick("food-orange-soda", "橘子汽水", "saturate(1.35) brightness(1.1) temperature(0.14)"),
      pick("food-hearth", "围炉", "temperature(0.2) contrast(1.08) saturate(1.12) sepia(12%)"),
      pick("food-appetite", "食欲", "saturate(1.32) contrast(1.1) temperature(0.18)"),
      pick("food-mousse", "Mousse", "brightness(1.08) contrast(0.92) saturate(1.12)"),
      pick("food-mini-pomelo", "小蜜柚", "saturate(1.28) brightness(1.06) temperature(0.1)"),
      pick("food-caramel", "Caramel", "sepia(14%) saturate(1.2) brightness(1.08)"),
      pick("food-scone", "Scone", "brightness(1.1) sepia(12%) saturate(1.08)"),
      pick("food-jelly", "Jelly", "saturate(1.3) brightness(1.12) contrast(0.98)"),
      pick("food-coffee", "咖啡", "saturate(0.88) contrast(1.1) sepia(0.16) brightness(0.98)"),
      pick("food-picnic-1", "野餐 I", "saturate(1.15) brightness(1.1) contrast(1.02)"),
      pick("food-picnic-2", "野餐 II", "saturate(1.18) brightness(1.08) temperature(0.1)"),
      pick("food-forest-picnic", "树林野餐", "saturate(1.12) contrast(1.06) hue-rotate(-4deg)"),
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
    sheetNoFilter: true,
    items: [
      pick("film-grey", "Grey", "saturate(0.45) contrast(1.06) brightness(1.02)"),
      pick("film-pro100", "pro100", "saturate(0.95) contrast(1.04) brightness(1.04)"),
      pick("film-heavygrain", "heavygrain", "contrast(1.1) saturate(0.88) clarity(0.12)"),
      pick("film-faded", "褪色胶片", "saturate(0.62) contrast(0.86) brightness(1.08) sepia(12%)"),
      pick("film-lightleak", "lightleak", "brightness(1.1) contrast(0.9) saturate(1.1) sepia(10%)"),
      pick("film-ultra400", "Ultra400", "saturate(1.12) contrast(1.06) temperature(0.1)"),
      pick("film-spring-day", "春日和", "saturate(1.18) brightness(1.1) temperature(0.12)"),
      pick("film-diary", "菲林日记", "sepia(10%) contrast(0.92) saturate(0.9) brightness(1.04)"),
      pick("film-tungsten", "Tungsten", "temperature(0.22) saturate(1.05) contrast(1.04)"),
      pick("film-moment", "瞬间", "contrast(1.12) saturate(1.08) brightness(1.02)"),
      pick("film-daylight", "日光", "brightness(1.12) saturate(1.12) contrast(1.02)"),
      pick("film-bw-roll", "黑白胶卷", "grayscale(0.92) contrast(1.12)"),
      pick("film-velvia100", "velvia100", "saturate(1.35) contrast(1.14) hue-rotate(4deg)"),
      pick("film-cyan-blue", "青蓝", "saturate(1.1) hue-rotate(14deg) contrast(1.06)"),
      pick("film-time", "胶片时光", "sepia(12%) contrast(0.9) saturate(0.85) brightness(1.04)"),
      pick("film-kuriyama", "栗山", "saturate(0.9) contrast(1.04) brightness(1.02) sepia(6%)"),
      pick("film-hirosue", "广末", "brightness(1.06) saturate(1.05) contrast(0.96)"),
      pick("film-c200", "C200", "saturate(1.05) contrast(1.02) temperature(0.08)"),
      pick("film-superia", "Superia", "saturate(1.15) contrast(1.06) brightness(1.04)"),
      pick("film-m1", "M1", "contrast(1.08) saturate(0.95) sepia(8%)"),
      pick("film-m2-cheese", "起司M2", "brightness(1.08) saturate(1.1) temperature(0.1)"),
      pick("film-m3-youth", "青春M3", "saturate(1.12) brightness(1.1) contrast(0.94)"),
      pick("film-m4-campus", "校园M4", "saturate(1.08) contrast(1.04) brightness(1.06)"),
      pick("film-m5", "M5", "contrast(1.1) saturate(1.02) sepia(6%)"),
      pick("film-m6-neon", "霓虹M6", "saturate(1.28) hue-rotate(10deg) contrast(1.1)"),
      pick("film-m7", "M7", "contrast(0.92) saturate(0.88) brightness(1.04)"),
      pick("film-m8-midsummer", "盛夏M8", "saturate(1.22) brightness(1.1) temperature(0.14)"),
      pick("film-m9", "M9", "contrast(1.06) saturate(1.05) sepia(8%)"),
      pick("film-outdoors", "Outdoors", "saturate(1.15) contrast(1.08) clarity(0.15)"),
      pick("film-dustframe", "dustframe", "contrast(0.9) sepia(14%) saturate(0.82) brightness(1.06)"),
      pick("film-peel-apart", "撕拉片", "brightness(1.06) contrast(0.94) saturate(0.9) sepia(10%)"),
      pick("film-vista200", "vista200", "saturate(1.18) brightness(1.08) contrast(1.02)"),
      pick("film-mood-love", "花样年华", "saturate(0.88) contrast(1.04) sepia(16%) brightness(0.98)"),
    ],
  },
  {
    key: "micro-carve",
    label: "微雕",
    items: [
      pick("micro-radiance", "光辉", "brightness(1.1) contrast(1.08) clarity(0.25)"),
      pick("micro-outline", "轮廓", "contrast(1.18) clarity(0.4) saturate(1.02)"),
      pick("micro-stereo", "立体", "contrast(1.14) brightness(1.02)"),
      pick("sharpen", "锐化", "contrast(1.18)"),
      pick("micro-soft-focus", "柔焦", "contrast(0.86) brightness(1.06) saturate(0.92)"),
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
    sheetNoFilter: true,
    items: [
      pick("fashion-perfume", "香水", "saturate(1.05) brightness(1.06) contrast(0.96)"),
      pick("fashion-pink-mirror", "粉镜", "saturate(1.2) brightness(1.1) contrast(0.94)"),
      pick("fashion-urban", "都市", "contrast(1.12) saturate(1.08) clarity(0.2)"),
      pick("fashion-orange-star", "橘彩星光", "saturate(1.28) temperature(0.16) brightness(1.08)"),
      pick("fashion-hyacinth", "风信子", "saturate(1.22) hue-rotate(6deg) brightness(1.06)"),
      pick("fashion-jiangnan", "江南", "saturate(0.9) contrast(0.96) brightness(1.04) sepia(6%)"),
      pick("fashion-sky", "Sky", "brightness(1.1) saturate(1.15) hue-rotate(8deg)"),
      pick("fashion-seaside", "海滨", "saturate(1.15) brightness(1.1) temperature(-0.1)"),
      pick("fashion-west", "西部", "sepia(12%) contrast(1.1) saturate(1.12) temperature(0.14)"),
      pick("fashion-ubud", "乌布", "saturate(1.18) contrast(1.04) hue-rotate(-6deg)"),
      pick("fashion-ancient-capital", "古都", "sepia(10%) contrast(1.06) saturate(0.88)"),
      pick("fashion-robin", "知更鸟", "saturate(1.12) contrast(1.04) temperature(0.08)"),
      pick("fashion-sunny-day", "晴日", "brightness(1.14) saturate(1.12) contrast(1.02)"),
      pick("fashion-glass-ball", "玻璃球", "brightness(1.12) contrast(1.08) saturate(1.05)"),
      pick("fashion-fluorescence", "萤彩", "saturate(1.35) contrast(1.1) hue-rotate(12deg)"),
      pick("fashion-journey-t1", "旅程T1", "saturate(1.1) contrast(1.06) brightness(1.04)"),
      pick("fashion-kenting-t2", "垦丁T2", "saturate(1.2) brightness(1.1) temperature(0.12)"),
      pick("fashion-nara-t3", "奈良T3", "saturate(1.08) contrast(1.02) sepia(8%)"),
      pick("fashion-t4", "T4", "contrast(1.1) saturate(1.05) brightness(1.02)"),
      pick("fashion-t5", "T5", "saturate(1.15) contrast(1.08) temperature(0.06)"),
      pick("fashion-t6", "T6", "brightness(1.08) saturate(1.12) contrast(0.96)"),
      pick("fashion-t7", "T7", "saturate(1.08) contrast(1.04) sepia(6%)"),
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

/** 首页「基础」行前 6 格预览 */
export const IMAGE_EDITOR_FILTER_BASIC_QUICK: ImageEditorFilterPick[] = IMAGE_EDITOR_BASIC_FILTER_SECTION.items.slice(0, 6);

const FILTER_GRADE_LOOKUP = new Map<string, ImageEditorFilterPick>();
for (const section of IMAGE_EDITOR_FILTER_SECTIONS) {
  for (const item of section.items) {
    FILTER_GRADE_LOOKUP.set(item.id, item);
  }
}
for (const item of IMAGE_EDITOR_BASIC_FILTER_SECTION.items) {
  FILTER_GRADE_LOOKUP.set(item.id, item);
}

export function imageEditorFilterGradeMeta(id: string): { id: string; label: string; group: "filter"; preview: string; prompt: string } | undefined {
  const item = FILTER_GRADE_LOOKUP.get(id);
  if (!item) return undefined;
  const prompt = imageEditorFilterPrompt(id) ?? "";
  return { id: item.id, label: item.label, group: "filter", preview: item.preview, prompt };
}

export function filterSectionByKey(key: string): ImageEditorFilterSection | undefined {
  if (key === "basic") return IMAGE_EDITOR_BASIC_FILTER_SECTION;
  return IMAGE_EDITOR_FILTER_SECTIONS.find((section) => section.key === key);
}

/** 目录内所有滤镜 id（不含仅走内置的 duplicate 注册）。 */
export function imageEditorFilterCatalogIds(): string[] {
  return [...FILTER_GRADE_LOOKUP.keys()];
}