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
  }>;
  selectedPlanNo?: number;
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
};

export type ProductDesignSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  visionModelKey?: string;
  mainImageCount?: number;
  detailPageCount?: number;
  mainImageRatio?: EcomImageRatio;
  detailPageRatio?: EcomImageRatio;
  /** copy=分层文案驱动（默认）；reference-prompt=用户自定义 Prompt + 参考图 */
  mainImageGenMode?: "copy" | "reference-prompt";
  /** 用户自定义 Prompt（可 @ 多张风格图 + 商品实拍） */
  mainImageCustomPrompt?: string;
  /** copy=Step7-8 助手；reference-decompose=上传详情参考后 LLM 拆解 */
  detailPageGenMode?: "copy" | "reference-decompose";
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

export type ProductDesignProjectSummary = {
  id: string;
  title: string | null;
  platform: string;
  updatedAt: string;
};
