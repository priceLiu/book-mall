"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  SeedVideoChatMessage,
  SeedVideoPlan,
  SeedVideoProject,
  SeedVideoReference,
  SeedVideoSettings,
} from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/seed-video";

export async function fetchSeedVideoModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
}> {
  const data = await ecomBookFetch("api/sso/tools/ecom/storyboard/models");
  return {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
  };
}

export async function listSeedVideoProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string }>
> {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{ id: string; title: string | null; updatedAt: string }>) ?? [];
}

export async function createSeedVideoProject(opts?: {
  title?: string;
}): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as SeedVideoProject;
}

export async function getSeedVideoProject(id: string): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as SeedVideoProject;
}

export async function updateSeedVideoProject(
  id: string,
  patch: Partial<{
    title: string;
    settings: SeedVideoSettings;
    plan: SeedVideoPlan;
    meta: SeedVideoProject["meta"];
    status: string;
  }>,
): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as SeedVideoProject;
}

export async function uploadSeedVideoRef(
  projectId: string,
  file: File,
  label?: string,
): Promise<SeedVideoReference> {
  const form = new FormData();
  form.set("file", file);
  if (label) form.set("label", label);
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/refs/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `上传失败 (${res.status})`);
  }
  const data = (await res.json()) as { reference: SeedVideoReference };
  return data.reference;
}

export async function removeSeedVideoRef(projectId: string, refId: string): Promise<void> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${projectId}/refs/upload?refId=${encodeURIComponent(refId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `删除失败 (${res.status})`);
  }
}

export async function streamSeedVideoChat(opts: {
  projectId: string;
  messages: SeedVideoChatMessage[];
  modelKey: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${opts.projectId}/assistant/chat`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: opts.messages,
        modelKey: opts.modelKey,
      }),
    },
  );
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const text = await res.text();
    let err = `请求失败 (${res.status})`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      if (text) err = text.slice(0, 200);
    }
    throw new Error(err);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("无响应流");
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    opts.onChunk(chunk);
  }
  return full;
}

export async function syncSeedVideoPlan(
  projectId: string,
  opts?: { markdown?: string; userChoice?: string },
): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as SeedVideoProject;
}

export async function generateSeedVideoShot(opts: {
  projectId: string;
  shotIndex: number;
  modelKey: string;
  durationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  resolution?: string;
}): Promise<{ videoUrl: string; shotIndex: number }> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${opts.projectId}/video/panel/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return data as { videoUrl: string; shotIndex: number };
}

export async function generateSeedVideoDirect(opts: {
  projectId: string;
  modelKey: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
}): Promise<{ taskId: string; logId: string; startedAt: string }> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${opts.projectId}/video/direct/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return data as { taskId: string; logId: string; startedAt: string };
}

export async function pollSeedVideoDirect(projectId: string): Promise<{
  status: string;
  videoUrl?: string;
  assetId?: string;
  taskId?: string;
}> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/video/direct/generate`,
  );
  return data as { status: string; videoUrl?: string; assetId?: string; taskId?: string };
}

export async function generateSeedVideoTts(opts: {
  projectId: string;
  shotIndex?: number;
}): Promise<{ shots: unknown[] }> {
  const data = await ecomBookFetch(`${BASE}/projects/${opts.projectId}/tts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return data as { shots: unknown[] };
}

export async function renderSeedVideo(projectId: string): Promise<{ jobId: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data as { jobId: string };
}

export async function pollSeedVideoRender(projectId: string): Promise<{
  status: string;
  outputUrl?: string;
  failMessage?: string;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/video/render`);
  return data as { status: string; outputUrl?: string; failMessage?: string };
}
