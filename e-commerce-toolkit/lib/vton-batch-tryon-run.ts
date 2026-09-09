import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import type { VtonTryonBatchState } from "@/lib/vton-types";

export function isEcomTransportDisconnectError(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : String(e);
  return /连接中断|fetch failed|terminated|ECONNRESET|aborted|socket hang up|UND_ERR|upstream_fetch_failed|failed to fetch/i.test(
    raw,
  );
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

function isNewBatch(
  batch: VtonTryonBatchState | null | undefined,
  initialBatchId: string | undefined,
): boolean {
  return Boolean(batch?.batchId && batch.batchId !== initialBatchId);
}

/** 等待「新一批」试衣结束（忽略上一轮已完成的 batch） */
export async function waitForVtonBatchPoll<T>(opts: {
  fetchProject: () => Promise<T>;
  readBatch: (project: T) => VtonTryonBatchState | null | undefined;
  applyProject: (project: T) => void;
  initialBatchId?: string;
  signal?: AbortSignal;
  intervalMs?: number;
  maxWaitMs?: number;
}): Promise<T> {
  const intervalMs = opts.intervalMs ?? 1200;
  const maxWaitMs = opts.maxWaitMs ?? 600_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const latest = await opts.fetchProject();
    opts.applyProject(latest);
    const batch = opts.readBatch(latest);

    if (isNewBatch(batch, opts.initialBatchId) && batch?.status !== "running") {
      return latest;
    }

    await sleep(intervalMs, opts.signal);
  }

  throw new Error("批量试衣等待超时，请刷新页面查看已生成部分");
}

/** 发起批量试衣 POST（可能因长连接超时断开），轮询项目直至 batch 结束 */
export async function runVtonBatchTryonWithPoll<T>(opts: {
  startBatch: (signal: AbortSignal) => Promise<T | null>;
  fetchProject: () => Promise<T>;
  readBatch: (project: T) => VtonTryonBatchState | null | undefined;
  applyProject: (project: T) => void;
  signal?: AbortSignal;
}): Promise<{ project: T; postError: unknown | null }> {
  const ac = new AbortController();
  const relayAbort = () => ac.abort();
  opts.signal?.addEventListener("abort", relayAbort, { once: true });

  let latest: T = await opts.fetchProject();
  opts.applyProject(latest);
  const initialBatchId = opts.readBatch(latest)?.batchId;

  let postError: unknown | null = null;
  let postSettled = false;
  const postPromise = opts
    .startBatch(ac.signal)
    .then((project) => {
      if (project) {
        latest = project;
        opts.applyProject(project);
      }
      return project;
    })
    .catch((e) => {
      postError = e;
      return null;
    })
    .finally(() => {
      postSettled = true;
    });

  const bootWaitMs = 25_000;
  const bootStarted = Date.now();
  while (Date.now() - bootStarted < bootWaitMs) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    latest = await opts.fetchProject();
    opts.applyProject(latest);
    const batch = opts.readBatch(latest);

    if (isNewBatch(batch, initialBatchId)) {
      if (batch?.status !== "running") {
        await postPromise.catch(() => null);
        return { project: latest, postError };
      }
      break;
    }

    if (postSettled && postError && !isEcomTransportDisconnectError(postError)) {
      await postPromise.catch(() => null);
      throw postError;
    }

    await sleep(400, opts.signal);
  }

  try {
    const project = await waitForVtonBatchPoll({
      fetchProject: opts.fetchProject,
      readBatch: opts.readBatch,
      applyProject: opts.applyProject,
      initialBatchId,
      signal: opts.signal,
    });
    await postPromise.catch(() => null);
    return { project, postError };
  } catch (e) {
    await postPromise.catch(() => null);
    throw e;
  } finally {
    opts.signal?.removeEventListener("abort", relayAbort);
  }
}

export function vtonBatchTryonFailureMessage(postError: unknown | null, batchLabel?: string): string {
  if (batchLabel?.trim()) return batchLabel.trim();
  if (postError) return formatEcomTransportError(postError);
  return "批量试衣失败";
}
