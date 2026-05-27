/**
 * 影视专业版 · 风格锚定模板（对齐 YubAI 风格定义模板）
 */
import type {
  StoryProColorTone,
  StoryProMainStyle,
  StoryProRenderQuality,
} from "./story-pro-workspace-types";

export type StoryProStyleAnchorTemplate = {
  id: string;
  label: string;
  hint: string;
  mainStyle: StoryProMainStyle;
  colorTone: StoryProColorTone;
  renderQuality: StoryProRenderQuality;
  styleAnchorZh: string;
  styleAnchorEn: string;
  negativePrompt: string;
};

export const STORY_PRO_STYLE_ANCHOR_TEMPLATES: StoryProStyleAnchorTemplate[] = [
  {
    id: "anime-campus",
    label: "日系 · 青春校园",
    hint: "明亮温暖 · 平涂",
    mainStyle: "anime",
    colorTone: "bright-warm",
    renderQuality: "flat",
    styleAnchorZh:
      "日漫风格，青春校园题材，明亮温暖的色调，细腻的人物刻画，柔和的光影，清新自然的氛围，高质量动画风格，干净线稿与柔和阴影。",
    styleAnchorEn:
      "anime style, high school slice of life, bright and warm color palette, detailed character design, soft lighting, fresh natural atmosphere, high quality Japanese animation, clean line art, gentle cel shading",
    negativePrompt:
      "dark, horror, realistic photo, 3D render, western cartoon, rough sketch, low quality, blurry, deformed, ugly face",
  },
  {
    id: "american-comic-hero",
    label: "美漫 · 超级英雄",
    hint: "鲜艳 · 厚涂",
    mainStyle: "american-comic",
    colorTone: "vivid",
    renderQuality: "thick-paint",
    styleAnchorZh:
      "美漫风格，粗线条轮廓，高饱和英雄配色，动态构图，强对比光影，漫画网点与速度线，力量感与戏剧张力。",
    styleAnchorEn:
      "American comic book style, bold ink outlines, vivid saturated colors, dynamic heroic composition, strong contrast lighting, halftone texture, dramatic action pose, Marvel DC inspired",
    negativePrompt:
      "anime, chibi, soft pastel, watercolor, photorealistic, low quality, blurry, flat lighting, muddy colors",
  },
  {
    id: "webtoon-urban",
    label: "韩漫 · 都市情感",
    hint: "柔和 · 厚涂",
    mainStyle: "webtoon",
    colorTone: "soft",
    renderQuality: "thick-paint",
    styleAnchorZh:
      "韩漫条漫风格，精致细腻五官，柔和渐变肤色，都市现代场景，淡雅配色，电影感构图，情感向叙事氛围。",
    styleAnchorEn:
      "Korean webtoon manhwa style, refined delicate features, soft gradient skin tones, modern urban setting, muted elegant palette, cinematic framing, emotional storytelling atmosphere",
    negativePrompt:
      "chibi, rough sketch, western comic, photorealistic, oversaturated, low quality, blurry, bad anatomy",
  },
  {
    id: "chibi-comedy",
    label: "Q 版 · 搞笑日常",
    hint: "明亮 · 平涂",
    mainStyle: "chibi",
    colorTone: "vivid",
    renderQuality: "flat",
    styleAnchorZh:
      "Q 版沙雕漫风格，二头身比例，夸张表情，简笔造型，明亮活泼配色，轻松搞笑氛围，粗线条卡通渲染。",
    styleAnchorEn:
      "chibi style, super deformed 2-head-tall characters, exaggerated funny expressions, simple cartoon shapes, bright playful colors, comedic slice-of-life mood, bold flat coloring",
    negativePrompt:
      "realistic, photorealistic, detailed anatomy, dark horror, serious drama, low quality, blurry",
  },
  {
    id: "cg-fantasy",
    label: "CG · 史诗奇幻",
    hint: "高对比 · 厚涂",
    mainStyle: "cg",
    colorTone: "high-contrast",
    renderQuality: "thick-paint",
    styleAnchorZh:
      "CG 电影级渲染，史诗奇幻世界观，高精度材质与体积光，宏大场景纵深，冷暖对比光影，电影级调色。",
    styleAnchorEn:
      "cinematic CGI, epic fantasy world, high detail materials, volumetric god rays, grand environmental depth, dramatic color grading, Pixar Blizzard cinematic quality",
    negativePrompt:
      "flat anime, chibi, sketch, low poly, low quality, blurry, oversaturated noise, amateur 3D",
  },
  {
    id: "photoreal-urban",
    label: "写实 · 现代都市",
    hint: "自然光 · 胶片",
    mainStyle: "photorealistic",
    colorTone: "soft",
    renderQuality: "oil",
    styleAnchorZh:
      "写实人像与场景，现代都市题材，自然光与浅景深，皮肤与织物细节丰富，纪录片式真实感，克制中性色调。",
    styleAnchorEn:
      "photorealistic, modern urban drama, natural daylight, shallow depth of field, rich skin and fabric detail, documentary realism, neutral restrained color grade",
    negativePrompt:
      "anime, cartoon, illustration, 3D game render, oversaturated, plastic skin, low quality, blurry, deformed",
  },
  {
    id: "game-cg-adventure",
    label: "游戏 CG · 冒险",
    hint: "鲜艳 · 厚涂",
    mainStyle: "game-cg",
    colorTone: "vivid",
    renderQuality: "thick-paint",
    styleAnchorZh:
      "游戏 CG 渲染风格，Unreal 引擎质感，冒险探索题材，精致角色装备，环境光遮蔽与高光，动态冒险氛围。",
    styleAnchorEn:
      "game CG render, Unreal Engine aesthetic, adventure exploration theme, detailed character gear, ambient occlusion, specular highlights, dynamic heroic adventure mood",
    negativePrompt:
      "flat 2D anime, chibi, photorealistic photo, low poly, low quality, blurry, muddy textures",
  },
  {
    id: "chinese-3d-xianxia",
    label: "国风 3D · 仙侠",
    hint: "柔和 · 水彩",
    mainStyle: "chinese-3d",
    colorTone: "soft",
    renderQuality: "watercolor",
    styleAnchorZh:
      "国风三维与水墨融合，仙侠古风题材，飘逸服饰与云雾山水，留白意境，青绿与赭石配色，东方美学光影。",
    styleAnchorEn:
      "Chinese style 3D with ink wash influence, xianxia fantasy, flowing hanfu robes, misty mountains, elegant negative space, celadon and ochre palette, eastern aesthetic lighting",
    negativePrompt:
      "western medieval, cyberpunk, anime chibi, photorealistic modern city, low quality, blurry, cluttered composition",
  },
];

export const STORY_PRO_COLOR_TONE_OPTIONS: {
  value: StoryProColorTone;
  label: string;
}[] = [
  { value: "bright-warm", label: "明亮温暖" },
  { value: "dark-moody", label: "暗沉压抑" },
  { value: "vivid", label: "鲜艳活泼" },
  { value: "soft", label: "柔和淡雅" },
  { value: "high-contrast", label: "高对比度" },
];

export const STORY_PRO_RENDER_QUALITY_OPTIONS: {
  value: StoryProRenderQuality;
  label: string;
}[] = [
  { value: "flat", label: "平涂" },
  { value: "thick-paint", label: "厚涂" },
  { value: "watercolor", label: "水彩" },
  { value: "oil", label: "油画" },
];

/** 下拉已选但锚定词为空时，定稿前自动补全（不阻断定稿） */
export function buildStyleAnchorFallbackFromPickers(d: {
  mainStyle?: StoryProMainStyle;
  colorTone?: StoryProColorTone;
  renderQuality?: StoryProRenderQuality;
  styleAnchorZh?: string;
  styleAnchorEn?: string;
  negativePrompt?: string;
}): {
  styleAnchorZh?: string;
  styleAnchorEn?: string;
  negativePrompt?: string;
} {
  const matched = STORY_PRO_STYLE_ANCHOR_TEMPLATES.find(
    (t) =>
      t.mainStyle === d.mainStyle &&
      t.colorTone === d.colorTone &&
      t.renderQuality === d.renderQuality,
  );
  if (matched) {
    return {
      styleAnchorZh: d.styleAnchorZh?.trim() || matched.styleAnchorZh,
      styleAnchorEn: d.styleAnchorEn?.trim() || matched.styleAnchorEn,
      negativePrompt: d.negativePrompt?.trim() || matched.negativePrompt,
    };
  }
  const main = STORY_PRO_MAIN_STYLE_OPTIONS.find((o) => o.value === d.mainStyle);
  const tone = STORY_PRO_COLOR_TONE_OPTIONS.find((o) => o.value === d.colorTone);
  const qual = STORY_PRO_RENDER_QUALITY_OPTIONS.find(
    (o) => o.value === d.renderQuality,
  );
  const zhParts = [main?.label, tone?.label, qual?.label].filter(Boolean);
  const enParts = [
    d.mainStyle ? `${d.mainStyle} style` : "",
    d.colorTone ?? "",
    d.renderQuality ?? "",
  ].filter(Boolean);
  return {
    styleAnchorZh:
      d.styleAnchorZh?.trim() ||
      (zhParts.length ? zhParts.join("，") : undefined),
    styleAnchorEn:
      d.styleAnchorEn?.trim() ||
      (enParts.length ? enParts.join(", ") : undefined),
    negativePrompt: d.negativePrompt?.trim() || undefined,
  };
}

export const STORY_PRO_MAIN_STYLE_OPTIONS: {
  value: StoryProMainStyle;
  label: string;
}[] = [
  { value: "anime", label: "日系动漫" },
  { value: "american-comic", label: "美漫" },
  { value: "webtoon", label: "韩漫条漫" },
  { value: "chibi", label: "Q 版" },
  { value: "cg", label: "CG 插画" },
  { value: "photorealistic", label: "写实" },
  { value: "game-cg", label: "游戏 CG" },
  { value: "chinese-3d", label: "国风 3D" },
  { value: "other", label: "其他" },
];
