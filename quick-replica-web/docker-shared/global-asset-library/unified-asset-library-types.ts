import type {
  GlobalAssetCatalogKind,
  GlobalAssetPickItem,
  OpenGlobalAssetLibraryOptions,
} from "./types";

export type AssetLibraryApp = "canvas" | "ecom" | "quick-replica";

export type AssetLibrarySection = "platform" | "shared" | "project";

export type AssetPickProvenance =
  | "catalog"
  | "works"
  | "projectAsset"
  | "ecomAsset"
  | "qrTemplate";

export type AssetPickInsertMode =
  | "url"
  | "projectAssetInsert"
  | "ecomAssetRef"
  | "qrTemplateRef";

export type UnifiedAssetPickItem = {
  id: string;
  title: string;
  ossUrl: string;
  thumbUrl?: string | null;
  section: AssetLibrarySection;
  provenance: AssetPickProvenance;
  insertMode: AssetPickInsertMode;
  displayType?: string;
  scope?: string;
  catalogKind?: GlobalAssetCatalogKind | "works";
  projectAssetKind?: string;
  ecomModule?: string;
  subtitle?: string | null;
  description?: string | null;
  promptOnly?: boolean;
};

export type OpenAssetLibraryOptions = OpenGlobalAssetLibraryOptions & {
  app: AssetLibraryApp;
  defaultSection?: AssetLibrarySection;
  projectId?: string;
  ecomModule?: string;
  ecomModules?: string[];
  allowedCatalogKinds?: GlobalAssetCatalogKind[];
  allowedProjectKinds?: string[];
  /** 选用回调 · 含 insertMode / provenance */
  onPickUnified?: (items: UnifiedAssetPickItem[]) => void | Promise<void>;
};

export type FetchProjectItemsQuery = {
  projectId?: string | null;
  ecomModule?: string | null;
  ecomModules?: string[];
  keyword?: string | null;
  kind?: string | null;
  media?: "image" | "video" | "all";
  limit?: number;
};

export type UnifiedAssetLibraryApiClient = {
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
  fetchProjectItems?: (
    query: FetchProjectItemsQuery,
  ) => Promise<{ items: UnifiedAssetPickItem[] }>;
  importToCatalog: import("./types").GlobalAssetLibraryApiClient["importToCatalog"];
  isPlatformAdmin?: () => Promise<boolean>;
};

export function unifiedToGlobalPickItem(item: UnifiedAssetPickItem): GlobalAssetPickItem {
  return {
    id: item.id,
    catalogKind: item.catalogKind,
    title: item.title,
    ossUrl: item.ossUrl,
    thumbUrl: item.thumbUrl,
    scope: item.scope as import("./types").GlobalAssetCatalogScope | undefined,
    subtitle: item.subtitle,
    description: item.description,
    promptOnly: item.promptOnly,
  };
}

export function catalogItemToUnified(
  item: GlobalAssetPickItem,
  section: AssetLibrarySection,
): UnifiedAssetPickItem {
  const provenance = item.catalogKind === "works" ? "works" : "catalog";
  return {
    id: item.id,
    title: item.title,
    ossUrl: item.ossUrl,
    thumbUrl: item.thumbUrl,
    section,
    provenance,
    insertMode: "url",
    scope: item.scope,
    catalogKind: item.catalogKind,
    subtitle: item.subtitle,
    description: item.description,
    promptOnly: item.promptOnly,
  };
}

export function pickItemRefUrl(item: UnifiedAssetPickItem): string {
  return item.ossUrl?.trim() || item.thumbUrl?.trim() || "";
}
