"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  MediaDecomposeChatModel,
  MediaDecomposeProject,
  MediaDecomposeSettings,
} from "@/lib/media-decompose-types";
import type { SeedVideoProject } from "@/lib/seed-video-types";

const BASE = "api/sso/tools/ecom/media-decompose";

export async function fetchMediaDecomposeModels(): Promise<{
  chatModels: MediaDecomposeChatModel[];
  defaults?: { chat?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as MediaDecomposeChatModel[]) ?? [],
    defaults: data.defaults as { chat?: string } | undefined,
  };
}

export async function listMediaDecomposeProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string; mediaKind: string | null }>
> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  const items = (data.items as MediaDecomposeProject[]) ?? [];
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    updatedAt: p.updatedAt,
    mediaKind: p.media?.kind ?? null,
  }));
}

export async function createMediaDecomposeProject(opts?: {
  title?: string;
}): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as MediaDecomposeProject;
}

export async function getMediaDecomposeProject(id: string): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as MediaDecomposeProject;
}

export async function updateMediaDecomposeProject(
  id: string,
  patch: Partial<{ title: string; settings: MediaDecomposeSettings }>,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as MediaDecomposeProject;
}

export async function uploadMediaDecomposeFile(
  projectId: string,
  file: File,
): Promise<MediaDecomposeProject> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/media/upload`, {
    method: "POST",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as { project?: MediaDecomposeProject; error?: string };
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return data.project!;
}

export async function setMediaDecomposeFromUrl(
  projectId: string,
  url: string,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/from-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return data.project as MediaDecomposeProject;
}

export async function attachMediaDecomposeAsset(
  projectId: string,
  assetId: string,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  return data.project as MediaDecomposeProject;
}

export async function clearMediaDecomposeMedia(projectId: string): Promise<MediaDecomposeProject> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/media`, {
    method: "DELETE",
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as { project?: MediaDecomposeProject; error?: string };
  if (!res.ok) throw new Error(data.error ?? "清除失败");
  return data.project!;
}

export async function streamMediaDecompose(
  projectId: string,
  args: { prompt: string; modelKey: string },
  onChunk: (text: string) => void,
): Promise<string> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `拆解失败 (${res.status})`);
  }
  if (!res.body) throw new Error("无响应体");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    full += piece;
    onChunk(full);
  }
  return full.trim();
}

export async function startMediaDecomposeReplica(projectId: string): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
  };
}

export async function getMediaDecomposeReplica(projectId: string): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject | null;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica`);
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: (data.seedVideo as SeedVideoProject | null) ?? null,
  };
}
