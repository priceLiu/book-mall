import { dispatchQueuedCanvasTasks } from "./dispatch-canvas";
import { dispatchQueuedStoryTasks } from "./dispatch-story";

let globalDispatchInFlight = false;
let lastGlobalDispatchAt = 0;
/** 读路径 / 槽位释放触发的全局出队：防抖，避免 canvas-queue 轮询打满 DB */
const GLOBAL_DISPATCH_MIN_GAP_MS = 2_000;

const projectDispatchInFlight = new Set<string>();

type DispatchRunOpts = {
  projectId?: string;
  fastPath?: boolean;
  /** 自愈重派等路径：跳过 debounce / 全局 in-flight 门闩 */
  bypassDebounce?: boolean;
};

function runDispatch(source: string, opts?: DispatchRunOpts): void {
  const fastPath = opts?.fastPath ?? true;
  const projectId = opts?.projectId;
  if (projectId) {
    if (projectDispatchInFlight.has(projectId)) return;
    projectDispatchInFlight.add(projectId);
  }

  void Promise.all([
    dispatchQueuedCanvasTasks({ projectId, fastPath }),
    dispatchQueuedStoryTasks(projectId ? { projectId } : undefined),
  ])
    .then(([canvas, story]) => {
      const noisy =
        canvas.dispatched > 0 ||
        canvas.failed > 0 ||
        canvas.skipped > 0 ||
        story.dispatched > 0 ||
        story.failed > 0 ||
        process.env.CANVAS_DISPATCH_LOG === "1" ||
        process.env.NODE_ENV === "development";
      if (noisy) {
        console.info(`[canvas-dispatch] ${source}`, { canvas, story });
      }
    })
    .catch((e) => {
      console.warn(
        `[canvas-dispatch] ${source} skipped:`,
        e instanceof Error ? e.message : String(e),
      );
    })
    .finally(() => {
      if (projectId) projectDispatchInFlight.delete(projectId);
    });
}

/** 画布 run 后触发 dispatch；可观测，不再静默吞错。
 *
 * `fastPath` 默认 true：run API 的即时派发热路径跳过兜底清扫，尽快把刚建的 QUEUED
 * 任务提交到厂商，缩短「出队前」。轮询 worker 调用时应传 `fastPath: false` 以保留清扫。 */
export function fireCanvasDispatchForProject(
  projectId: string,
  source: string,
  opts?: { fastPath?: boolean; bypassDebounce?: boolean },
): void {
  runDispatch(source, { projectId, fastPath: opts?.fastPath });
}

/**
 * 全局推进 QUEUED backlog（Canvas + Story，不限 projectId）。
 * - Gateway 视频槽释放后立即调用，让下一批排队任务马上出队，不必等 poll-loop。
 * - Logs 页 canvas-queue 轮询发现仍有排队时 debounce 触发。
 */
export function fireVideoTrafficDispatchBacklog(
  source: string,
  opts?: { fastPath?: boolean; bypassDebounce?: boolean },
): void {
  const now = Date.now();
  if (
    !opts?.bypassDebounce &&
    (globalDispatchInFlight || now - lastGlobalDispatchAt < GLOBAL_DISPATCH_MIN_GAP_MS)
  ) {
    return;
  }
  globalDispatchInFlight = true;
  lastGlobalDispatchAt = now;
  const fastPath = opts?.fastPath ?? true;
  void Promise.all([
    dispatchQueuedCanvasTasks({ fastPath }),
    dispatchQueuedStoryTasks(),
  ])
    .then(([canvas, story]) => {
      const r = {
        canvas,
        story,
        dispatched: canvas.dispatched + story.dispatched,
        failed: canvas.failed + story.failed,
      };
      const noisy =
        r.dispatched > 0 ||
        r.failed > 0 ||
        process.env.CANVAS_DISPATCH_LOG === "1" ||
        process.env.NODE_ENV === "development";
      if (noisy) {
        console.info(`[video-traffic-dispatch] ${source}`, r);
      }
    })
    .catch((e) => {
      console.warn(
        `[video-traffic-dispatch] ${source} skipped:`,
        e instanceof Error ? e.message : String(e),
      );
    })
    .finally(() => {
      globalDispatchInFlight = false;
    });
}

/** @deprecated 使用 fireVideoTrafficDispatchBacklog */
export function fireCanvasDispatchQueuedBacklog(
  source: string,
  opts?: { fastPath?: boolean; bypassDebounce?: boolean },
): void {
  fireVideoTrafficDispatchBacklog(source, opts);
}
