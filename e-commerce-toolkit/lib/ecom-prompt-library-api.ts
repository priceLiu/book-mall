"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type EcomPromptLibraryItem = {
  id: string;
  kind: "image" | "video";
  module: string;
  title: string | null;
  prompt: string;
  ossUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  modelKey: string | null;
};

const MODULE_LABELS: Record<string, string> = {
  "hand-craft": "手办盲盒 SOP",
  "brand-vi": "品牌 VI",
  "main-image": "主图创作",
  "detail-page": "详情页创作",
  "storyboard-micro-drama": "电商口播故事版",
  "seed-video": "种草视频",
  "media-decompose": "拆图拆视频",
  "model-shot": "服装模特图",
  "ip-master": "IP 母版",
};

export function promptLibraryModuleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

export async function listPromptLibrary(opts?: {
  kind?: "image" | "video" | "all";
  q?: string;
}): Promise<EcomPromptLibraryItem[]> {
  const params = new URLSearchParams();
  if (opts?.kind && opts.kind !== "all") params.set("kind", opts.kind);
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await ecomBookFetch(`api/sso/tools/ecom/prompt-library${suffix}`);
  const items = (data as { items?: EcomPromptLibraryItem[] }).items;
  return Array.isArray(items) ? items : [];
}
