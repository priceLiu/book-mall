"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  DetailPageSuiteChatMessage,
  DetailPageSuiteProject,
  DetailPageSuiteTemplate,
} from "@/lib/detail-page-suite-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/detail-page-suite";

export async function fetchDetailPageSuiteModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  defaults: { chat: string; image: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    defaults: (data.defaults as { chat: string; image: string }) ?? { chat: "", image: "" },
  };
}

export async function listDetailPageSuiteTemplates(platformCode?: string) {
  const qs = platformCode ? `?platformCode=${encodeURIComponent(platformCode)}` : "";
  const data = await ecomBookFetch(`${BASE}/templates${qs}`);
  return (data.items as DetailPageSuiteTemplate[]) ?? [];
}

export async function copyDetailPageSuiteTemplate(
  sourceId: string,
  templateName?: string,
  modules?: DetailPageSuiteTemplate["modules"],
) {
  const data = await ecomBookFetch(`${BASE}/templates/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId, templateName, modules }),
  });
  return data.item as DetailPageSuiteTemplate;
}

export async function listDetailPageSuiteSummaries() {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
  }>) ?? [];
}

export async function createDetailPageSuiteProject(opts?: { title?: string }) {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function getDetailPageSuiteProject(id: string) {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as DetailPageSuiteProject;
}

export async function updateDetailPageSuiteProject(
  id: string,
  patch: Partial<DetailPageSuiteProject>,
) {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as DetailPageSuiteProject;
}

export async function deleteDetailPageSuiteProject(id: string) {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadDetailPageSuiteRef(projectId: string, file: File, label?: string) {
  const form = new FormData();
  form.append("file", file);
  if (label) form.append("label", label);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as DetailPageSuiteProject;
}

export async function visionDetailPageSuiteSellpoints(
  projectId: string,
  opts?: { modelKey?: string; polish?: boolean },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/vision/sellpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelKey: opts?.modelKey,
      ...(opts?.polish ? { action: "polish" } : {}),
    }),
  });
  return data.project as DetailPageSuiteProject;
}

export async function generateDetailPageSuitePrompts(
  projectId: string,
  opts?: { moduleId?: string; slotKey?: string; modelKey?: string },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/prompts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function generateDetailPageSuiteImages(
  projectId: string,
  opts?: {
    moduleId?: string;
    slotKey?: string;
    slotKeys?: string[];
    onlySelected?: boolean;
    modelKey?: string;
    imageSize?: string;
    imageRatio?: "1:1" | "3:4" | "4:5" | "16:9";
  },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as DetailPageSuiteProject,
    generated: Number(data.generated ?? 0),
    failures: (data.failures as string[]) ?? [],
  };
}

export function appendChat(
  history: DetailPageSuiteChatMessage[],
  role: "user" | "assistant",
  content: string,
): DetailPageSuiteChatMessage[] {
  return [
    ...history,
    {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      createdAt: new Date().toISOString(),
    },
  ];
}
