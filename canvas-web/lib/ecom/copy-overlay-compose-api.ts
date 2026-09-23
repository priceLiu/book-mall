"use client";

import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";

async function bookFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "请求失败");
  }
  return data;
}

/** 画布 / 工具站共用：底图 + 排版 JSON → OSS PNG */
export async function composeEcomCopyOverlayViaBook(body: {
  baseImageUrl: string;
  overlay: EcomCopyOverlay;
  syncText?: string;
  exportWidthPx?: number;
}): Promise<{ url: string; overlay: EcomCopyOverlay }> {
  return bookFetch("api/sso/tools/ecom/copy-overlay/compose", {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<{ url: string; overlay: EcomCopyOverlay }>;
}
