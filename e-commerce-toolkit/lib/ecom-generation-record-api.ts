"use client";

export const ECOM_GENERATION_RECORD_MODULE = "ecom-generation-record";
export const ECOM_GENERATION_RECORD_LIBRARY_PATH = "/library/generation-records";

export type GenerationRecordsLibraryQuery = {
  projectId?: string;
  sourceModule?: string;
  /** 筛选视图顶栏「返回」目标（如爆款/复刻工作台） */
  returnTo?: string;
  projectTitle?: string;
};

export function buildGenerationRecordsLibraryPath(
  query?: GenerationRecordsLibraryQuery,
): string {
  const projectId = query?.projectId?.trim();
  if (!projectId) return ECOM_GENERATION_RECORD_LIBRARY_PATH;
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  const sourceModule = query?.sourceModule?.trim();
  if (sourceModule) params.set("sourceModule", sourceModule);
  const returnTo = query?.returnTo?.trim();
  if (returnTo) params.set("returnTo", returnTo);
  const projectTitle = query?.projectTitle?.trim();
  if (projectTitle) params.set("projectTitle", projectTitle);
  return `${ECOM_GENERATION_RECORD_LIBRARY_PATH}?${params.toString()}`;
}

export type EcomGenerationRecordMeta = {
  sourceModule?: string;
  sourceToolKey?: string;
  projectId?: string;
  sourceResultId?: string;
  versionKey?: string;
  modelKey?: string;
  panelIndex?: number;
};

export type EcomGenerationRecordItem = {
  id: string;
  module: string;
  kind: string;
  title: string | null;
  prompt: string | null;
  ossUrl: string;
  thumbnailUrl: string | null;
  meta: EcomGenerationRecordMeta | null;
  createdAt: string;
};

async function bookFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "请求失败");
  }
  return data;
}

export async function listGenerationRecords(opts?: {
  projectId?: string;
}): Promise<EcomGenerationRecordItem[]> {
  const projectId = opts?.projectId?.trim();
  const suffix = projectId
    ? `?projectId=${encodeURIComponent(projectId)}`
    : "";
  const data = await bookFetch(`api/sso/tools/ecom/generation-records${suffix}`);
  return (data.items as EcomGenerationRecordItem[]) ?? [];
}

export async function deleteGenerationRecord(id: string): Promise<void> {
  await bookFetch(`api/sso/tools/ecom/generation-records?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function backfillTodayTextTryonToTryonLibrary(): Promise<{
  saved: number;
  skippedExisting: number;
  resultsScanned: number;
}> {
  const data = await bookFetch("api/sso/tools/ecom/model-tryon/backfill-tryon-library", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return {
    saved: Number(data.saved ?? 0),
    skippedExisting: Number(data.skippedExisting ?? 0),
    resultsScanned: Number(data.resultsScanned ?? 0),
  };
}

const SOURCE_MODULE_LABELS: Record<string, string> = {
  "model-tryon": "模特试衣",
  "storyboard-micro-drama": "电商口播故事版",
  "seed-video": "种草视频",
  "model-shot": "模特大片",
  "outfit-video": "穿搭视频",
  "image-layer": "图片处理",
  "detail-page-suite": "详情页套图",
  "detail-page-suite-hit": "爆款详情页套图",
  "detail-page-suite-replica": "详情页套图复刻",
};

export function generationRecordSourceLabel(meta: EcomGenerationRecordMeta | null): string {
  const mod = meta?.sourceModule?.trim();
  if (mod && SOURCE_MODULE_LABELS[mod]) return SOURCE_MODULE_LABELS[mod];
  return mod ?? "生成";
}
