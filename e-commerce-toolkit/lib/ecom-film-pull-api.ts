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

export async function uploadFilmPullRef(
  projectId: string,
  role: "model" | "product",
  file: File,
): Promise<FilmPullProject> {
  const form = new FormData();
  form.append("role", role);
  form.append("file", file);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as FilmPullProject;
}

export async function removeFilmPullRef(
  projectId: string,
  refId: string,
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/${refId}`, {
    method: "DELETE",
  });
  return data.project as FilmPullProject;
}

export async function recognizeFilmPullProduct(
  projectId: string,
  opts?: { userDraft?: string },
): Promise<{ project: FilmPullProject; productBrief: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/recognize-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as FilmPullProject,
    productBrief: String(data.productBrief ?? ""),
  };
}

export async function attachFilmPullModelFromLibrary(
  projectId: string,
  entry: { id: string; name: string; ossUrl: string },
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelEntry: entry }),
  });
  return data.project as FilmPullProject;
}

export async function attachFilmPullRefsFromAssets(
  projectId: string,
  role: "model" | "product",
  assetIds: string[],
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, assetIds }),
  });
  return data.project as FilmPullProject;
}

export async function mockFilmPullRecognizeProduct(
  projectId: string,
): Promise<{ project: FilmPullProject; productBrief: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/recognize-product/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return {
    project: data.project as FilmPullProject,
    productBrief: String(data.productBrief ?? ""),
  };
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

/** Dev only · Mock 拉片（不调 Gateway，写入 fixture 结果） */
export async function mockFilmPullAnalyze(
  projectId: string,
  args?: { prompt?: string },
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/analyze/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  return data.project as FilmPullProject;
}

/** Dev only · Mock 渲染脚本 */
export async function mockFilmPullRenderScript(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/render-script/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

/** Dev only · Mock 批量出镜 */
export async function mockFilmPullBatchGenerate(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/shots/video/generate-batch/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

/** Dev only · Mock 合成成片 */
export async function mockFilmPullFinalRender(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/video/render/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function startFilmPullReplica(projectId: string): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return {
    project: data.project as FilmPullProject,
    seedVideo: data.seedVideo as import("@/lib/seed-video-types").SeedVideoProject,
  };
}

export async function uploadFilmPullReplicaRef(
  projectId: string,
  role: "model" | "product",
  file: File,
): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
}> {
  const form = new FormData();
  form.set("role", role);
  form.set("file", file);
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/replica/refs`, {
    method: "POST",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as {
    project?: FilmPullProject;
    seedVideo?: import("@/lib/seed-video-types").SeedVideoProject;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return { project: data.project!, seedVideo: data.seedVideo! };
}

export async function removeFilmPullReplicaRef(
  projectId: string,
  refId: string,
): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
}> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/replica/refs/${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
  return {
    project: data.project as FilmPullProject,
    seedVideo: data.seedVideo as import("@/lib/seed-video-types").SeedVideoProject,
  };
}

export async function recognizeFilmPullReplicaProduct(
  projectId: string,
  opts?: { userDraft?: string },
): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
  productBrief: string;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/recognize-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as FilmPullProject,
    seedVideo: data.seedVideo as import("@/lib/seed-video-types").SeedVideoProject,
    productBrief: String(data.productBrief ?? ""),
  };
}

export async function mockFilmPullReplicaRecognizeProduct(projectId: string): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
  productBrief: string;
}> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/replica/recognize-product/mock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  return {
    project: data.project as FilmPullProject,
    seedVideo: data.seedVideo as import("@/lib/seed-video-types").SeedVideoProject,
    productBrief: String(data.productBrief ?? ""),
  };
}

export async function generateFilmPullReplicaScript(
  projectId: string,
  opts?: { productBrief?: string; modelKey?: string },
): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/generate-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as FilmPullProject,
    seedVideo: data.seedVideo as import("@/lib/seed-video-types").SeedVideoProject,
  };
}

export async function generateFilmPullReplicaModelPrompt(
  projectId: string,
  modelKey?: string,
): Promise<{ prompt: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/model-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modelKey ? { modelKey } : {}),
  });
  return { prompt: String(data.prompt ?? "") };
}

export async function generateFilmPullReplicaModelImage(
  projectId: string,
  opts: { prompt: string; modelKey: string; imageSize?: string },
): Promise<{
  project: FilmPullProject;
  seedVideo: import("@/lib/seed-video-types").SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/model/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    project: data.project as FilmPullProject,
    seedVideo: data.seedVideo as import("@/lib/seed-video-types").SeedVideoProject,
  };
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

export async function autoFilmPullRefMatch(projectId: string, mock = false): Promise<FilmPullProject> {
  const path = mock
    ? `${BASE}/projects/${projectId}/ref-match/auto/mock`
    : `${BASE}/projects/${projectId}/ref-match/auto`;
  const data = await ecomBookFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function patchFilmPullRefMatchShot(
  projectId: string,
  shotNo: number,
  patch: { modelRefIds?: string[]; productRefIds?: string[] },
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/ref-match`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shotNo, ...patch }),
  });
  return data.project as FilmPullProject;
}

export async function confirmFilmPullRefMatch(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/ref-match/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function assembleFilmPullProductionScript(
  projectId: string,
  mock = false,
): Promise<FilmPullProject> {
  const path = mock
    ? `${BASE}/projects/${projectId}/production/assemble/mock`
    : `${BASE}/projects/${projectId}/production/assemble`;
  const data = await ecomBookFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function saveFilmPullProductionPlan(
  projectId: string,
  productionPlan: FilmPullProject["productionPlan"],
  opts?: { refMatch?: FilmPullProject["refMatch"] },
): Promise<FilmPullProject> {
  const body: Record<string, unknown> = { productionPlan };
  if (opts?.refMatch !== undefined) {
    body.refMatch = opts.refMatch;
  }
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.project as FilmPullProject;
}

export async function patchFilmPullProductionShot(
  projectId: string,
  shotNo: number,
  patch: Record<string, unknown>,
): Promise<FilmPullProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/production/shots/${shotNo}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return data.project as FilmPullProject;
}

export async function confirmFilmPullProductionScript(projectId: string): Promise<FilmPullProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/production/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as FilmPullProject;
}

export async function generateFilmPullProductionImage(
  projectId: string,
  shotNo: number,
  opts: { modelKey: string; imageSize?: string },
  mock = false,
): Promise<FilmPullProject> {
  const path = mock
    ? `${BASE}/projects/${projectId}/shots/${shotNo}/image/generate/mock`
    : `${BASE}/projects/${projectId}/shots/${shotNo}/image/generate`;
  const data = await ecomBookFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return data.project as FilmPullProject;
}

/** V2：标记复刻流程已开始（不创建 seed-video） */
export async function startFilmPullReplicaFlow(projectId: string): Promise<FilmPullProject> {
  return updateFilmPullProject(projectId, {
    meta: {
      replicaResultAt: new Date().toISOString(),
      replicaSeedVideoProjectId: null,
      refMatchConfirmedAt: null,
      productionScriptConfirmedAt: null,
    },
    refMatch: null,
    productionPlan: null,
  });
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
