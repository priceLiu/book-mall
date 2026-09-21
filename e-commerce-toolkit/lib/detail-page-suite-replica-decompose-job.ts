import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

/** 详情页套图复刻 · 后台拆解 Dock 任务 id */
export function detailPageSuiteReplicaDecomposeTaskId(projectId: string): string {
  return `dps-replica-decompose-${projectId}`;
}

export const DETAIL_PAGE_SUITE_REPLICA_DECOMPOSE_EXPECTED_MS = 15 * 60 * 1000;

export function replicaDecomposeFailMessage(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): string | null {
  if (meta?.replicaStatus === "error") {
    return meta.replicaError?.trim() || "拆解失败";
  }
  return null;
}

export function isReplicaDecomposeDone(
  meta: DetailPageSuiteProject["meta"] | null | undefined,
): boolean {
  return meta?.replicaStatus === "decomposed";
}
