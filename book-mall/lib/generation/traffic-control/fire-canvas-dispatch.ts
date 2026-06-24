import { dispatchQueuedCanvasTasks } from "./dispatch-canvas";

/** 画布 run 后触发 dispatch；可观测，不再静默吞错。
 *
 * `fastPath` 默认 true：run API 的即时派发热路径跳过兜底清扫，尽快把刚建的 QUEUED
 * 任务提交到厂商，缩短「出队前」。轮询 worker 调用时应传 `fastPath: false` 以保留清扫。 */
export function fireCanvasDispatchForProject(
  projectId: string,
  source: string,
  opts?: { fastPath?: boolean },
): void {
  const fastPath = opts?.fastPath ?? true;
  void dispatchQueuedCanvasTasks({ projectId, fastPath })
    .then((r) => {
      const noisy =
        r.dispatched > 0 ||
        r.failed > 0 ||
        process.env.CANVAS_DISPATCH_LOG === "1" ||
        process.env.NODE_ENV === "development";
      if (noisy) {
        console.info(`[canvas-dispatch] ${source}`, r);
      }
    })
    .catch((e) => {
      console.warn(
        `[canvas-dispatch] ${source} skipped:`,
        e instanceof Error ? e.message : String(e),
      );
    });
}
