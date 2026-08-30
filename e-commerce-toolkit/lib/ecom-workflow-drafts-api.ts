"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type EcomWorkflowDraftKind =
  | "storyboard"
  | "product-design-main"
  | "product-design-detail"
  | "hand-craft"
  | "seed-video"
  | "media-decompose";

export type EcomWorkflowDraftItem = {
  kind: EcomWorkflowDraftKind;
  projectId: string;
  title: string;
  featureLabel: string;
  domainLabel: "电商" | "视频";
  phaseLabel: string;
  summary: string;
  thumbnailUrl: string | null;
  updatedAt: string;
};

export async function listWorkflowDrafts(): Promise<EcomWorkflowDraftItem[]> {
  const data = await ecomBookFetch("api/sso/tools/ecom/workflows/drafts");
  return (data.drafts as EcomWorkflowDraftItem[]) ?? [];
}
