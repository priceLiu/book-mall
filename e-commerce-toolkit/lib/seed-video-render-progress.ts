export type SeedVideoRenderProgressPhase =
  | "queued"
  | "running"
  | "upload"
  | "done"
  | "failed";

export type SeedVideoRenderProgressState = {
  panelOpen: boolean;
  collapsed: boolean;
  jobId: string;
  progress: number;
  progressLabel: string;
  stepLog: string[];
  startedAt: number;
  phase: SeedVideoRenderProgressPhase;
};

export function appendSeedVideoRenderStepLog(prev: string[], label: string): string[] {
  const text = label.trim();
  if (!text) return prev;
  if (prev[prev.length - 1] === text) return prev;
  return [...prev, text].slice(-14);
}

export function resolveSeedVideoRenderPhase(
  status: string,
  progress: number,
): SeedVideoRenderProgressPhase {
  const s = status.toUpperCase();
  if (s === "SUCCEEDED" || s === "DONE") return "done";
  if (s === "FAILED" || s === "EXPIRED") return "failed";
  if (s === "PENDING" || s === "QUEUED" || s === "IDLE") return "queued";
  if (progress >= 90) return "upload";
  return "running";
}

export function seedVideoRenderPhaseTitle(phase: SeedVideoRenderProgressPhase): string {
  switch (phase) {
    case "queued":
      return "排队等待";
    case "running":
      return "剪辑合成中";
    case "upload":
      return "上传成片";
    case "done":
      return "合成完成";
    case "failed":
      return "合成失败";
  }
}

export function formatSeedVideoRenderElapsed(startedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}
