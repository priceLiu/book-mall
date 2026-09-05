import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

const BASE = "/api/sso/tools/ecom/film-pull";

async function filmPullCall<T>(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { url, init: reqInit } = resolveBookMallBrowserRequest(base, path, init);
  const r = await fetch(url, reqInit);
  const raw = await r.text();
  if (!r.ok) {
    let message = `请求失败 (${r.status})`;
    try {
      const data = JSON.parse(raw) as { error?: string };
      if (typeof data.error === "string") message = data.error;
    } catch {
      if (raw.trim()) message = raw.slice(0, 200);
    }
    throw new Error(message);
  }
  return raw ? (JSON.parse(raw) as T) : (undefined as unknown as T);
}

export type CanvasFilmPullProject = {
  id: string;
  title: string | null;
  status: string;
  media?: { ossUrl?: string; durationSec?: number } | null;
  analyzeResult?: {
    structured?: { shots?: unknown[] };
    parseError?: string | null;
  } | null;
};

export async function createCanvasFilmPullProject(
  base: string,
  opts?: { title?: string; canvasProjectId?: string },
): Promise<CanvasFilmPullProject> {
  const data = await filmPullCall<{ project: CanvasFilmPullProject }>(base, `${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: opts?.title,
      sourceApp: "canvas",
      canvasProjectId: opts?.canvasProjectId,
    }),
  });
  return data.project;
}

export async function getCanvasFilmPullProject(
  base: string,
  projectId: string,
): Promise<CanvasFilmPullProject> {
  const data = await filmPullCall<{ project: CanvasFilmPullProject }>(
    base,
    `${BASE}/projects/${projectId}`,
  );
  return data.project;
}

export async function attachCanvasFilmPullVideoFromUrl(
  base: string,
  projectId: string,
  url: string,
): Promise<CanvasFilmPullProject> {
  const data = await filmPullCall<{ project: CanvasFilmPullProject }>(
    base,
    `${BASE}/projects/${projectId}/media/from-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
  );
  return data.project;
}

export async function uploadCanvasFilmPullVideo(
  base: string,
  projectId: string,
  file: File,
): Promise<CanvasFilmPullProject> {
  const form = new FormData();
  form.append("file", file);
  const data = await filmPullCall<{ project: CanvasFilmPullProject }>(
    base,
    `${BASE}/projects/${projectId}/media/upload`,
    { method: "POST", body: form },
  );
  return data.project;
}

export async function analyzeCanvasFilmPull(
  base: string,
  projectId: string,
  opts?: { modelKey?: string },
): Promise<CanvasFilmPullProject> {
  const data = await filmPullCall<{ project: CanvasFilmPullProject }>(
    base,
    `${BASE}/projects/${projectId}/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts ?? {}),
    },
  );
  return data.project;
}

export async function exportCanvasFilmPullPro2(
  base: string,
  projectId: string,
  opts?: { title?: string },
): Promise<{ productionScript: Pro2ProductionScript }> {
  return filmPullCall(base, `${BASE}/projects/${projectId}/export/pro2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
}
