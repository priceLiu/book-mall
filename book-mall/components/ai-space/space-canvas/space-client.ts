"use client";

/** 画布编辑器 → Platform API 的薄封装（同域 NextAuth 会话） */

import type {
  AiSpaceBlockDto,
  AiSpaceBlockLayoutInput,
  AiSpaceBlockRefInput,
  AiSpacePageDto,
} from "@/lib/ai-space/ai-space-space-types";
import type { SpacePageTemplateKey } from "@/lib/ai-space/space-blocks/page-templates";
import type { SpacePageTheme } from "@/lib/ai-space/space-blocks/theme";

const BASE = "/api/platform/v1/ai-space";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "请求失败");
  }
  return json as T;
}

export async function fetchSpacePage(): Promise<AiSpacePageDto> {
  const { page } = await request<{ page: AiSpacePageDto }>(`${BASE}/page`);
  return page;
}

export async function patchSpacePage(patch: {
  title?: string;
  bio?: string;
  slug?: string;
  theme?: SpacePageTheme;
}): Promise<AiSpacePageDto> {
  const { page } = await request<{ page: AiSpacePageDto }>(`${BASE}/page`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return page;
}

export async function setSpacePublish(publish: boolean): Promise<AiSpacePageDto> {
  const { page } = await request<{ page: AiSpacePageDto }>(`${BASE}/page/publish`, {
    method: "POST",
    body: JSON.stringify({ publish }),
  });
  return page;
}

export async function applySpaceTemplateRequest(
  templateKey: SpacePageTemplateKey,
): Promise<AiSpacePageDto> {
  const { page } = await request<{ page: AiSpacePageDto }>(
    `${BASE}/page/apply-template`,
    { method: "POST", body: JSON.stringify({ templateKey }) },
  );
  return page;
}

export async function createSpaceBlockRequest(input: {
  blockType: string;
  sizeTier?: string;
  refs?: AiSpaceBlockRefInput[];
  config?: Record<string, unknown>;
  content?: { text: string };
}): Promise<AiSpaceBlockDto> {
  const { block } = await request<{ block: AiSpaceBlockDto }>(`${BASE}/blocks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return block;
}

export async function updateSpaceBlockRequest(input: {
  id: string;
  sizeTier?: string;
  config?: Record<string, unknown>;
  content?: { text: string };
  refs?: AiSpaceBlockRefInput[];
}): Promise<AiSpaceBlockDto> {
  const { block } = await request<{ block: AiSpaceBlockDto }>(`${BASE}/blocks`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return block;
}

export async function deleteSpaceBlockRequest(id: string): Promise<void> {
  await request(`${BASE}/blocks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function saveSpaceLayoutRequest(
  items: AiSpaceBlockLayoutInput[],
): Promise<void> {
  await request(`${BASE}/blocks/layout`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}
