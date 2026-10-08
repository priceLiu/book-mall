"use client";

import type { GlobalAssetCatalogKind } from "@/docker-shared/global-asset-library/types";
import type { OpenAssetLibraryOptions } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { pickItemRefUrl } from "@/docker-shared/global-asset-library/unified-asset-library-types";

import { ECOM_VTON_MODEL_ASSET_MODULE } from "@/lib/vton-model-library";

/** 模特库选用 · 平台 catalog 全身/头像/姿势等 */
export const ECOM_MODEL_LIBRARY_CATALOG_KINDS: GlobalAssetCatalogKind[] = [
  "full-body",
  "avatar",
  "pose",
  "character",
];

export const ECOM_SCENE_CATALOG_KINDS: GlobalAssetCatalogKind[] = ["scene"];

export const ECOM_PROJECT_ASSET_MODULE_GROUPS: Array<{ module: string; label: string }> = [
  { module: "main-image", label: "商品主图" },
  { module: "detail-page", label: "详情长图分屏创作" },
  { module: "detail-page-suite", label: "服装详情套图（模板）" },
  { module: "model-shot", label: "模特图" },
  { module: "vi", label: "品牌 VI" },
  { module: "ip-master", label: "IP 母版" },
  { module: "poster", label: "历史海报" },
  { module: "storyboard-micro-drama", label: "分镜图" },
  { module: "hand-craft", label: "手办盲盒 SOP" },
  { module: "seed-video", label: "种草视频" },
  { module: ECOM_VTON_MODEL_ASSET_MODULE, label: "我的模特" },
];

type OpenFn = (options: OpenAssetLibraryOptions) => void;

export function openEcomModelLibraryPick(
  openAssetLibrary: OpenFn,
  opts: {
    maxSelect?: number;
    closeOnPick?: boolean;
    onPick: (entry: { id: string; name: string; ossUrl: string }) => void | Promise<void>;
  },
) {
  openAssetLibrary({
    app: "ecom",
    mode: "pick",
    title: "模特库",
    defaultSection: "platform",
    defaultCatalog: "full-body",
    allowedCatalogKinds: ECOM_MODEL_LIBRARY_CATALOG_KINDS,
    maxSelect: opts.maxSelect ?? 1,
    onPickUnified: async (items) => {
      for (const item of items) {
        const url = pickItemRefUrl(item);
        if (!url) continue;
        await opts.onPick({ id: item.id, name: item.title, ossUrl: url });
        if (opts.closeOnPick !== false) break;
      }
    },
  });
}

export function openEcomCatalogKindPick(
  openAssetLibrary: OpenFn,
  opts: {
    catalogKind: GlobalAssetCatalogKind;
    title: string;
    defaultSection?: "platform" | "shared" | "project";
    maxSelect?: number;
    onPick: (entry: {
      id: string;
      name: string;
      imageUrl?: string | null;
      subtitle?: string | null;
    }) => void | Promise<void>;
  },
) {
  openAssetLibrary({
    app: "ecom",
    mode: "pick",
    title: opts.title,
    defaultSection: opts.defaultSection ?? "platform",
    defaultCatalog: opts.catalogKind,
    allowedCatalogKinds: [opts.catalogKind],
    maxSelect: opts.maxSelect ?? 1,
    onPickUnified: async (items) => {
      const item = items[0];
      if (!item) return;
      const url = pickItemRefUrl(item);
      await opts.onPick({
        id: item.id,
        name: item.title,
        imageUrl: url || null,
        subtitle: item.description ?? item.subtitle,
      });
    },
  });
}

export function openEcomSceneCatalogPick(
  openAssetLibrary: OpenFn,
  opts: {
    onPick: (entry: {
      id: string;
      name: string;
      imageUrl?: string | null;
      subtitle?: string | null;
    }) => void | Promise<void>;
  },
) {
  openAssetLibrary({
    app: "ecom",
    mode: "pick",
    title: "选择场景",
    defaultSection: "platform",
    defaultCatalog: "scene",
    allowedCatalogKinds: ECOM_SCENE_CATALOG_KINDS,
    maxSelect: 1,
    onPickUnified: async (items) => {
      const item = items[0];
      if (!item) return;
      const url = pickItemRefUrl(item);
      await opts.onPick({
        id: item.id,
        name: item.title,
        imageUrl: url || null,
        subtitle: item.description ?? item.subtitle,
      });
    },
  });
}

export function openEcomProjectAssetsPick(
  openAssetLibrary: OpenFn,
  opts: {
    maxSelect?: number;
    allowVideo?: boolean;
    defaultModule?: string;
    ecomModule?: string;
    ecomModules?: string[];
    title?: string;
    onConfirm: (
      assets: Array<{ id: string; ossUrl: string; title: string }>,
    ) => void | Promise<void>;
  },
) {
  const modules =
    opts.ecomModules ??
    (opts.defaultModule || opts.ecomModule
      ? [opts.defaultModule ?? opts.ecomModule!]
      : ECOM_PROJECT_ASSET_MODULE_GROUPS.map((g) => g.module));

  openAssetLibrary({
    app: "ecom",
    mode: "pick",
    title: opts.title ?? "从我的资产选择",
    defaultSection: "project",
    ecomModule: opts.ecomModule ?? opts.defaultModule,
    ecomModules: modules,
    maxSelect: opts.maxSelect ?? 8,
    media: opts.allowVideo ? "all" : "image",
    onPickUnified: async (items) => {
      const picked = items
        .map((item) => {
          const url = pickItemRefUrl(item);
          if (!url) return null;
          return { id: item.id, ossUrl: url, title: item.title };
        })
        .filter(Boolean) as Array<{ id: string; ossUrl: string; title: string }>;
      if (picked.length) await opts.onConfirm(picked);
    },
  });
}
