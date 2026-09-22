import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import { hitDecomposeFailMessage } from "@/lib/detail-page-suite-hit-decompose-job";
import { hitJobProgressPercent, isHitDecomposeInFlight } from "@/lib/detail-page-suite-hit-progress";

export function detailPageSuiteHitRewriteTaskId(projectId: string): string {
  return `dps-hit-rewrite-${projectId}`;
}

export const DETAIL_PAGE_SUITE_HIT_REWRITE_EXPECTED_MS = 10 * 60 * 1000;

/** 客户端 POST 超时/断连时，任务可能已在 book-mall 后台继续 */
export function isLikelyHitJobTransportError(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : String(e);
  return /terminated|ECONNRESET|aborted|timeout|failCode|socket hang up|UND_ERR|fetch failed|upstream_fetch_failed|failed to fetch|连接中断|operation was aborted/i.test(
    raw,
  );
}

export function hitRewriteFailMessage(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): string | null {
  if (meta?.hitStatus === "polishing") return null;
  if (meta?.hitStatus === "ready") return null;
  if (meta?.hitStatus === "decomposed" && meta.hitError?.trim()) {
    return meta.hitError.trim();
  }
  if (meta?.hitStatus === "error") {
    return meta.hitError?.trim() || "生成失败";
  }
  return null;
}

export function isHitRewriteDone(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): boolean {
  return meta?.hitStatus === "ready";
}

export function hitBackgroundPollProgress(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): number | undefined {
  const p = hitJobProgressPercent(meta ?? null);
  if (p == null) return undefined;
  return p / 100;
}

export function isHitBackgroundJobInFlight(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): boolean {
  return isHitDecomposeInFlight(meta ?? null);
}
