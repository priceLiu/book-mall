import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type StorySpaceData = {
  id: string;
  slug: string;
  templateKey: string;
  title: string;
  tagline: string;
  subtitle: string;
  ownerDisplayName: string | null;
  featuredWork: {
    title: string;
    description: string | null;
    videoSrc: string;
    poster: string | null;
  };
  publishStatus: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  publishedProductSlug: string | null;
  isOwner: boolean;
  modelSelections: StoryModelSelection[];
};

export type StoryModelSelection = {
  engineModelId: string;
  modelKey: string;
  displayName: string;
  vendor: string;
  role: string;
  enabled: boolean;
  isPrimary: boolean;
  params: unknown;
};

export type StoryEngineModel = {
  id: string;
  modelKey: string;
  displayName: string;
  vendor: string;
  role: string;
  description: string | null;
  sortOrder: number;
  defaultParams: unknown;
};

async function storyFetch<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const { url, init: reqInit } = resolveBookMallBrowserRequest(base, path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const res = await fetch(url, reqInit);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `request_failed_${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchMyStorySpace(base: string): Promise<StorySpaceData> {
  const j = await storyFetch<{ space: StorySpaceData }>(base, "/api/story/space");
  return j.space;
}

export async function fetchStorySpaceBySlug(base: string, slug: string): Promise<StorySpaceData> {
  const j = await storyFetch<{ space: StorySpaceData }>(base, `/api/story/space/${encodeURIComponent(slug)}`);
  return j.space;
}

export async function publishStorySpace(base: string): Promise<StorySpaceData> {
  const j = await storyFetch<{ space: StorySpaceData }>(base, "/api/story/space/publish", {
    method: "POST",
  });
  return j.space;
}

export async function fetchEngineModels(base: string): Promise<StoryEngineModel[]> {
  const j = await storyFetch<{ models: StoryEngineModel[] }>(base, "/api/story/engine-models");
  return j.models;
}

export async function fetchModelConfig(base: string): Promise<{
  space: StorySpaceData;
  selections: StoryModelSelection[];
}> {
  return storyFetch(base, "/api/story/model-config");
}

export async function patchModelConfig(
  base: string,
  updates: { engineModelId: string; enabled?: boolean; isPrimary?: boolean }[],
): Promise<{ space: StorySpaceData; selections: StoryModelSelection[] }> {
  return storyFetch(base, "/api/story/model-config", {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  });
}
