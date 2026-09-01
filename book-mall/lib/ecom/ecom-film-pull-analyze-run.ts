/** 专业拉片 · 进程内 analyze 单飞 + AbortController（中止时取消在途 Gateway HTTP） */

type ActiveRun = {
  runId: string;
  controller: AbortController;
};

const runs = new Map<string, ActiveRun>();

function runKey(userId: string, projectId: string): string {
  return `${userId}:${projectId}`;
}

export function registerFilmPullAnalyzeRun(
  userId: string,
  projectId: string,
  runId: string,
): AbortSignal {
  const k = runKey(userId, projectId);
  if (runs.has(k)) {
    throw new Error("拉片进行中，请等待完成或先中止");
  }
  const controller = new AbortController();
  runs.set(k, { runId, controller });
  return controller.signal;
}

export function abortFilmPullAnalyzeRun(
  userId: string,
  projectId: string,
): boolean {
  const k = runKey(userId, projectId);
  const run = runs.get(k);
  if (!run) return false;
  run.controller.abort();
  runs.delete(k);
  return true;
}

export function releaseFilmPullAnalyzeRun(
  userId: string,
  projectId: string,
  runId: string,
): void {
  const k = runKey(userId, projectId);
  const run = runs.get(k);
  if (run?.runId === runId) {
    runs.delete(k);
  }
}

export function isFilmPullAnalyzeRunAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}
