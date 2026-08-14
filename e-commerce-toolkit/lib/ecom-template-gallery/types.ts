export type EcomTemplateCategory =
  | "womens"
  | "mens"
  | "kids"
  | "home-textile"
  | "bags"
  | "shoes"
  | "accessories";

export type EcomTemplateMediaKind = "image" | "video";

export type EcomTemplateGalleryEntry = {
  id: string;
  category: EcomTemplateCategory;
  mediaKind: EcomTemplateMediaKind;
  title: string;
  hot: boolean;
  /** 原图（预览 / 下载） */
  ossUrl: string;
  /** 列表缩略图（sharp 预生成 -thumb.webp） */
  thumbUrl: string;
};

export type EcomTemplateGalleryCatalog = {
  templates: EcomTemplateGalleryEntry[];
};

export const ECOM_TEMPLATE_CATEGORY_META: Array<{
  id: EcomTemplateCategory;
  label: string;
}> = [
  { id: "womens", label: "女装" },
  { id: "mens", label: "男装" },
  { id: "kids", label: "童装" },
  { id: "home-textile", label: "家纺" },
  { id: "bags", label: "箱包" },
  { id: "shoes", label: "鞋子" },
  { id: "accessories", label: "配饰" },
];

/** 某分类在 catalog 中是否有条目 */
export function isTemplateCategoryAvailable(
  category: EcomTemplateCategory,
  templates: EcomTemplateGalleryEntry[],
): boolean {
  return templates.some((t) => t.category === category);
}

/** 是否含某媒体类型 */
export function templateGalleryHasMediaKind(
  templates: EcomTemplateGalleryEntry[],
  category: EcomTemplateCategory,
  mediaKind: EcomTemplateMediaKind,
): boolean {
  return templates.some(
    (t) => t.category === category && t.mediaKind === mediaKind,
  );
}

export const ECOM_TEMPLATE_CATEGORY_LABEL: Record<EcomTemplateCategory, string> =
  Object.fromEntries(
    ECOM_TEMPLATE_CATEGORY_META.map((c) => [c.id, c.label]),
  ) as Record<EcomTemplateCategory, string>;
