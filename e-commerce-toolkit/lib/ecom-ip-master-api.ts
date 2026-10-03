"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import { noteEcomStreamResponseForCredits } from "@/lib/ecom-credits-settlement-watch";
import type {
  IpMasterChatMessage,
  IpMasterModelsPayload,
  IpMasterProject,
  IpMasterSettings,
} from "@/lib/ip-master-types";

const BASE = "api/sso/tools/ecom/ip-master";

export async function fetchIpMasterModels(): Promise<IpMasterModelsPayload> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as IpMasterModelsPayload["chatModels"]) ?? [],
    defaultChatModelKey: String(data.defaultChatModelKey ?? ""),
  };
}

export async function listIpMasterProjectSummaries(): Promise<
  Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
    activeVersion: string | null;
  }>
> {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
    activeVersion: string | null;
  }>) ?? [];
}

export async function createIpMasterProject(opts?: {
  title?: string;
}): Promise<IpMasterProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as IpMasterProject;
}

export async function getIpMasterProject(id: string): Promise<IpMasterProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as IpMasterProject;
}

export async function updateIpMasterProject(
  id: string,
  patch: Partial<{
    title: string;
    brief: Record<string, unknown>;
    settings: IpMasterSettings;
    meta: IpMasterProject["meta"];
    chatHistory: IpMasterChatMessage[];
  }>,
): Promise<IpMasterProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as IpMasterProject;
}

export async function deleteIpMasterProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadIpMasterBenchmark(
  projectId: string,
  file: File,
  label?: string,
): Promise<IpMasterProject> {
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
  const data = (await res.json()) as { project: IpMasterProject };
  return data.project;
}

export async function saveIpMasterTemplate(
  projectId: string,
  markdown: string,
): Promise<IpMasterProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/template/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown }),
  });
  return data.project as IpMasterProject;
}

export async function saveIpMasterWorkflow(
  projectId: string,
  ipName: string,
): Promise<{ title: string; savedAt: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ipName }),
  });
  const snapshot = data.snapshot as { title: string; savedAt: string };
  return snapshot;
}

export async function streamIpMasterChat(opts: {
  projectId: string;
  messages: IpMasterChatMessage[];
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
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `助手失败 (${res.status})`);
  }
  noteEcomStreamResponseForCredits(
    `${BASE}/projects/${opts.projectId}/assistant/chat`,
    res,
  );
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    full += piece;
    opts.onChunk(piece);
  }
  return full.trim();
}

export async function linkIpMasterToHandCraft(
  handCraftProjectId: string,
  ipMasterProjectId: string,
  version?: string,
): Promise<import("@/lib/hand-craft-types").HandCraftProject> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/hand-craft/projects/${handCraftProjectId}/link-ip-master`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipMasterProjectId, version }),
    },
  );
  return data.project as import("@/lib/hand-craft-types").HandCraftProject;
}

export async function linkIpMasterToBrandVi(
  brandViProjectId: string,
  ipMasterProjectId: string,
  version?: string,
): Promise<import("@/lib/brand-vi-types").BrandViProject> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/brand-vi/projects/${brandViProjectId}/link-ip-master`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipMasterProjectId, version }),
    },
  );
  return data.project as import("@/lib/brand-vi-types").BrandViProject;
}
