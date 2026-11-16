"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { DetailPageSuiteCopyOverlay } from "@/lib/detail-page-suite-copy-overlay";

/** 通用烧字合成（详情页 / 主图 / 海报共用） */
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