import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

export function detailPageSuiteHitDecomposeTaskId(projectId: string): string {
  return `dps-hit-decompose-${projectId}`;
}

export const DETAIL_PAGE_SUITE_HIT_DECOMPOSE_EXPECTED_MS = 8 * 60 * 1000;

export function hitDecomposeFailMessage(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): string | null {
  if (meta?.hitStatus === "error") {
    return meta.hitError?.trim() || "拆解失败";
  }
  return null;
}

export function isHitDecomposeDone(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): boolean {
  return meta?.hitStatus === "decomposed" || meta?.hitStatus === "ready";
}
