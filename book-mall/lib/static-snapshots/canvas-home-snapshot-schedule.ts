/** 门户发布/审核后异步再生 canvas-home 快照（不阻塞 API；dynamic import 避免与 build 路径循环依赖） */
export function scheduleCanvasHomeSnapshotRegeneration(input?: {
  triggeredByUserId?: string | null;
}) {
  void import("@/lib/static-snapshots/canvas-home-snapshot-service")
    .then(({ runCanvasHomeSnapshotGeneration }) =>
      runCanvasHomeSnapshotGeneration({
        trigger: "ADMIN",
        triggeredByUserId: input?.triggeredByUserId ?? null,
      }),
    )
    .catch((e) => {
      console.error(
        "[canvas-home-snapshot] admin regen failed:",
        e instanceof Error ? e.message : e,
      );
    });
}
