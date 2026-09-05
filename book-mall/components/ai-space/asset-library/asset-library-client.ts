"use client";

/**
 * 全局资产库 · 客户端读写
 *
 * 聚合读走 `/api/platform/v1/ai-space/assets`（不要求已收进空间），
 * 收进 / 移出空间仍复用既有 `pins` 路由，不新造第二套写入口。
 */

import type {
  AiSpaceLibraryAsset,
  AiSpaceLibraryPage,
} from "@/lib/ai-space/ai-space-asset-library";
import type {
  AiSpacePinMediaKind,
  AiSpacePinSourceType,
} from "@/lib/ai-space/ai-space-pin-types";

const ASSETS_API = "/api/platform/v1/ai-space/assets";
const PINS_API = "/api/platform/v1/ai-space/pins";

export type AiSpaceLibrarySourceOption = {
  sourceType: AiSpacePinSourceType;
  label: string;
  app: string;
  kinds: AiSpacePinMediaKind[];
};

export type AiSpaceLibraryFilters = {
  kind: AiSpacePinMediaKind | "all";
  sources: AiSpacePinSourceType[];
  keyword: string;
};

export type AiSpaceLibraryResponse = AiSpaceLibraryPage & {
  sourceOptions: AiSpaceLibrarySourceOption[];
};

async function readError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error ?? fallback);
}

export async function fetchLibraryAssets(
  filters: AiSpaceLibraryFilters,
  signal?: AbortSignal,
): Promise<AiSpaceLibraryResponse> {
  const params = new URLSearchParams();
  if (filters.kind !== "all") params.set("kind", filters.kind);
  for (const s of filters.sources) params.append("source", s);
  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());

  const res = await fetch(`${ASSETS_API}?${params.toString()}`, {
    credentials: "include",
    signal,
  });
  if (!res.ok) await readError(res, "读取资产库失败");
  return (await res.json()) as AiSpaceLibraryResponse;
}

/** 收进空间：返回新建的 pinId */
export async function pinLibraryAsset(
  asset: AiSpaceLibraryAsset,
): Promise<string | null> {
  const res = await fetch(PINS_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceType: asset.sourceType,
      sourceId: asset.sourceId,
      sourceApp: asset.sourceApp,
    }),
  });
  if (!res.ok) await readError(res, "收进空间失败");
  const data = (await res.json()) as { pinId?: string };
  return data.pinId ?? null;
}

export async function unpinLibraryAsset(pinId: string): Promise<void> {
  const res = await fetch(`${PINS_API}?pinId=${encodeURIComponent(pinId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await readError(res, "移出空间失败");
}
