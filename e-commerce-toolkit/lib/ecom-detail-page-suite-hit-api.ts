"use client";

import { throwIfUnauthorized } from "@/lib/ecom-auth";
import { ecomBookFetch, formatEcomTransportError } from "@/lib/ecom-book-fetch";
import type { DetailPageSuiteCopyOverlay } from "@/lib/detail-page-suite-copy-overlay";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/detail-page-suite-hit";

export async function fetchDetailPageSuiteHitModels(): Promise<{
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

export async function listDetailPageSuiteHitSummaries() {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
  }>) ?? [];
}

export async function createDetailPageSuiteHitProject(opts?: { title?: string }) {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function getDetailPageSuiteHitProject(id: string) {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as DetailPageSuiteProject;
}

export async function updateDetailPageSuiteHitProject(
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

export async function deleteDetailPageSuiteHitProject(id: string) {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadDetailPageSuiteHitRef(
  projectId: string,
  file: File,
  opts?: { label?: string; role?: "reference_suite" | "product" | "model" },
) {
  const form = new FormData();
  form.append("file", file);
  if (opts?.label) form.append("label", opts.label);
  if (opts?.role) form.append("role", opts.role);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as DetailPageSuiteProject;
}

export async function visionDetailPageSuiteHitSellpoints(
  projectId: string,
  modelKey?: string,
  opts?: { async?: boolean },
) {
  return postHitJson(`projects/${projectId}/vision/sellpoints`, {
    modelKey,
    async: opts?.async !== false,
  });
}

export class DetailPageSuiteHitInFlightError extends Error {
  project: DetailPageSuiteProject;
  constructor(project: DetailPageSuiteProject) {
    super("任务已在进行中");
    this.name = "DetailPageSuiteHitInFlightError";
    this.project = project;
  }
}

async function postHitJson(path: string, body: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(formatEcomTransportError(e));
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* */
  }
  throwIfUnauthorized(res, data);
  if (res.status === 409 && data.project) {
    throw new DetailPageSuiteHitInFlightError(data.project as DetailPageSuiteProject);
  }
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `请求失败 (${res.status})`;
    if (res.status === 502 && data.error === "upstream_fetch_failed") {
      throw new Error(formatEcomTransportError(new Error(String(err))));
    }
    throw new Error(err);
  }
  return data.project as DetailPageSuiteProject;
}

export async function decomposeDetailPageSuiteHit(
  projectId: string,
  opts?: { visionModelKey?: string; chatModelKey?: string; async?: boolean },
) {
  return postHitJson(`projects/${projectId}/hit/decompose`, {
    async: true,
    ...(opts ?? {}),
  });
}

export async function rewriteDetailPageSuiteHit(
  projectId: string,
  opts?: { chatModelKey?: string; async?: boolean },
) {
  return postHitJson(`projects/${projectId}/hit/rewrite`, {
    async: true,
    ...(opts ?? {}),
  });
}

export async function rewriteDetailPageSuiteHitSlot(
  projectId: string,
  body: { moduleId: string; slotKey: string; chatModelKey?: string },
) {
  return postHitJson(`projects/${projectId}/hit/rewrite-slot`, body);
}

export async function saveDetailPageSuiteHitTemplate(
  projectId: string,
  template: unknown,
) {
  return postHitJson(`projects/${projectId}/hit/template`, { template });
}

export async function resetDetailPageSuiteHitTemplate(projectId: string) {
  return postHitJson(`projects/${projectId}/hit/template`, { reset: true });
}

/** 通用烧字合成（详情页 / 画布共用） */
export async function composeEcomCopyOverlay(body: {
  baseImageUrl: string;
  overlay: DetailPageSuiteCopyOverlay;
  syncText?: string;
  exportWidthPx?: number;
}) {
  return ecomBookFetch("api/sso/tools/ecom/copy-overlay/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Promise<{ url: string; overlay: DetailPageSuiteCopyOverlay }>;
}

export async function composeDetailPageSuiteHitSlot(
  projectId: string,
  body: {
    moduleId: string;
    slotKey: string;
    baseImageUrl: string;
    overlay: DetailPageSuiteCopyOverlay;
    slotCopy?: string;
  },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/compose-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data as { url: string; project: DetailPageSuiteProject };
}

export async function generateDetailPageSuiteHitImages(
  projectId: string,
  body: {
    moduleId?: string;
    slotKey?: string;
    slotKeys?: string[];
    onlySelected?: boolean;
    modelKey?: string;
    imageSize?: string;
    imageRatio?: "1:1" | "3:4" | "4:5" | "16:9";
    includeSlotCopyOnImage?: boolean;
    activeExportTargetIds?: string[];
  },
) {
  return ecomBookFetch(`${BASE}/projects/${projectId}/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Promise<{
    project: DetailPageSuiteProject;
    generated: number;
    failures: string[];
  }>;
}
