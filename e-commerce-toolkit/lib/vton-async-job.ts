import { isEcomTransportDisconnectError } from "@/lib/vton-batch-tryon-run";

export const VTON_ASYNC_JOB_STALE_MS = 20 * 60 * 1000;

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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** 轮询项目直至异步任务结束（刷新后续跑） */
export async function waitForVtonJobPoll<T>(opts: {
  fetchProject: () => Promise<T>;
  isRunning: (project: T) => boolean;
  applyProject: (project: T) => void;
  signal?: AbortSignal;
  intervalMs?: number;
  maxWaitMs?: number;
}): Promise<T> {
  const intervalMs = opts.intervalMs ?? 1600;
  const maxWaitMs = opts.maxWaitMs ?? 600_000;
  const started = Date.now();
  let latest = await opts.fetchProject();
  opts.applyProject(latest);

  while (Date.now() - started < maxWaitMs) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    latest = await opts.fetchProject();
    opts.applyProject(latest);
    if (!opts.isRunning(latest)) return latest;
    await sleep(intervalMs, opts.signal);
  }

  throw new Error("生成等待超时，请刷新页面查看已生成结果");
}

export async function runVtonJobWithPoll<T>(opts: {
  startJob: () => Promise<T>;
  fetchProject: () => Promise<T>;
  isRunning: (project: T) => boolean;
  applyProject: (project: T) => void;
  signal?: AbortSignal;
}): Promise<{ project: T; postError: unknown | null }> {
  let postError: unknown | null = null;
  try {
    const started = await opts.startJob();
    opts.applyProject(started);
    if (!opts.isRunning(started)) {
      return { project: started, postError };
    }
  } catch (e) {
    if (!isEcomTransportDisconnectError(e)) throw e;
    postError = e;
  }

  const project = await waitForVtonJobPoll({
    fetchProject: opts.fetchProject,
    isRunning: opts.isRunning,
    applyProject: opts.applyProject,
    signal: opts.signal,
  });
  return { project, postError };
}
