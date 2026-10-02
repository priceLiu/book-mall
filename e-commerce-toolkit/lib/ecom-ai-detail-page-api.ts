"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/ai-detail-page";

export async function fetchAiDetailPageModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  defaults: { chat: string; image: string };
  imageGenConcurrencyLimit: number;
  promptGenConcurrencyLimit: number;
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  const standard = 2;
  return {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    defaults: (data.defaults as { chat: string; image: string }) ?? { chat: "", image: "" },
    imageGenConcurrencyLimit:
      typeof data.imageGenConcurrencyLimit === "number"
        ? data.imageGenConcurrencyLimit
        : standard,
    promptGenConcurrencyLimit:
      typeof data.promptGenConcurrencyLimit === "number"
        ? data.promptGenConcurrencyLimit
        : standard,
  };
}

export async function listAiDetailPageSummaries() {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
  }>) ?? [];
}

export async function createAiDetailPageProject(opts?: { title?: string }) {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function getAiDetailPageProject(id: string) {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as DetailPageSuiteProject;
}

export async function updateAiDetailPageProject(
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

export async function deleteAiDetailPageProject(id: string) {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadAiDetailPageRef(projectId: string, file: File, label?: string) {
  const form = new FormData();
  form.append("file", file);
  if (label) form.append("label", label);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as DetailPageSuiteProject;
}

export async function visionAiDetailPageSellpoints(projectId: string, opts?: { modelKey?: string }) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/vision/sellpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function planAiDetailPageSlots(projectId: string) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan-slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function planAndPromptsAiDetailPage(
  projectId: string,
  opts?: { modelKey?: string },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan-and-prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function patchAiDetailPagePromptPlanner(
  projectId: string,
  patch: {
    customSystemBody?: string;
    mode?: "default" | "custom";
  },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/prompt-planner/upload`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as DetailPageSuiteProject;
}

export async function uploadAiDetailPagePromptPlannerFile(projectId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/prompt-planner/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as DetailPageSuiteProject;
}

export async function uploadAiDetailPageSlotPromptRef(
  projectId: string,
  moduleId: string,
  slotId: string,
  file: File,
) {
  const form = new FormData();
  form.append("file", file);
  form.append("moduleId", moduleId);
  form.append("slotId", slotId);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/slots/prompt-ref`, {
    method: "POST",
    body: form,
  });
  return data.project as DetailPageSuiteProject;
}

export async function generateAiDetailPagePrompts(
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

export async function generateAiDetailPageImages(
  projectId: string,
  opts?: {
    moduleId?: string;
    slotKey?: string;
    slotKeys?: string[];
    modelKey?: string;
    imageRatio?: "1:1" | "3:4" | "4:5" | "9:16" | "16:9";
    imageSize?: string;
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
