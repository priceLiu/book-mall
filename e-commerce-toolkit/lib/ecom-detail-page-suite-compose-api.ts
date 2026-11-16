"use client";

import type { DetailPageSuiteCopyOverlay } from "@/lib/detail-page-suite-copy-overlay";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type DetailPageSuiteProjectModuleKey =
  | "ai-detail-page"
  | "detail-page-suite"
  | "detail-page-suite-replica"
  | "detail-page-suite-hit";

const COMPOSE_BASE: Record<DetailPageSuiteProjectModuleKey, string> = {
  "ai-detail-page": "api/sso/tools/ecom/ai-detail-page",
  "detail-page-suite": "api/sso/tools/ecom/detail-page-suite",
  "detail-page-suite-replica": "api/sso/tools/ecom/detail-page-suite-replica",
  "detail-page-suite-hit": "api/sso/tools/ecom/detail-page-suite-hit",
};

export async function composeDetailPageSuiteSlot(
  projectModule: DetailPageSuiteProjectModuleKey,
  projectId: string,
  body: {
    moduleId: string;
    slotKey: string;
    baseImageUrl: string;
    overlay: DetailPageSuiteCopyOverlay;
    slotCopy?: string;
  },
) {
  const base = COMPOSE_BASE[projectModule];
  const data = await ecomBookFetch(`${base}/projects/${projectId}/compose-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data as { url: string; project: DetailPageSuiteProject };
}