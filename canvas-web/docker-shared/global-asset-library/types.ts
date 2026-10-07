export type GlobalAssetCatalogKind = "pose" | "avatar" | "garment" | "full-body";

export type GlobalAssetCatalogScope = "platform" | "user" | "team";

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
  defaultCatalog?: GlobalAssetCatalogKind;
  sourceImage?: GlobalAssetSourceImage;
  title?: string;
  onPick?: (items: GlobalAssetPickItem[]) => void | Promise<void>;
  /** save 模式 · 入库成功后回调（用于画布节点打标等） */
  onCatalogSaved?: () => void;
};

export type GlobalAssetLibraryApiClient = {
  fetchCatalog: (query: {
    kind?: GlobalAssetCatalogKind | "all";
    gender?: string | null;
    keyword?: string | null;
    limit?: number;
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
  }) => Promise<void>;
  isPlatformAdmin?: () => Promise<boolean>;
};

export type GlobalAssetLibraryVariant = "light" | "dark";
