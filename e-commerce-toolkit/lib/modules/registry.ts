export type EcomModuleKind = "image" | "video" | "brand";

export type EcomModuleDef = {
  id: string;
  title: string;
  tagline: string;
  href: string;
  kind: EcomModuleKind;
  toolKey: string;
  action: string;
  tile: "light" | "dark" | "parchment";
};

export const VIDEO_PRESETS = [
  { slug: "motion", title: "视频动作", action: "motion" },
  { slug: "outfit", title: "穿搭视频", action: "outfit" },
  { slug: "dance-swap", title: "卡点跳舞换装", action: "dance-swap" },
  { slug: "camera", title: "视频运镜", action: "camera" },
  { slug: "digital-human", title: "数字人", action: "digital-human" },
  { slug: "mirror-selfie", title: "户外对镜自拍", action: "mirror-selfie" },
  { slug: "hit-product", title: "爆款服装带货", action: "hit-product" },
  { slug: "voiceover", title: "电商口播带货", action: "voiceover" },
] as const;

export function ecomToolKey(module: string, action: string): string {
  return `ecom-toolkit__${module}__${action}`;
}

export const ECOM_MODULES: EcomModuleDef[] = [
  {
    id: "main-image",
    title: "电商主图",
    tagline: "高转化主图，一键生成多尺寸",
    href: "/ecom/main-image",
    kind: "image",
    toolKey: "ecom-toolkit__main-image",
    action: "generate",
    tile: "light",
  },
  {
    id: "detail-page",
    title: "电商详情页",
    tagline: "长图详情与文案分屏生成",
    href: "/ecom/detail-page",
    kind: "image",
    toolKey: "ecom-toolkit__detail-page",
    action: "panel",
    tile: "parchment",
  },
  {
    id: "model-shot",
    title: "服装模特图",
    tagline: "上身展示与试衣效果",
    href: "/ecom/model-shot",
    kind: "image",
    toolKey: "ecom-toolkit__model-shot",
    action: "tryon",
    tile: "dark",
  },
  ...VIDEO_PRESETS.map((p, i) => ({
    id: `video-${p.slug}`,
    title: p.title,
    tagline: "短视频带货模板",
    href: `/ecom/video/${p.slug}`,
    kind: "video" as const,
    toolKey: "ecom-toolkit__video",
    action: p.action,
    tile: (i % 2 === 0 ? "dark" : "light") as "light" | "dark",
  })),
  {
    id: "ip",
    title: "IP 设计",
    tagline: "角色与吉祥物资产",
    href: "/brand/ip",
    kind: "image",
    toolKey: "ecom-toolkit__ip",
    action: "character",
    tile: "parchment",
  },
  {
    id: "poster",
    title: "海报制作",
    tagline: "促销与活动海报",
    href: "/brand/poster",
    kind: "image",
    toolKey: "ecom-toolkit__poster",
    action: "generate",
    tile: "light",
  },
  {
    id: "vi",
    title: "品牌 VI · 表情包",
    tagline: "套件化品牌素材",
    href: "/brand/vi",
    kind: "image",
    toolKey: "ecom-toolkit__vi",
    action: "emoji-pack",
    tile: "dark",
  },
  {
    id: "promo",
    title: "宣传片制作",
    tagline: "多镜脚本与分镜包",
    href: "/brand/promo",
    kind: "video",
    toolKey: "ecom-toolkit__promo",
    action: "script",
    tile: "parchment",
  },
  {
    id: "ad",
    title: "广告短片",
    tagline: "15–60 秒广告分镜",
    href: "/brand/ad",
    kind: "video",
    toolKey: "ecom-toolkit__ad",
    action: "script",
    tile: "light",
  },
];

export function findModuleByHref(href: string): EcomModuleDef | undefined {
  return ECOM_MODULES.find((m) => m.href === href);
}
