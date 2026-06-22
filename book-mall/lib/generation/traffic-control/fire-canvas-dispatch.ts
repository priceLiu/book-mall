import { dispatchQueuedCanvasTasks } from "./dispatch-canvas";

/** 画布 run 后触发 dispatch；可观测，不再静默吞错。 */
export function fireCanvasDispatchForProject(projectId: string, source: string): void {
  void dispatchQueuedCanvasTasks({ projectId })
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
