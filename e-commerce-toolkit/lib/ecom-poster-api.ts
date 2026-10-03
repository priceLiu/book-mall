"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  EcomCopyImageArtifact,
} from "@private/ecom-copy-overlay";
import type {
  PosterEasyPath,
  PosterFestivalPack,
  PosterPlan,
  PosterProject,
  PosterReference,
} from "@/lib/ecom-poster-types";

const BASE = "api/sso/tools/ecom/poster";

export async function listPosterProjects(): Promise<PosterProject[]> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  return (data.items as PosterProject[]) ?? [];
}

export async function createPosterProject(opts?: { title?: string }): Promise<PosterProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as PosterProject;
}

export async function getPosterProject(id: string): Promise<PosterProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as PosterProject;
}

export async function patchPosterProject(
  id: string,
  patch: Partial<{
    title: string;
    plan: PosterPlan;
    references: PosterReference[];
    settings: Record<string, unknown>;
  }>,
): Promise<PosterProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as PosterProject;
}

export async function fetchPosterFestivals(): Promise<PosterFestivalPack[]> {
  const data = await ecomBookFetch(`${BASE}/festivals`);
  return (data.items as PosterFestivalPack[]) ?? [];
}

export async function posterAutoPlan(
  projectId: string,
  body: { easyPath: PosterEasyPath; festivalId?: string; oneLineBrief?: string },
): Promise<PosterProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/auto-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.project as PosterProject;
}

export async function posterGenerate(
  projectId: string,
  count?: number,
): Promise<{ project: PosterProject; urls: string[] }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(count != null ? { count } : {}),
  });
  return data as { project: PosterProject; urls: string[] };
}

export async function posterCompose(
  projectId: string,
  body: {
    artifactIndex: number;
    artifact: EcomCopyImageArtifact;
    slotCopy?: string;
  },
): Promise<{ project: PosterProject; url: string; assetId: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/compose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data as { project: PosterProject; url: string; assetId: string };
}

export async function posterBatchGenerate(
  projectId: string,
  lines: string[],
): Promise<{ project: PosterProject; count: number }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/batch-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  return data as { project: PosterProject; count: number };
}

export async function uploadPosterRef(
  projectId: string,
  file: File,
  role: PosterReference["role"],
): Promise<{ project: PosterProject; ref: PosterReference }> {
  const form = new FormData();
  form.set("file", file);
  form.set("role", role);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/upload`, {
    method: "POST",
    body: form,
  });
  return data as { project: PosterProject; ref: PosterReference };
}

export async function downloadPosterProjectZip(projectId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/export`, {
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
      /* 非 JSON */
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
      : "poster-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
