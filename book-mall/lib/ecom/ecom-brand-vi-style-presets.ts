import type { BrandViSettings } from "@/lib/ecom/ecom-brand-vi-types";

export const BRAND_VI_STYLE_PRESET_IDS = [
  "popmart3d",
  "q-chibi",
  "flat",
  "guochao",
  "cyber",
  "custom",
] as const;

export type BrandViStylePresetId = (typeof BRAND_VI_STYLE_PRESET_IDS)[number];

export type BrandViStylePreset = {
  id: BrandViStylePresetId;
  title: string;
  description: string;
  promptFragment: string;
  recommended?: boolean;
};

export const BRAND_VI_STYLE_PRESETS: BrandViStylePreset[] = [
  {
    id: "popmart3d",
    title: "潮玩 3D 手办",
    description: "泡泡玛特风哑光树脂、圆润 Q 版、干净主色（默认）",
    promptFragment:
      "泡泡玛特潮玩3D手办，哑光细腻树脂材质，圆润软萌比例，低饱和干净色调，柔和漫反射光影，无杂色纯白背景，潮玩精致细节，统一IP五官特征不崩脸",
  },
  {
    id: "q-chibi",
    title: "Q 版潮玩",
    description: "扁平偏 Q、高识别度，适合表情包与社媒（默认）",
    recommended: true,
    promptFragment:
      "Q版潮玩IP风格，圆润可爱，高识别度，干净矢量感边缘，柔和光影，纯白背景，适合表情包与周边延展",
  },
  {
    id: "flat",
    title: "极简扁平",
    description: "扁平插画、简洁色块，适合 Logo 与规范页",
    promptFragment:
      "极简扁平插画风，清晰轮廓线，有限色板，无复杂纹理，纯白背景，商业品牌感",
  },
  {
    id: "guochao",
    title: "国潮",
    description: "国风纹样 + 现代潮玩比例",
    promptFragment:
      "国潮IP风格，传统纹样点缀与现代潮玩造型结合，饱和但克制的配色，纯白背景，文化识别度",
  },
  {
    id: "cyber",
    title: "赛博朋克",
    description: "霓虹点缀、科技穿搭与冷色主调",
    promptFragment:
      "赛博朋克潮玩风，霓虹蓝紫点缀，科技配饰，冷色主调，纯白或浅灰背景，未来感",
  },
  {
    id: "custom",
    title: "自定义风格",
    description: "在下方输入框描述你想要的画风与主色",
    promptFragment: "",
  },
];

export const BRAND_VI_HERO_LOCK =
  "严格沿用已确认基准 IP 形象，100%保留发型、配饰、服装与体态细节，不得随意改动原生结构，统一IP五官特征不崩脸";

/** @deprecated 使用 BRAND_VI_HERO_LOCK */
export const BRAND_VI_LINEART_LOCK = BRAND_VI_HERO_LOCK;

export function defaultBrandViStylePresetId(): BrandViStylePresetId {
  return "q-chibi";
}

export function getBrandViStylePreset(id: string | undefined): BrandViStylePreset {
  const hit = BRAND_VI_STYLE_PRESETS.find((p) => p.id === id);
  return hit ?? BRAND_VI_STYLE_PRESETS[0]!;
}

export function resolveBrandViStyleFragment(settings: BrandViSettings | undefined): string {
  const presetId = settings?.stylePresetId ?? defaultBrandViStylePresetId();
  const preset = getBrandViStylePreset(presetId);
  if (presetId === "custom") {
    const custom = settings?.styleCustomText?.trim();
    return custom || "用户自定义视觉风格，保持角色一致性与干净背景";
  }
  return preset.promptFragment;
}

export function brandViStyleChoiceMessage(presetId: BrandViStylePresetId): string {
  const preset = getBrandViStylePreset(presetId);
  return `风格·${preset.title}`;
}

export function parseBrandViStyleChoiceMessage(
  message: string,
): BrandViStylePresetId | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("风格·")) return null;
  const label = trimmed.slice("风格·".length).trim();
  const hit = BRAND_VI_STYLE_PRESETS.find((p) => p.title === label);
  return hit?.id ?? null;
}

/** UI 只读摘要（Prompt 弹窗） */
export function brandViStyleAppendHint(settings: BrandViSettings | undefined): string {
  const line = resolveBrandViStyleFragment(settings);
  const short = line.length > 120 ? `${line.slice(0, 117)}…` : line;
  return `${BRAND_VI_LINEART_LOCK}；${short}`;
}
