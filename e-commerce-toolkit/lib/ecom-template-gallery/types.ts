/**
 * 分类唯一登记表 —— 新增分类只需在此加一行。
 *
 * 类型联合、Tab 顺序、标签、HTML 文件名推断、sessionStorage 校验全部由此派生，
 * 曾经这些各存一份清单，改一处漏三处会让新分类「后端能写、前端不显示」。
 *
 * `keywords`：导入 HTML 时按文件名猜分类（如「化妆品 图片.html」）。
 *   按数组顺序首个 `includes` 命中者生效，故新增时要确认不会被前面的词吃掉。
 * `primary`：`false` 的收进分类行右侧的「更多」里，避免一行挤十几个胶囊。
 * `id` 会进 OSS 路径 `ecom/template-gallery/<id>/`，故只用小写与连字符。
 */
export const ECOM_TEMPLATE_CATEGORY_META = [
  { id: "womens", label: "女装", keywords: ["女装"], primary: true },
  { id: "mens", label: "男装", keywords: ["男装"], primary: true },
  { id: "kids", label: "童装", keywords: ["童装"], primary: true },
  { id: "home-textile", label: "家纺", keywords: ["家纺"], primary: true },
  { id: "bags", label: "箱包", keywords: ["箱包"], primary: true },
  { id: "shoes", label: "鞋子", keywords: ["鞋子"], primary: true },
  { id: "accessories", label: "配饰", keywords: ["配饰"], primary: true },
  { id: "cosmetics", label: "化妆品", keywords: ["化妆", "美妆"], primary: true },
  { id: "underwear", label: "内衣", keywords: ["内衣"], primary: false },
  { id: "jewelry", label: "珠宝首饰", keywords: ["珠宝", "首饰"], primary: false },
  { id: "swimwear", label: "泳装", keywords: ["泳装"], primary: false },
  { id: "packaging", label: "包装", keywords: ["包装"], primary: false },
  { id: "pets", label: "宠物", keywords: ["宠物"], primary: false },
  { id: "family-outfit", label: "亲子装", keywords: ["亲子装"], primary: false },
  { id: "baby", label: "婴幼童", keywords: ["婴幼童", "婴幼"], primary: false },
  { id: "loungewear", label: "家居服", keywords: ["家居服"], primary: false },
  { id: "hats", label: "帽子", keywords: ["帽子"], primary: false },
  { id: "socks", label: "袜子", keywords: ["袜子"], primary: false },
  { id: "scarves", label: "丝巾", keywords: ["丝巾"], primary: false },
  { id: "eyewear", label: "眼镜", keywords: ["眼镜"], primary: false },
  {
    id: "mattress-pillow",
    label: "床垫枕芯",
    keywords: ["床垫", "枕芯"],
    primary: false,
  },
] as const;

export type EcomTemplateCategoryMeta =
  (typeof ECOM_TEMPLATE_CATEGORY_META)[number];

/** 常驻分类行 */
export const ECOM_TEMPLATE_PRIMARY_CATEGORIES: readonly EcomTemplateCategoryMeta[] =
  ECOM_TEMPLATE_CATEGORY_META.filter((c) => c.primary);

/** 收在「更多」里的分类 */
export const ECOM_TEMPLATE_MORE_CATEGORIES: readonly EcomTemplateCategoryMeta[] =
  ECOM_TEMPLATE_CATEGORY_META.filter((c) => !c.primary);

export type EcomTemplateCategory =
  (typeof ECOM_TEMPLATE_CATEGORY_META)[number]["id"];

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
  coverUrl?: string | null;
  mainImageUrl?: string | null;
  referenceImages?: Array<{ url: string; label?: string }>;
  promptText?: string | null;
  defaultModelKey?: string | null;
  posterUrl?: string | null;
};

export type EcomTemplateGalleryCatalog = {
  templates: EcomTemplateGalleryEntry[];
};

/** 去重判定只需 id 与分类，故清单接口只回 id，可高频拉取 */
export type EcomTemplateEntryRef = {
  id: string;
  category: string;
};

/** 分类概览：仅计数，驱动分类 / 媒体开关，无需为此拉全量清单 */
export type EcomTemplateCategorySummaryRow = {
  category: EcomTemplateCategory;
  image: number;
  video: number;
  total: number;
};

export function summaryRowFor(
  summary: EcomTemplateCategorySummaryRow[] | null,
  category: EcomTemplateCategory,
): EcomTemplateCategorySummaryRow | undefined {
  return summary?.find((s) => s.category === category);
}

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

export function templateCategoryLabel(category: EcomTemplateCategory): string {
  return ECOM_TEMPLATE_CATEGORY_LABEL[category];
}

const CATEGORY_IDS = new Set<string>(
  ECOM_TEMPLATE_CATEGORY_META.map((c) => c.id),
);

/** 校验外部输入（sessionStorage、URL、接口回包）是否为已登记分类 */
export function isEcomTemplateCategory(v: unknown): v is EcomTemplateCategory {
  return typeof v === "string" && CATEGORY_IDS.has(v);
}

/** 从 HTML 文件名推断品类（如「化妆品 图片.html」→ cosmetics） */
export function inferTemplateCategoryFromFilename(
  filename: string,
): EcomTemplateCategory | null {
  const base = filename.trim();
  if (!base) return null;
  for (const { id, keywords } of ECOM_TEMPLATE_CATEGORY_META) {
    if (keywords.some((k) => base.includes(k))) return id;
  }
  return null;
}
