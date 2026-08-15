"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  HandCraftChatMessage,
  HandCraftModelsPayload,
  HandCraftProject,
  HandCraftReference,
  HandCraftSettings,
  HandCraftStepId,
} from "@/lib/hand-craft-types";

const BASE = "api/sso/tools/ecom/hand-craft";

export async function fetchHandCraftModels(): Promise<HandCraftModelsPayload> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as HandCraftModelsPayload["chatModels"]) ?? [],
    imageModels: (data.imageModels as HandCraftModelsPayload["imageModels"]) ?? [],
    platformOffering: Boolean(data.platformOffering),
    imageGenConcurrencyLimit: Number(data.imageGenConcurrencyLimit ?? 1),
    defaults: (data.defaults as HandCraftModelsPayload["defaults"]) ?? {
      chat: "",
      image: "",
    },
  };
}

export async function listHandCraftProjectSummaries(): Promise<
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

export async function createHandCraftProject(opts?: {
  title?: string;
}): Promise<HandCraftProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as HandCraftProject;
}

export async function getHandCraftProject(id: string): Promise<HandCraftProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as HandCraftProject;
}

export async function updateHandCraftProject(
  id: string,
  patch: Partial<{
    title: string;
    settings: HandCraftSettings;
    status: string;
    meta: HandCraftProject["meta"];
    chatHistory: HandCraftChatMessage[];
  }>,
): Promise<HandCraftProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as HandCraftProject;
}

export async function deleteHandCraftProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadHandCraftSketch(
  projectId: string,
  file: File,
  opts?: { label?: string; resetFlow?: boolean },
): Promise<{ reference: HandCraftReference; project: HandCraftProject }> {
  const form = new FormData();
  form.set("file", file);
  if (opts?.label) form.set("label", opts.label);
  if (opts?.resetFlow) form.set("resetFlow", "1");
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
  return (await res.json()) as {
    reference: HandCraftReference;
    project: HandCraftProject;
  };
}

export async function removeHandCraftSketch(
  projectId: string,
  refId: string,
): Promise<void> {
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

export async function patchHandCraftStepPrompts(
  projectId: string,
  stepId: HandCraftStepId,
  items: Array<{ index: number; title?: string; prompt?: string }>,
): Promise<HandCraftProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/step/${stepId}/prompt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    },
  );
  return data.project as HandCraftProject;
}

export async function resetHandCraftStepPrompts(
  projectId: string,
  stepId: HandCraftStepId,
): Promise<HandCraftProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/step/${stepId}/prompt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    },
  );
  return data.project as HandCraftProject;
}

/** 出图可能长达数分钟，直接打同域 BFF，不走 ecomBookFetch 的短超时 */
export async function generateHandCraftStep(opts: {
  projectId: string;
  stepId: HandCraftStepId;
  indexes?: number[];
  modelKey?: string;
  concurrency?: number;
}): Promise<{
  generated: number;
  failures: Array<{ index: number; message: string }>;
  project: HandCraftProject;
}> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${opts.projectId}/step/${opts.stepId}/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indexes: opts.indexes,
        modelKey: opts.modelKey,
        concurrency: opts.concurrency,
      }),
    },
  );
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `生成失败 (${res.status})`);
  }
  return (await res.json()) as {
    generated: number;
    failures: Array<{ index: number; message: string }>;
    project: HandCraftProject;
  };
}

export async function uploadHandCraftComposePng(opts: {
  projectId: string;
  stepId: HandCraftStepId;
  pageIndex: number;
  pngBase64: string;
}): Promise<{ imageUrl: string; project: HandCraftProject }> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${opts.projectId}/compose/${opts.stepId}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageIndex: opts.pageIndex,
        pngBase64: opts.pngBase64,
      }),
    },
  );
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `上传失败 (${res.status})`);
  }
  return (await res.json()) as { imageUrl: string; project: HandCraftProject };
}

export async function streamHandCraftChat(opts: {
  projectId: string;
  messages: HandCraftChatMessage[];
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

export async function syncHandCraftPlan(
  projectId: string,
  opts?: { markdown?: string },
): Promise<HandCraftProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as HandCraftProject;
}

export async function downloadHandCraftExportZip(projectId: string): Promise<void> {
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
      : "hand-craft-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
