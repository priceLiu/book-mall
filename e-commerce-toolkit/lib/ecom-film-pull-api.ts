"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { FilmPullProject } from "@/lib/film-pull-types";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/film-pull";

export async function fetchFilmPullModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
  defaults?: { chat?: string; video?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
    defaults: data.defaults as { chat?: string; video?: string } | undefined,
  };
}

export async function createFilmPullProject(opts?: {
  title?: string;
  sourceApp?: "ecom" | "canvas";
  canvasProjectId?: string;
}): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as FilmPullProject;
}

export async function getFilmPullProject(id: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as FilmPullProject;
}

export async function listFilmPullProjectSummaries(): Promise<EcomProjectListItem[]> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  const items = (data.items as FilmPullProject[]) ?? [];
  return items.map((p) => ({
    id: p.id,
    title: p.title?.trim() || "专业拉片",
    updatedAt: p.updatedAt,
    subtitle: p.status,
  }));
}

export async function updateFilmPullProject(
  id: string,
  patch: Record<string, unknown>,
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as FilmPullProject;
}

export async function deleteFilmPullProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadFilmPullVideo(
  projectId: string,
  file: File,
): Promise<FilmPullProject> {
  const form = new FormData();
  form.append("file", file);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as FilmPullProject;
}

export async function setFilmPullVideoFromUrl(
  projectId: string,
  url: string,
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/from-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return data.project as FilmPullProject;
}

export async function attachFilmPullAsset(
  projectId: string,
  assetId: string,
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  return data.project as FilmPullProject;
}

export async function clearFilmPullMedia(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media`, {
    method: "DELETE",
  });
  return data.project as FilmPullProject;
}

export async function uploadFilmPullCharacterRef(
  projectId: string,
  file: File,
  label?: string,
): Promise<FilmPullProject> {
  const form = new FormData();
  form.append("file", file);
  if (label) form.append("label", label);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/character-refs/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as FilmPullProject;
}

export async function streamFilmPullAnalyze(
  projectId: string,
  opts?: { prompt?: string; modelKey?: string },
  onChunk?: (text: string) => void,
): Promise<string> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(opts ?? {}),
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      project?: FilmPullProject;
    };
    throw new Error(data.error ?? `拉片失败 (${res.status})`);
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
    onChunk?.(full);
  }
  return full.trim();
}

/** @deprecated 请使用 streamFilmPullAnalyze；保留供轮询 job 降级 */
export async function analyzeFilmPull(
  projectId: string,
  opts?: { prompt?: string; modelKey?: string },
): Promise<FilmPullProject> {
  await streamFilmPullAnalyze(projectId, opts);
  const project = await getFilmPullProject(projectId);
  if (!project) throw new Error("拉片失败");
  return project;
}

export async function cancelFilmPullAnalyze(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/analyze/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function renderFilmPullScript(
  projectId: string,
  opts?: { characterDescription?: string; modelKey?: string },
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/render-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as FilmPullProject;
}

export async function generateFilmPullShotVideo(
  projectId: string,
  shotNo: number,
  opts?: { modelKey?: string },
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/shots/${shotNo}/video/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts ?? {}),
    },
  );
  return data.project as FilmPullProject;
}

export async function generateFilmPullShotsBatch(
  projectId: string,
  opts?: { shotNos?: number[]; modelKey?: string },
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/shots/video/generate-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as FilmPullProject;
}

export async function renderFilmPullFinalVideo(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function exportFilmPullPro2(
  projectId: string,
  opts?: { title?: string },
): Promise<{ productionScript: unknown }> {
  return ecomBookFetch(`${BASE}/projects/${projectId}/export/pro2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  }) as Promise<{ productionScript: unknown }>;
}

export function filmPullExportZipUrl(projectId: string): string {
  return `/api/book-mall/${BASE}/projects/${projectId}/export?format=zip`;
}

export async function downloadFilmPullExportZip(projectId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(filmPullExportZipUrl(projectId), {
      method: "GET",
      credentials: "include",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg === "fetch failed" ? "与服务器连接中断，请稍后重试。" : msg);
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    let message = `导出失败 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === "string") message = data.error;
    } catch {
      /* */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = utf8Match
    ? decodeURIComponent(utf8Match[1]!)
    : plainMatch
      ? plainMatch[1]!
      : "film-pull-export.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
