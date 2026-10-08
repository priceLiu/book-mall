"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch, formatEcomTransportError } from "@/lib/ecom-book-fetch";
import {
  noteEcomBookResponseForCredits,
  noteEcomStreamResponseForCredits,
} from "@/lib/ecom-credits-settlement-watch";
import type {
  BrandViChatMessage,
  BrandViModelsPayload,
  BrandViProject,
  BrandViReference,
  BrandViSettings,
  BrandViStepId,
} from "@/lib/brand-vi-types";

const BASE = "api/sso/tools/ecom/brand-vi";

export async function fetchBrandViModels(): Promise<BrandViModelsPayload> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as BrandViModelsPayload["chatModels"]) ?? [],
    imageModels: (data.imageModels as BrandViModelsPayload["imageModels"]) ?? [],
    platformOffering: Boolean(data.platformOffering),
    imageGenConcurrencyLimit: Number(data.imageGenConcurrencyLimit ?? 1),
    defaults: (data.defaults as BrandViModelsPayload["defaults"]) ?? {
      chat: "",
      image: "",
    },
  };
}

export async function listBrandViProjectSummaries(): Promise<
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

export async function createBrandViProject(opts?: {
  title?: string;
}): Promise<BrandViProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as BrandViProject;
}

export async function getBrandViProject(id: string): Promise<BrandViProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as BrandViProject;
}

export async function updateBrandViProject(
  id: string,
  patch: Partial<{
    title: string;
    settings: BrandViSettings;
    status: string;
    meta: BrandViProject["meta"];
    chatHistory: BrandViChatMessage[];
    brief: BrandViProject["brief"];
  }>,
): Promise<BrandViProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as BrandViProject;
}

export async function deleteBrandViProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadBrandViSketch(
  projectId: string,
  file: File,
  opts?: { label?: string; resetFlow?: boolean },
): Promise<{ reference: BrandViReference; project: BrandViProject }> {
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
    reference: BrandViReference;
    project: BrandViProject;
  };
}

export async function removeBrandViSketch(
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

/** 从「我的资产」挂线稿参考图 */
export async function attachBrandViSketchesFromAssets(
  projectId: string,
  assetIds: string[],
): Promise<BrandViProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds }),
  });
  return data.project as BrandViProject;
}

/** AI 生成线稿（wan2.7-image），可能耗时数分钟 */
export async function generateBrandViSketch(
  projectId: string,
  prompt: string,
  opts?: { resetFlow?: boolean },
): Promise<{ reference: BrandViReference; project: BrandViProject }> {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/refs/generate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        resetFlow: opts?.resetFlow ? true : undefined,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg === "fetch failed" ? "与服务器连接中断，请稍后重试。" : msg);
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `生成失败 (${res.status})`);
  }
  const data = (await res.json()) as {
    reference: BrandViReference;
    project: BrandViProject;
    logId?: string;
    logIds?: string[];
  };
  noteEcomBookResponseForCredits(
    `${BASE}/projects/${projectId}/refs/generate`,
    "POST",
    data as unknown as Record<string, unknown>,
  );
  return data;
}

export async function patchBrandViStepPrompts(
  projectId: string,
  stepId: BrandViStepId,
  items: Array<{ index: number; title?: string; prompt?: string }>,
): Promise<BrandViProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/step/${stepId}/prompt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    },
  );
  return data.project as BrandViProject;
}

export async function resetBrandViStepPrompts(
  projectId: string,
  stepId: BrandViStepId,
): Promise<BrandViProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/step/${stepId}/prompt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    },
  );
  return data.project as BrandViProject;
}

/** 出图可能长达数分钟，直接打同域 BFF，不走 ecomBookFetch 的短超时 */
export async function generateBrandViStep(opts: {
  projectId: string;
  stepId: BrandViStepId;
  indexes?: number[];
  modelKey?: string;
  concurrency?: number;
  imageSize?: string;
}): Promise<{
  generated: number;
  failures: Array<{ index: number; message: string }>;
  project: BrandViProject;
}> {
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/${BASE}/projects/${opts.projectId}/step/${opts.stepId}/generate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indexes: opts.indexes,
          modelKey: opts.modelKey,
          concurrency: opts.concurrency,
          imageSize: opts.imageSize,
        }),
      },
    );
  } catch (e) {
    throw new Error(formatEcomTransportError(e));
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    const err = typeof j.error === "string" ? j.error : `生成失败 (${res.status})`;
    const detail =
      typeof j.detail === "string" && j.detail.trim() ? `: ${j.detail.trim()}` : "";
    const combined = `${err}${detail}`;
    if (res.status === 502 && j.error === "upstream_fetch_failed") {
      throw new Error(formatEcomTransportError(new Error(combined)));
    }
    throw new Error(combined);
  }
  return (await res.json()) as {
    generated: number;
    failures: Array<{ index: number; message: string }>;
    project: BrandViProject;
  };
}

export async function uploadBrandViComposePng(opts: {
  projectId: string;
  stepId: BrandViStepId;
  pageIndex: number;
  pngBase64: string;
}): Promise<{ imageUrl: string; project: BrandViProject }> {
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
  return (await res.json()) as { imageUrl: string; project: BrandViProject };
}

export async function streamBrandViChat(opts: {
  projectId: string;
  messages: BrandViChatMessage[];
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
  noteEcomStreamResponseForCredits(
    `${BASE}/projects/${opts.projectId}/assistant/chat`,
    res,
  );
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

export async function syncBrandViPlan(
  projectId: string,
  opts?: { markdown?: string },
): Promise<BrandViProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as BrandViProject;
}

export async function downloadBrandViExportZip(projectId: string): Promise<void> {
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
      : "brand-vi-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type BrandViWorkflowSnapshot = {
  savedAt: string;
  title: string;
  ipName?: string;
};

/** 保存完整手伴工作流镜像到资产库（手伴创作类目） */
export async function saveBrandViWorkflow(
  projectId: string,
  ipName: string,
): Promise<BrandViWorkflowSnapshot> {
  const trimmed = ipName.trim();
  if (!trimmed) throw new Error("请填写 IP 名");
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ipName: trimmed }),
  });
  return data.snapshot as BrandViWorkflowSnapshot;
}

/** 从资产库快照一键复用（复制流程，去掉成图） */
export async function reuseBrandViProject(
  projectId: string,
  savedAt: string,
): Promise<BrandViProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/reuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedAt }),
  });
  return data.project as BrandViProject;
}
