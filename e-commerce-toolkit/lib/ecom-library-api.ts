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

export type EcomLibrarySection = {
  moduleId: string;
  title: string;
  kind: "image" | "video" | "brand";
  assets: EcomAsset[];
  storyboardBundles: EcomLibraryStoryboardBundle[];
};

export async function listLibrarySections(): Promise<{
  sections: EcomLibrarySection[];
  totalAssets: number;
  totalBundles: number;
}> {
  const data = await ecomBookFetch("api/sso/tools/ecom/library");
  return {
    sections: (data.sections as EcomLibrarySection[]) ?? [],
    totalAssets: typeof data.totalAssets === "number" ? data.totalAssets : 0,
    totalBundles: typeof data.totalBundles === "number" ? data.totalBundles : 0,
  };
}
