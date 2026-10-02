/** 界面镜像 · 真源 book-mall/lib/ecom/ecom-brand-vi-style-presets.ts */

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
  recommended?: boolean;
};

export const BRAND_VI_STYLE_PRESETS: BrandViStylePreset[] = [
  {
    id: "popmart3d",
    title: "潮玩 3D 手办",
    description: "泡泡玛特风哑光树脂、圆润 Q 版（默认）",
    recommended: true,
  },
  {
    id: "q-chibi",
    title: "Q 版潮玩",
    description: "高识别 Q 版，适合表情包与社媒",
  },
  {
    id: "flat",
    title: "极简扁平",
    description: "扁平插画、简洁色块",
  },
  {
    id: "guochao",
    title: "国潮",
    description: "国风纹样 + 现代潮玩比例",
  },
  {
    id: "cyber",
    title: "赛博朋克",
    description: "霓虹点缀、科技穿搭",
  },
  {
    id: "custom",
    title: "自定义风格",
    description: "在输入框描述画风与主色",
  },
];

export function brandViStyleChoiceMessage(presetId: BrandViStylePresetId): string {
  const preset = BRAND_VI_STYLE_PRESETS.find((p) => p.id === presetId);
  return `风格·${preset?.title ?? presetId}`;
}

export function parseBrandViStyleChoiceMessage(message: string): BrandViStylePresetId | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("风格·")) return null;
  const label = trimmed.slice("风格·".length).trim();
  const hit = BRAND_VI_STYLE_PRESETS.find((p) => p.title === label);
  return hit?.id ?? null;
}

export function brandViStyleAppendHint(settings: {
  stylePresetId?: string;
  styleCustomText?: string;
}): string {
  const presetId = (settings.stylePresetId ?? "popmart3d") as BrandViStylePresetId;
  if (presetId === "custom") {
    return (
      settings.styleCustomText?.trim() ||
      "用户自定义视觉风格；线稿/基准一致性由服务端追加"
    );
  }
  const preset = BRAND_VI_STYLE_PRESETS.find((p) => p.id === presetId);
  return preset?.description ?? "潮玩 3D 手办风格";
}
