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
};

function hintFor(id) {
  if (id.startsWith("filter-") || id.startsWith("cool-tone") || id === "exposure-up" || id === "grayscale") return sectionHints.vivid;
  if (id.startsWith("portrait-") || id === "filter-sunshine") return sectionHints.portrait;
  if (id.startsWith("scape-")) return sectionHints.landscape;
  if (id.startsWith("lomo-")) return sectionHints.lomo;
  if (id.startsWith("cine-")) return sectionHints.cinematic;
  if (id.startsWith("cn-")) return sectionHints.chinese;
  if (id.startsWith("art-")) return sectionHints.art;
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
  return "全图色彩风格";
}

const extraBodies = {
  vivid: "全图色彩更饱满，对比略提，避免荧光溢出。",
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
  "portrait-smooth": "轻微柔肤：降对比提中间调，不改五官形状。",
  "art-sketch": "素描感：低饱和、提线条对比，仍彩色也可。",
  "lomo-vignette": "四周略暗角，中心主体更突出。",
  "lomo-hdr": "局部 HDR 层次，避免假 HDR 光晕。",
  "cine-cyber": "赛博朋克：青紫品红偏移、高饱和霓虹感。",
  "product-texture": "商品材质微对比与清晰感。",
  "cn-ink": "水墨减饱和、墨韵层次。",
  "cn-forbidden-red": "强调朱红宫墙色，其余克制。",
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