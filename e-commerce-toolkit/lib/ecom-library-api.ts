"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";
import type { EcomAsset } from "@/lib/ecom-api";

export type EcomLibraryStoryboardBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  panelCount: number;
  hasScript: boolean;
  hasVideo: boolean;
  thumbnailUrl: string | null;
  snapshot: StoryboardDeliverableSnapshot;
};

export type EcomLibraryProductDesignBundle = {
  projectId: string;
  savedAt: string;
  title: string;
  module: string;
  platform: string;
  slotCount: number;
  hasGeneratedImages: boolean;
  hasCopy: boolean;
  thumbnailUrl: string | null;
  snapshot: {
    savedAt: string;
    title: string;
    module: string;
    platform: string;
  };
};

export type EcomLibraryAssetGroup = {
  projectId: string | null;
  projectName: string;
  assets: EcomAsset[];
};

export type EcomLibrarySection = {
  moduleId: string;
  title: string;
  kind: "image" | "video" | "brand";
  domainLabel: string;
  assets: EcomAsset[];
  assetGroups: EcomLibraryAssetGroup[];
  storyboardBundles: EcomLibraryStoryboardBundle[];
  productDesignBundles: EcomLibraryProductDesignBundle[];
};

export async function listLibrarySections(): Promise<{
  sections: EcomLibrarySection[];
  totalAssets: number;
  totalBundles: number;
}> {
  const data = await ecomBookFetch("api/sso/tools/ecom/library");
  return {
    sections: ((data.sections as EcomLibrarySection[]) ?? []).map((s) => ({
      ...s,
      domainLabel: s.domainLabel ?? (s.kind === "video" ? "视频" : s.kind === "brand" ? "品牌" : "电商"),
      assetGroups: s.assetGroups ?? [],
      productDesignBundles: s.productDesignBundles ?? [],
      storyboardBundles: s.storyboardBundles ?? [],
    })),
    totalAssets: typeof data.totalAssets === "number" ? data.totalAssets : 0,
    totalBundles: typeof data.totalBundles === "number" ? data.totalBundles : 0,
  };
}
