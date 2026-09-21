"use client";

import { throwIfUnauthorized } from "@/lib/ecom-auth";
import { ecomBookFetch, formatEcomTransportError } from "@/lib/ecom-book-fetch";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/detail-page-suite-replica";

export async function fetchDetailPageSuiteReplicaModels(): Promise<{
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

export async function listDetailPageSuiteReplicaSummaries() {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    thumbnailUrl: string | null;
  }>) ?? [];
}

export async function createDetailPageSuiteReplicaProject(opts?: { title?: string }) {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as DetailPageSuiteProject;
}

export async function getDetailPageSuiteReplicaProject(id: string) {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as DetailPageSuiteProject;
}

export async function updateDetailPageSuiteReplicaProject(
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

export async function deleteDetailPageSuiteReplicaProject(id: string) {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadDetailPageSuiteReplicaRef(
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

export class DetailPageSuiteReplicaVisionSellpointInFlightError extends Error {
  project: DetailPageSuiteProject;
  constructor(project: DetailPageSuiteProject) {
    super("识图卖点已在进行中");
    this.name = "DetailPageSuiteReplicaVisionSellpointInFlightError";
    this.project = project;
  }
}

export async function visionDetailPageSuiteReplicaSellpoints(
  projectId: string,
  modelKey?: string,
  opts?: { async?: boolean },
) {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/vision/sellpoints`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelKey, async: opts?.async !== false }),
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
    throw new DetailPageSuiteReplicaVisionSellpointInFlightError(
      data.project as DetailPageSuiteProject,
    );
  }
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `请求失败 (${res.status})`;
    throw new Error(err);
  }
  return data.project as DetailPageSuiteProject;
}

export class DetailPageSuiteReplicaDecomposeInFlightError extends Error {
  project: DetailPageSuiteProject;
  constructor(project: DetailPageSuiteProject) {
    super("拆解已在进行中");
    this.name = "DetailPageSuiteReplicaDecomposeInFlightError";
    this.project = project;
  }
}

export async function decomposeDetailPageSuiteReplica(
  projectId: string,
  opts?: {
    visionModelKey?: string;
    chatModelKey?: string;
    /** 默认 true：立即返回，服务端后台继续清单+归类 */
    async?: boolean;
  },
) {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/replica/decompose`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ async: true, ...(opts ?? {}) }),
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
    throw new DetailPageSuiteReplicaDecomposeInFlightError(
      data.project as DetailPageSuiteProject,
    );
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

export async function assignDetailPageSuiteReplicaSegmentModule(
  projectId: string,
  body: { itemKey: string; moduleId: string | null },
) {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/replica/inventory/assign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return data.project as DetailPageSuiteProject;
}

export async function generateDetailPageSuiteReplicaPrompts(
  projectId: string,
  body: { moduleIds: string[]; chatModelKey?: string },
) {
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/${BASE}/projects/${projectId}/replica/prompts/generate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
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
    throw new DetailPageSuiteReplicaDecomposeInFlightError(
      data.project as DetailPageSuiteProject,
    );
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

export async function generateDetailPageSuiteReplicaImages(
  projectId: string,
  body: {
    moduleId?: string;
    slotKey?: string;
    slotKeys?: string[];
    onlySelected?: boolean;
    modelKey?: string;
    imageSize?: string;
    imageRatio?: "1:1" | "3:4" | "4:5" | "16:9";
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
