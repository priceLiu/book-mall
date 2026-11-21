import type {
  FetchProjectItemsQuery,
  UnifiedAssetPickItem,
} from "./unified-asset-library-types";

export type GlobalAssetCatalogKind =
  | "pose"
  | "avatar"
  | "garment"
  | "full-body"
  | "style"
  | "scene"
  | "character"
  | "reference"
  | "prop"
  | "storyboard-image"
  | "storyboard-video"
  | "audio";

export type GlobalAssetCatalogScope = "platform" | "user" | "team" | "project";

/** 画布「保存平台资产库」上下文（团队/项目范围仅画布） */
export type GlobalAssetSaveContext = {
  projectId?: string;
  tenantId?: string | null;
  allowTeamShare?: boolean;
  allowProjectScope?: boolean;
  /** 画布 Gateway 视觉 modelKey（与图片反推默认一致） */
  visionModelKey?: string;
  /** 画布传入 · 平台管理员（Book ADMIN，与 tools_role 可能不一致） */
  isPlatformAdmin?: boolean;
};

export type GlobalAssetLibraryMode = "pick" | "browse" | "save";

export type GlobalAssetLibraryTab = "works" | "catalog";

export type GlobalAssetPickItem = {
  id: string;
  catalogKind?: GlobalAssetCatalogKind | "works";
  title: string;
  ossUrl: string;
  thumbUrl?: string | null;
  scope?: GlobalAssetCatalogScope;
  subtitle?: string | null;
  /** 姿势库等仅提示词条目 */
  description?: string | null;
  promptOnly?: boolean;
};

export type GlobalAssetSourceImage = {
  url: string;
  prompt?: string | null;
  sourceModule?: string;
  sourceAssetId?: string;
};

export type OpenGlobalAssetLibraryOptions = {
  mode?: GlobalAssetLibraryMode;
  media?: "image" | "video" | "all";
  maxSelect?: number;
  defaultTab?: GlobalAssetLibraryTab;
  /** 统一资产库选用 · 默认 Tab（platform / shared / project） */
  defaultSection?: import("./unified-asset-library-types").AssetLibrarySection;
  defaultCatalog?: GlobalAssetCatalogKind;
  sourceImage?: GlobalAssetSourceImage;
  title?: string;
  onPick?: (items: GlobalAssetPickItem[]) => void | Promise<void>;
  /** save 模式 · 入库成功后回调（用于画布节点打标等） */
  onCatalogSaved?: () => void;
  /** 嵌入平台资产库 Hub · 不单独 portal 全屏遮罩 */
  embedded?: boolean;
  /** 平台 Hub：仅 platform catalog（GALD 内嵌时用；Hub 推荐 PlatformCatalogPanel） */
  platformHub?: boolean;
  /** 素材放大预览 z-index（嵌入 Hub 时须高于 1190） */
  previewLightboxZIndex?: number;
  saveContext?: GlobalAssetSaveContext;
};

export type GlobalAssetLibraryApiClient = {
  fetchCatalog: (query: {
    kind?: GlobalAssetCatalogKind | "all";
    gender?: string | null;
    keyword?: string | null;
    limit?: number;
    platformOnly?: boolean;
    tenantId?: string | null;
    projectId?: string | null;
  }) => Promise<{ items: GlobalAssetPickItem[]; counts: Record<string, number> }>;
  fetchWorks: (query: {
    kind?: "image" | "video" | "all";
    keyword?: string | null;
    perSource?: number;
  }) => Promise<{ items: GlobalAssetPickItem[] }>;
  importToCatalog: (body: {
    catalogKind: GlobalAssetCatalogKind;
    imageUrl: string;
    scope?: GlobalAssetCatalogScope;
    name?: string;
    gender?: "female" | "male";
    savePrompt?: boolean;
    prompt?: string;
    category?: string;
    genders?: string[];
    sceneTags?: string[];
    sourceModule?: string;
    sourceAssetId?: string;
    tenantId?: string | null;
    sourceProjectId?: string | null;
    /** 画布 projectId · Gateway 视觉分析 clientPage */
    projectId?: string;
    modelKey?: string;
  }) => Promise<void>;
  fetchProjectItems?: (
    query: FetchProjectItemsQuery,
  ) => Promise<{ items: UnifiedAssetPickItem[] }>;
  isPlatformAdmin?: () => Promise<boolean>;
};

export type GlobalAssetLibraryVariant = "light" | "dark";
