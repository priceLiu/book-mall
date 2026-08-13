export type EcomImageRatio = "1:1" | "3:4" | "4:5" | "16:9";

export type EcomPlatformSpec = {
  code: string;
  label: string;
  mainImage: {
    recommended: number;
    min: number;
    max: number;
    ratio: EcomImageRatio;
    ratioOptions: EcomImageRatio[];
  };
  detailPage: {
    recommended: number;
    min: number;
    max: number;
    ratio: EcomImageRatio;
  };
  note: string;
};

export type ProductDesignChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ProductDesignReferenceRole =
  | "product"
  | "main-style"
  | "detail-style"
  | "scene"
  | "model"
  | "other";

export type ProductDesignReference = {
  id: string;
  label: string;
  role: ProductDesignReferenceRole;
  ossUrl: string;
};

export type ProductDesignVisualBriefEntry = {
  summary: string;
  derivedPrompt: string;
  productTraits?: string;
  styleTraits?: string;
  modelKey: string;
  analyzedAt: string;
  refFingerprint?: string;
};

export type ProductDesignMainImage = {
  index: number;
  purpose: string;
  layers: {
    topHint?: string;
    title: string;
    subtitle?: string;
    bullets: string[];
    delivery?: string;
    footer?: string;
  };
  emphasis: { bold: string[]; color: string[] };
  ratio?: EcomImageRatio;
  imageUrl?: string;
  assetId?: string;
  genPrompt?: string;
  /** 用户手改过 genPrompt：重新拆解时不覆盖 */
  promptEdited?: boolean;
};

export type ProductDesignDetailPage = {
  index: number;
  purpose: string;
  title: string;
  body: string[];
  keyInfo?: string;
  closingLine?: string;
  layoutHint?: string;
  ratio?: EcomImageRatio;
  imageUrl?: string;
  assetId?: string;
  genPrompt?: string;
  /** 用户手改过 genPrompt：重新拆解时不覆盖 */
  promptEdited?: boolean;
};

export type ProductDesign = {
  analysis?: {
    platformNotes: string;
    surfacePainPoints: string[];
    deepNeeds: string[];
    differentiators: string[];
    visualTone: string;
    forbiddenWords: string[];
  };
  marketingPlans: Array<{
    no: number;
    name: string;
    angle: string;
    painPoint: string;
    outcome: string;
    mood: string;
    rows?: Array<{ label: string; content: string }>;
  }>;
  selectedPlanNo?: number;
  buyingReasonBrief?: {
    intro: string;
    matrix?: Array<{
      sellingPoint: string;
      physicalDesc: string;
      reason: string;
      emotionalValue: string;
    }>;
    table?: {
      headers: string[];
      rows: string[][];
    };
    displayMarkdown?: string;
    /** 用户已在中间区编辑保存，不再被会话自动覆盖 */
    userEdited?: boolean;
  };
  buyingReasons: string[];
  mainImages: ProductDesignMainImage[];
  detailOutline: Array<{
    index: number;
    mission: string;
    doubtResolved: string;
    titleDirection: string;
    tag: "emotion" | "proof" | "risk" | "other";
  }>;
  detailPages: ProductDesignDetailPage[];
  visualBrief?: {
    main?: ProductDesignVisualBriefEntry;
    detail?: ProductDesignVisualBriefEntry;
  };
  imageGenPlans?: {
    main?: ImageGenPlan;
    detail?: ImageGenPlan;
  };
};

/** PATCH designPatch：null 表示清除 selectedPlanNo */
export type ProductDesignDesignPatch = Omit<Partial<ProductDesign>, "selectedPlanNo"> & {
  selectedPlanNo?: number | null;
};

export type ProductContext = {
  productName?: string;
  productCategory?: string;
  sellingPoints?: string[];
  description?: string;
  visualTone?: string;
  targetUserGroup?: string;
};

export type ImageGenPlanItem = {
  index: number;
  title: string;
  purpose?: string;
  prompt: string;
  copySnapshot?: Record<string, unknown>;
};

export type ImageGenPlan = {
  target: "main" | "detail";
  source: "interactive" | "reference-decompose" | "reference-intent";
  status: "draft" | "confirmed";
  productContext?: ProductContext;
  sharedVisualBrief?: string;
  items: ImageGenPlanItem[];
};

export type ProductDesignSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  visionModelKey?: string;
  mainImageCount?: number;
  detailPageCount?: number;
  mainImageRatio?: EcomImageRatio;
  detailPageRatio?: EcomImageRatio;
  /** copy=分层文案驱动（默认）；reference-prompt/reference=参考图快速路径 */
  mainImageGenMode?: "copy" | "reference-decompose" | "reference-prompt" | "reference";
  /** 用户自定义 Prompt（可 @ 多张风格图 + 商品实拍） */
  mainImageCustomPrompt?: string;
  /** copy=Step7-8 助手；reference-decompose=LLM 拆解；reference-prompt=自定义 Prompt + 参考图 */
  detailPageGenMode?: "copy" | "reference-decompose" | "reference-prompt";
  detailPageCustomPrompt?: string;
  /** 批量出图并发（1–5） */
  imageGenConcurrency?: number;
};

export type ProductDesignBrief = {
  productName?: string;
  productCategory?: string;
  targetUserGroup?: string;
  mainPainPoint?: string | string[];
  productCoreAdvantage?: string | string[];
  deliveryType?: string;
  /** 信任背书，支持多选 */
  hasTrustBadge?: string | string[];
  freeNote?: string;
};

export type ProductDesignProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  platform: string;
  brief: ProductDesignBrief | null;
  settings: ProductDesignSettings;
  references: ProductDesignReference[];
  chatHistory: ProductDesignChatMessage[];
  design: ProductDesign | null;
  resolved: {
    mainImageCount: number;
    detailPageCount: number;
    mainImageRatio: EcomImageRatio;
    detailPageRatio: EcomImageRatio;
  };
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/** 项目所属产线，一个项目建成后不可切换 */
export type EcomProjectModule = "main-image" | "detail-page";

/** 带 ? 的字段仅 listProductDesignProjects(module, { detailed: true }) 返回 */
export type ProductDesignProjectSummary = {
  id: string;
  title: string | null;
  platform: string;
  updatedAt: string;
  /** 首张产品参考图，供「选择已有主图项目」选择器展示 */
  thumbnailUrl?: string | null;
  productName?: string | null;
  /** 已产出的主图张数 */
  mainImageCount?: number;
  /** Step0–3 是否齐备，齐备才能整套导入策略 */
  strategyReady?: boolean;
};

/** 建详情页项目时从主图项目搬运哪些内容 */
export type ProductDesignStrategyImport = {
  projectId: string;
  /** 搬运 role=product 的产品图 */
  productRefs: boolean;
  /** 把主图定稿成品作为详情页风格参考（role=detail-style） */
  mainImagesAsStyleRefs: boolean;
};
