import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

export type VisionSellpointJobMeta = {
  status?: "idle" | "running" | "done" | "error";
  progress?: {
    percent: number;
    title: string;
    detail?: string;
    updatedAt?: string;
  };
  error?: string;
};

export function readHitVisionSellpointJob(
  meta: DetailPageSuiteProject["meta"],
): VisionSellpointJobMeta | undefined {
  return meta?.hitVisionSellpoint as VisionSellpointJobMeta | undefined;
}

export function readReplicaVisionSellpointJob(
  meta: DetailPageSuiteProject["meta"],
): VisionSellpointJobMeta | undefined {
  return meta?.replicaVisionSellpoint as VisionSellpointJobMeta | undefined;
}

export function isVisionSellpointJobRunning(job: VisionSellpointJobMeta | undefined): boolean {
  return job?.status === "running";
}

export function visionSellpointProgressLabel(job: VisionSellpointJobMeta | undefined): string {
  if (!job?.progress) return "AI 识图中…";
  const parts = [job.progress.title, job.progress.detail].map((s) => s?.trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : "AI 识图中…";
}

export function visionSellpointProgressPercent(
  job: VisionSellpointJobMeta | undefined,
): number | null {
  if (typeof job?.progress?.percent === "number") return job.progress.percent;
  return null;
}
