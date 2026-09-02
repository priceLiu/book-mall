"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  ModelShotChatMessage,
  ModelShotModelsPayload,
  ModelShotProject,
  ModelShotReference,
  ModelShotReferenceRole,
  ModelShotSettings,
} from "@/lib/model-shot-types";

const BASE = "api/sso/tools/ecom/model-shot";

export async function fetchModelShotModels(): Promise<ModelShotModelsPayload> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as ModelShotModelsPayload["chatModels"]) ?? [],
    imageModels: (data.imageModels as ModelShotModelsPayload["imageModels"]) ?? [],
    defaults: (data.defaults as ModelShotModelsPayload["defaults"]) ?? { chat: "", image: "" },
  };
}

export async function listModelShotProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string; thumbnailUrl: string | null }>
> {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
  }>) ?? [];
}

export async function createModelShotProject(opts?: {
  title?: string;
}): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as ModelShotProject;
}

export async function getModelShotProject(id: string): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as ModelShotProject;
}

export async function updateModelShotProject(
  id: string,
  patch: Partial<{
    title: string;
    settings: ModelShotSettings;
    status: string;
    meta: ModelShotProject["meta"];
    chatHistory: ModelShotChatMessage[];
    references: ModelShotReference[];
    brief: ModelShotProject["brief"];
    plan: ModelShotProject["plan"];
  }>,
): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as ModelShotProject;
}

export async function deleteModelShotProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadModelShotReference(
  projectId: string,
  file: File,
  opts: {
    role: "garment" | "model" | "scene" | "prop";
    label?: string;
    source?: string;
    catalogId?: string;
    name?: string;
    description?: string;
  },
): Promise<ModelShotProject> {
  const form = new FormData();
  form.set("file", file);
  form.set("role", opts.role);
  if (opts.label) form.set("label", opts.label);
  if (opts.source) form.set("source", opts.source);
  if (opts.catalogId) form.set("catalogId", opts.catalogId);
  if (opts.name) form.set("name", opts.name);
  if (opts.description) form.set("description", opts.description);
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
  const data = (await res.json()) as { project: ModelShotProject };
  return data.project;
}

export async function attachModelShotReference(
  projectId: string,
  payload:
    | { reference: ModelShotReference }
    | {
        role: ModelShotReferenceRole;
        assetIds: string[];
      }
    | {
        role: "model";
        modelEntry: { id: string; name: string; ossUrl: string };
      }
    | {
        role: "model" | "scene" | "prop";
        description: string;
      },
): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.project as ModelShotProject;
}

export async function patchModelShotPoseItem(
  projectId: string,
  index: number,
  patch: {
    prompt?: string;
    poseDescription?: string;
    sceneText?: string;
    propText?: string;
    sceneCatalogId?: string | null;
    propCatalogId?: string | null;
    applySceneToAll?: boolean;
    applyPropToAll?: boolean;
    activeImageIndex?: number;
  },
): Promise<ModelShotProject> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/refs/upload`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index, ...patch }),
  });
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `保存失败 (${res.status})`);
  }
  const data = (await res.json()) as { project: ModelShotProject };
  return data.project;
}

/** @deprecated 使用 patchModelShotPoseItem */
export async function patchModelShotPosePrompt(
  projectId: string,
  index: number,
  prompt: string,
): Promise<ModelShotProject> {
  return patchModelShotPoseItem(projectId, index, { prompt });
}

export async function generateModelShotPosePlan(
  projectId: string,
): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/poses/generate`, {
    method: "POST",
  });
  return data.project as ModelShotProject;
}

export async function confirmModelShotPlan(projectId: string): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan/confirm`, {
    method: "POST",
  });
  return data.project as ModelShotProject;
}

export async function generateModelShotImages(opts: {
  projectId: string;
  indexes?: number[];
  modelKey?: string;
  imageSize?: string;
}): Promise<{
  generated: number;
  failures: string[];
  project: ModelShotProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${opts.projectId}/image/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      indexes: opts.indexes,
      modelKey: opts.modelKey,
      imageSize: opts.imageSize,
    }),
  });
  return {
    generated: typeof data.generated === "number" ? data.generated : 0,
    failures: Array.isArray(data.failures)
      ? data.failures.filter((x): x is string => typeof x === "string")
      : [],
    project: data.project as ModelShotProject,
  };
}

export async function generateModelShotReference(
  projectId: string,
  opts: {
    role: "model" | "scene" | "prop";
    prompt: string;
    modelKey?: string;
  },
): Promise<{ project: ModelShotProject }> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/refs/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `生成失败 (${res.status})`);
  }
  return (await res.json()) as { project: ModelShotProject };
}

export async function streamModelShotChat(opts: {
  projectId: string;
  messages: ModelShotChatMessage[];
  modelKey: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${opts.projectId}/assistant/chat`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: opts.messages, modelKey: opts.modelKey }),
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

export async function saveModelShotDeliverableSnapshot(
  projectId: string,
  workName: string,
): Promise<{ project: ModelShotProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/deliverable/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workName }),
  });
  return { project: data.project as ModelShotProject };
}

export async function reuseModelShotProject(
  projectId: string,
  savedAt?: string,
): Promise<ModelShotProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/reuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savedAt ? { savedAt } : {}),
  });
  return data.project as ModelShotProject;
}

export async function downloadModelShotExportZip(projectId: string): Promise<void> {
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
      : "model-shot-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
