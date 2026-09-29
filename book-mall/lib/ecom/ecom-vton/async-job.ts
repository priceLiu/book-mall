import type {
  VtonAsyncJobStatus,
  VtonModelPipelineJob,
  VtonModelPipelineJobKind,
  VtonTextTryonJob,
} from "@/lib/ecom/ecom-vton/types";

/** 超过此时长仍为 running，视为进程中断，允许重新发起 */
export const VTON_ASYNC_JOB_STALE_MS = 20 * 60 * 1000;

export function vtonAsyncJobNow(): string {
  return new Date().toISOString();
}

export function isVtonAsyncJobRunning(
  job: { status?: string; startedAt?: string } | null | undefined,
  nowMs = Date.now(),
  staleMs = VTON_ASYNC_JOB_STALE_MS,
): boolean {
  if (!job || job.status !== "running") return false;
  const started = typeof job.startedAt === "string" ? Date.parse(job.startedAt) : Number.NaN;
  if (!Number.isFinite(started)) return false;
  return nowMs - started < staleMs;
}

function parseJobStatus(raw: unknown): VtonAsyncJobStatus | null {
  return raw === "running" || raw === "done" || raw === "failed" ? raw : null;
}

export function sanitizeVtonTextTryonJob(raw: unknown): VtonTextTryonJob | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const jobId = typeof o.jobId === "string" ? o.jobId.trim() : "";
  const status = parseJobStatus(o.status);
  const startedAt = typeof o.startedAt === "string" ? o.startedAt : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : startedAt;
  const prompt = typeof o.prompt === "string" ? o.prompt : "";
  const modelKey = typeof o.modelKey === "string" ? o.modelKey.trim() : "";
  if (!jobId || !status || !startedAt || !modelKey) return undefined;
  return {
    jobId,
    status,
    startedAt,
    updatedAt: updatedAt || startedAt,
    prompt,
    modelKey,
    ...(typeof o.imageSize === "string" && o.imageSize.trim()
      ? { imageSize: o.imageSize.trim() }
      : {}),
    ...(typeof o.error === "string" && o.error.trim() ? { error: o.error.trim() } : {}),
  };
}

export function sanitizeVtonModelPipelineJob(raw: unknown): VtonModelPipelineJob | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const jobId = typeof o.jobId === "string" ? o.jobId.trim() : "";
  const status = parseJobStatus(o.status);
  const kind: VtonModelPipelineJobKind | null =
    o.kind === "generating-model" || o.kind === "expanding-full-body" ? o.kind : null;
  const startedAt = typeof o.startedAt === "string" ? o.startedAt : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : startedAt;
  if (!jobId || !status || !kind || !startedAt) return undefined;
  return {
    jobId,
    status,
    kind,
    startedAt,
    updatedAt: updatedAt || startedAt,
    ...(typeof o.prompt === "string" ? { prompt: o.prompt } : {}),
    ...(typeof o.imageSize === "string" && o.imageSize.trim()
      ? { imageSize: o.imageSize.trim() }
      : {}),
    ...(typeof o.error === "string" && o.error.trim() ? { error: o.error.trim() } : {}),
  };
}

export function enqueueDetached(label: string, work: () => Promise<void>): void {
  setImmediate(() => {
    void work().catch((e) => {
      console.error(`[${label}]`, e);
    });
  });
}
