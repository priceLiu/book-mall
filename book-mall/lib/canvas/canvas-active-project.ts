/**
 * 画布页当前打开的项目（tasks / task-sync 读路径 touch）。
 * 用于活跃项目 opportunistic poll 加速（默认 3s vs 8s）。
 */

const ACTIVE_TTL_MS = 2 * 60 * 1000;
const lastSeenByProject = new Map<string, number>();

export function touchCanvasActiveProject(projectId: string, now = Date.now()): void {
  lastSeenByProject.set(projectId, now);
}

export function isCanvasActiveProject(
  projectId: string,
  now = Date.now(),
): boolean {
  const last = lastSeenByProject.get(projectId);
  if (!last) return false;
  if (now - last > ACTIVE_TTL_MS) {
    lastSeenByProject.delete(projectId);
    return false;
  }
  return true;
}

export const CANVAS_ACTIVE_OPPORTUNISTIC_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_ACTIVE_OPPORTUNISTIC_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 1000 ? raw : 3000;
})();

export const CANVAS_IDLE_OPPORTUNISTIC_POLL_MS = (() => {
  const raw = Number(process.env.CANVAS_IDLE_OPPORTUNISTIC_POLL_MS ?? "");
  return Number.isFinite(raw) && raw >= 1000 ? raw : 8000;
})();

export function resolveOpportunisticPollMinGapMs(projectId: string): number {
  return isCanvasActiveProject(projectId)
    ? CANVAS_ACTIVE_OPPORTUNISTIC_POLL_MS
    : CANVAS_IDLE_OPPORTUNISTIC_POLL_MS;
}
