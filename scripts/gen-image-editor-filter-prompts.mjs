#!/usr/bin/env node
/**
 * 从滤镜 catalog 提取 id/label，生成前后端共用的提示词模块（运行后勿手改一方而不改另一方）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOG = path.join(ROOT, "e-commerce-toolkit/lib/image-editor-filter-catalog.ts");
const src = fs.readFileSync(CATALOG, "utf8");

const picks = [...src.matchAll(/pick\("([^"]+)",\s*"([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }));
const byId = new Map();
for (const p of picks) {
  if (!byId.has(p.id)) byId.set(p.id, p.label);
}

const RECIPES = path.join(ROOT, "book-mall/lib/ecom/image-editor-filter-recipes.ts");
const recipesSrc = fs.readFileSync(RECIPES, "utf8");
for (const m of recipesSrc.matchAll(/"([a-z0-9-]+)":\s*\{/g)) {
  const id = m[1];
  if (!byId.has(id)) byId.set(id, id);
}

const LOCK =
  "只调整全局色彩、明暗与色调倾向，成片风格必须与所选滤镜名称一致且肉眼可辨。物体数量、文字、商标、人脸身份、五官、姿势、背景布局与构图保持不变。禁止换脸、重绘背景、改写文字、增删物体、改裁剪。";

const PANEL = path.join(ROOT, "e-commerce-toolkit/components/image-editor/image-editor-color-panel.tsx");
const panelSrc = fs.readFileSync(PANEL, "utf8");
const gradeBlock =
  panelSrc.match(/export const IMAGE_EDITOR_COLOR_GRADES:[\s\S]*?\n\];/)?.[0] ?? "";
const manualPrompts = new Map();
for (const chunk of gradeBlock.split(/\n  \},/)) {
  const id = chunk.match(/\n\s*id:\s*"([^"]+)"/)?.[1];
  const label = chunk.match(/\n\s*label:\s*"([^"]+)"/)?.[1];
  const prompt = chunk.match(/\n\s*prompt:\s*`([\s\S]*?)`/)?.[1];
  if (id && label && !byId.has(id)) byId.set(id, label);
  if (id && label) byId.set(id, label);
  if (id && prompt?.trim()) {
    manualPrompts.set(id, prompt.replace(/\$\{COLOR_LOCK\}/g, LOCK).trim());
  }
}

const sectionHints = {
  vivid: "偏高明度、高饱和或清澈通透的商业片色",
  portrait: "人像友好，肤色自然不过度美白或塑颜",
  landscape: "风景层次与空气感",
  lomo: "LOMO 玩具相机味道，可带轻微暗角",
  cinematic: "电影调色条，故事感",
  chinese: "东方摄影审美",
  art: "艺术媒质感，仍是照片不是插画",
  oil: "油画质感：色块厚重、笔触感以全局调色模拟，仍是照片",
  texture: "材质与胶片质感",
  anime: "日系动漫配色倾向，不改画风",
  xhs: "小红书常见网感色",
  product: "电商主图可用",
  grey: "高级灰低饱和",
  filmstock: "经典胶卷乳剂色彩",
  mood: "情绪向冷暖与明度",
  nature: "日常自然生活感",
  retro: "复古怀旧",
  blues: "蓝色主导冷调",
  fashion: "时尚杂志感",
  sweet: "少女甜系粉暖",
  spring: "春天嫩绿花色",
  fresh: "清爽冷凉通透",
  food: "美食商业片：食欲色、油润高光",
  micro: "微对比与清晰塑形",
  heal: "治愈系柔和色调",
  basic: "日常清新基础色",
  boy: "男友力人像：清爽阳刚、日系男孩感，肤色自然",
  comp: "蓝色结构主导",
  rhythm: "四季韵律氛围",
  psych: "心理向情绪色",
};

function hintFor(id) {
  if (id.startsWith("filter-") || id.startsWith("cool-tone") || id === "exposure-up" || id === "grayscale") return sectionHints.vivid;
  if (id === "filter-vivid") return sectionHints.vivid;
  if (id.startsWith("portrait-") || id === "filter-sunshine") return sectionHints.portrait;
  if (id.startsWith("scape-")) return sectionHints.landscape;
  if (id.startsWith("lomo-")) return sectionHints.lomo;
  if (id.startsWith("cine-")) return sectionHints.cinematic;
  if (id.startsWith("cn-trend-")) return sectionHints.chinese;
  if (id.startsWith("cn-")) return sectionHints.chinese;
  if (id.startsWith("art-")) return sectionHints.art;
  if (id.startsWith("oil-")) return sectionHints.oil;
  if (id.startsWith("texture-")) return sectionHints.texture;
  if (id === "film") return sectionHints.texture;
  if (id.startsWith("anime-")) return sectionHints.anime;
  if (id.startsWith("xhs-")) return sectionHints.xhs;
  if (id.startsWith("product-")) return sectionHints.product;
  if (id === "cool-white") return sectionHints.product;
  if (id.startsWith("grey-")) return sectionHints.grey;
  if (id.startsWith("film-")) return sectionHints.filmstock;
  if (id.startsWith("mood-")) return sectionHints.mood;
  if (id.startsWith("nat-")) return sectionHints.nature;
  if (id.startsWith("retro-")) return sectionHints.retro;
  if (id.startsWith("blue-")) return sectionHints.blues;
  if (id.startsWith("fashion-")) return sectionHints.fashion;
  if (id.startsWith("sweet-")) return sectionHints.sweet;
  if (id.startsWith("spring-")) return sectionHints.spring;
  if (id.startsWith("fresh-")) return sectionHints.fresh;
  if (id.startsWith("food-refine-") || id.startsWith("food-")) return sectionHints.food;
  if (id.startsWith("micro-")) return sectionHints.micro;
  if (id.startsWith("heal-")) return sectionHints.heal;
  if (id.startsWith("basic-")) return sectionHints.basic;
  if (id.startsWith("boy-")) return sectionHints.boy;
  if (id === "cool-tone-1" || id === "exposure-up") return sectionHints.basic;
  if (id.startsWith("comp-blue-")) return sectionHints.comp;
  if (id.startsWith("rhythm-")) return sectionHints.rhythm;
  if (id.startsWith("psych-")) return sectionHints.psych;
  return "全图色彩风格";
}

const extraBodies = {
  vivid: "全图色彩更饱满，对比略提，避免荧光溢出。",
  "filter-vivid": "鲜艳商业色：饱和与对比提升，避免荧光溢出。",
  natural: "白平衡中性，饱和略收，对比贴近实拍人像。",
  clear: "中间调通透，暗部不糊，高光干净不发灰。",
  dehaze: "去雾提层次，灰雾洗净，不改变天气叙事。",
  sharpen: "边缘微对比与清晰感提升，无白边光晕。",
  aqua: "整体向青碧偏移，适合天空水面。",
  hyper: "高饱和全彩张力，仍保留色相分界。",
  soft: "低对比柔美，高光柔和。",
  cream: "奶油暖高光，对比柔，不泛黄。",
  film: "轻度胶片：暗部略抬、高光柔、微暖，不加灰尘划痕。",
  "cool-white": "冷白皮商业光，白区干净略冷。",
  grayscale: "转灰度，保留明度层次。",
  invert: "RGB 反相，构图不变。",
  muted: "明显降饱和，非黑白。",
  lift: "中间调与暗部补光，高光不溢。",
  darken: "整体压暗半档，保留细节。",
  "contrast-up": "提高明暗分离。",
  "contrast-down": "柔化对比。",
  warm: "白平衡略暖。",
  cool: "白平衡略冷。",
  "highlight-up": "提亮高光区。",
  "shadow-open": "抬起暗部。",
  "highlight-roll": "柔化高光。",
  "skin-protect": "整理环境光但锁定肤色色相。",
  "brand-color": "加强商品专色饱和。",
  fade: "胶片式褪色：暗部灰、饱和降、微暖高光。",
  texture: "材质微对比与清晰感。",
  "warm-food": "食物与暖色更有食欲。",
  "bg-light": "背景变浅，主体不动。",
  "bg-dark": "背景变深，主体不动。",
  "product-true": "商品色去污染。",
  "warm-white": "整体暖白平衡。",
  "cool-white-balance": "整体冷白平衡。",
  "white-bg": "整理浅背景为干净白。",
  food: "美食商业调色。",
  fabric: "服饰面料清晰。",
  "metal-glass": "金属玻璃高光。",
  gift: "礼盒包装色。",
  "film-kodak": "Kodak 负片：中间调暖醇、对比适中、肤色讨喜。",
  "film-fuji": "Fuji 负片：绿色与肤色清爽、略冷艳。",
  "film-agfa": "Agfa 经典：微褐 sepia、对比柔。",
  "film-ilford": "Ilford 黑白：细腻灰阶，高对比可选。",
  "film-gold": "Gold 200：金黄暖调、户外阳光感。",
  "film-portra": "Portra 人像：低对比、肤色柔和、颗粒感轻。",
  "film-1980s": "八十年代胶片：微褐、略低对比、怀旧不脏。",
  "film-classic": "通用胶片滤镜：轻 sepia、中度对比。",
  "film-retro-pick": "复古胶片：褐色调、暗部抬起。",
  "film-instax": "拍立得：略亮、柔对比、轻饱和。",
  "film-faded": "褪色胶片：降饱和、抬黑位、轻褐。",
  "film-lightleak": "漏光感：边缘略暖亮、勿真烧穿画面。",
  "film-bw-roll": "黑白胶卷：去色保层次、对比适中。",
  "film-velvia100": "富士 Velvia 反转片：高饱和风景色。",
  "film-mood-love": "花样年华：港片怀旧褐绿低饱和。",
  "fashion-jiangnan": "江南：低饱和烟雨、青灰暖。",
  "fashion-fluorescence": "萤彩：时尚荧光高饱和点缀。",
  "fashion-orange-star": "橘彩星光：暖橘金高光。",
  "basic-imax": "IMAX 宽幅胶片：略高对比、轻褐、影院感边框可不模拟。",
  "basic-nostalgia-time": "怀旧时光：暖褐褪色、暗部灰。",
  "basic-chrome": "克罗姆：高反差、浓饱和风景片。",
  "basic-neon-dream": "霓幻：霓虹粉紫高饱和。",
  "basic-french-low": "法式低饱和：莫兰迪柔色。",
  "basic-mint-blue": "薄荷蓝：清凉青蓝 tint。",
  "basic-california": "加州阳光：暖金 Highlight。",
  "boy-tn1": "青葱 TN1：明亮清透、略冷青。",
  "boy-bitter-tea-tn2": "苦丁茶 TN2：茶绿低饱和。",
  "boy-youth-tn3": "少年 TN3：高对比干净少年感。",
  "boy-old-street-tn5": "老街 TN5：褪色复古街景色。",
  "boy-power-tn6": "男友力 TN6：自然中性人像光。",
  "boy-tn11": "TN11：青绿 tint 偏胶片。",
  "boy-hormone-tn12": "荷尔蒙 TN12：暖亮阳刚高光。",
  "boy-fresh-blue": "清新蓝：清凉天蓝 bias。",
  "oil-light-cream": "淡奶油：奶白柔暖、低对比。",
  "oil-soda": "苏打：清凉气泡感、略冷亮。",
  "oil-silk": "丝绸：顺滑低饱和丝光。",
  "oil-gentle": "温柔：粉暖柔和人像。",
  "oil-pearlescent": "珠光：高光珠光、明亮。",
  "oil-matte-dark": "亚暗：哑光压暗情绪。",
  "oil-monet": "莫奈：印象派紫调花色。",
  "oil-painting-ii": "油画 II：浓艳笔触感、高饱和。",
  "oil-painting": "油画：经典暖厚涂色彩。",
  "film-m6-neon": "霓虹夜片：品红青偏移、都市夜景。",
  "food-refine-tasty": "食物更鲜嫩多汁，饱和提、高光油润。",
  "food-refine-warm-light": "暖餐桌光，食物泛黄橙食欲色。",
  "food-refine-cold-tone": "冷盘生鲜，青冷净、海鲜沙拉感。",
  "food-refine-cheery": "明快靓丽，甜品饮料高饱和。",
  "food-refine-soft": "软糯甜品：低对比、柔亮、粉暖。",
  "food-chef": "私房料理：食材饱和、对比清楚、轻度暖调。",
  "food-midnight-diner": "深夜食堂：略暗环境、暖黄灯、食物突出。",
  "food-bbq": "烧烤焦香：高饱和红黄、对比强、烟火气。",
  "food-coffee": "咖啡色调：褐系、略压亮、质感稳重。",
  "food-orange-soda": "橘子汽水：高饱和橙、清甜透亮。",
  "food-forest-picnic": "林间野餐：自然绿感、明亮清新。",
  "micro-radiance": "局部光辉感，高光提亮、层次增强。",
  "micro-outline": "轮廓线强调，边缘对比提升。",
  "micro-stereo": "立体感：微对比与暗部层次。",
  "micro-soft-focus": "柔焦梦幻：降对比、轻雾感。",
  "portrait-smooth": "轻微柔肤：降对比提中间调，不改五官形状。",
  "art-sketch": "素描感：低饱和、提线条对比，仍彩色也可。",
  "lomo-vignette": "四周略暗角，中心主体更突出。",
  "lomo-hdr": "局部 HDR 层次，避免假 HDR 光晕。",
  "cine-cyber": "赛博朋克：青紫品红偏移、高饱和霓虹感。",
  "product-cool-white": "冷白皮商品光：白区干净略冷，肤色不青。",
  "product-texture": "商品材质微对比与清晰感。",
  "cn-ink": "水墨减饱和、墨韵层次。",
  "cn-forbidden-red": "强调朱红宫墙色，其余克制。",
  "cn-trend-cinnabar": "朱砂红：中国红主导，肤色仍可辨。",
  "cn-trend-porcelain-blue": "青花蓝：钴蓝清爽、白区干净。",
  "cn-trend-ink-black": "水墨黑：低饱和、高对比墨色。",
  "cn-trend-sacred-gold": "圣鉴金：暖金高光、华贵不脏黄。",
  "cn-trend-misty-gray": "烟雨灰：江南灰雾、低饱和诗意。",
};

function bodyFor(id, label) {
  if (extraBodies[id]) return extraBodies[id];
  const hint = hintFor(id);
  return `呈现「${label}」滤镜：${hint}。高光不裁、暗部不死黑，专色不胡乱偏色。`;
}

function promptFor(id, label) {
  const manual = manualPrompts.get(id);
  if (manual) return manual;
  return `按用户选择的「${label}」滤镜处理。${bodyFor(id, label)}${LOCK}`;
}

const entries = [...byId.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const lines = entries.map(([id, label]) => `  ${JSON.stringify(id)}: ${JSON.stringify(promptFor(id, label))},`);

const module = `/** 图片编辑 · 滤镜 id → 调色指令（与本地像素配方一一对应，运行 scripts/gen-image-editor-filter-prompts.mjs 再生）。 */
export const IMAGE_EDITOR_FILTER_COLOR_LOCK = ${JSON.stringify(LOCK)};

export const IMAGE_EDITOR_FILTER_PROMPTS: Record<string, string> = {
${lines.join("\n")}
};

export function imageEditorFilterPrompt(id: string): string | undefined {
  const p = IMAGE_EDITOR_FILTER_PROMPTS[id];
  return p?.trim() ? p : undefined;
}

export function imageEditorFilterPromptLabel(id: string): string | undefined {
  const m = IMAGE_EDITOR_FILTER_PROMPT_LABELS[id];
  return m;
}

/** 供账单与日志展示中文名。 */
export const IMAGE_EDITOR_FILTER_PROMPT_LABELS: Record<string, string> = {
${entries.map(([id, label]) => `  ${JSON.stringify(id)}: ${JSON.stringify(label)},`).join("\n")}
};
`;

const targets = [
  path.join(ROOT, "e-commerce-toolkit/lib/image-editor-filter-prompts.ts"),
  path.join(ROOT, "book-mall/lib/ecom/image-editor-filter-prompts.ts"),
];
for (const t of targets) {
  fs.writeFileSync(t, module);
  console.log("wrote", t, entries.length, "prompts");
}