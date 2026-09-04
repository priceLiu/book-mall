export type OutfitSplitProgress = {
  phase: "prepare" | "detect" | "cut" | "analyze" | "finalize";
  step?: number;
  totalSteps?: number;
  label: string;
  updatedAt: string;
};

export function parseOutfitSplitProgress(meta: unknown): OutfitSplitProgress | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>).splitProgress;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const phase = p.phase;
  const label = p.label;
  if (
    phase !== "prepare" &&
    phase !== "detect" &&
    phase !== "cut" &&
    phase !== "analyze" &&
    phase !== "finalize"
  ) {
    return null;
  }
  if (typeof label !== "string" || !label.trim()) return null;
  return {
    phase,
    label: label.trim(),
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
    step: typeof p.step === "number" ? p.step : undefined,
    totalSteps: typeof p.totalSteps === "number" ? p.totalSteps : undefined,
  };
}

export function isOutfitSplitInProgress(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const at = (meta as Record<string, unknown>).splitInProgressAt;
  if (typeof at !== "number" || !Number.isFinite(at)) return false;
  return Date.now() - at < 15 * 60_000;
}

export function outfitSplitTaskId(projectId: string): string {
  return `outfit-split-${projectId}`;
}

/** meta 锁有效且无分镜 → 拆镜进行中（刷新可恢复；不单独信 status=splitting） */
export function isOutfitSplitActive(
  project: { sceneList?: unknown[]; status?: string; meta?: unknown } | null,
): boolean {
  if (!project) return false;
  if ((project.sceneList?.length ?? 0) > 0) return false;
  return isOutfitSplitInProgress(project.meta);
}

export function outfitSplitProgressDetail(
  progress: OutfitSplitProgress | null,
  meta?: unknown,
): string {
  const tail =
    meta && typeof meta === "object"
      ? (meta as Record<string, unknown>).splitLlmStreamTail
      : undefined;
  const base = progress?.label ?? "正在解析参考视频并切分镜头，请稍候…";
  if (typeof tail === "string" && tail.trim()) {
    return `${base}\n\n${tail.trim().slice(-280)}`;
  }
  return base;
}

export function outfitSplitProgressBar(
  progress: OutfitSplitProgress | null,
): { current: number; total: number; label: string } | undefined {
  if (!progress?.step || !progress.totalSteps) return undefined;
  return {
    current: progress.step,
    total: progress.totalSteps,
    label: progress.phase === "cut" ? "切镜" : "进度",
  };
}

/** 拆镜阶段轨（与 book-mall splitProgressNow phase 一致） */
export const OUTFIT_SPLIT_PHASE_STEPS = [
  { phase: "prepare" as const, label: "准备" },
  { phase: "detect" as const, label: "检测切点" },
  { phase: "cut" as const, label: "切分镜头" },
  { phase: "analyze" as const, label: "视觉分析" },
  { phase: "finalize" as const, label: "写入分镜" },
];

export function outfitSplitPhaseIndex(
  phase: OutfitSplitProgress["phase"] | null | undefined,
): number {
  if (!phase) return 0;
  const idx = OUTFIT_SPLIT_PHASE_STEPS.findIndex((s) => s.phase === phase);
  return idx >= 0 ? idx : 0;
}

/** 主状态行（不含 LLM 流式 tail，避免刷屏） */
export function outfitSplitProgressHeadline(
  progress: OutfitSplitProgress | null,
): string {
  return progress?.label?.trim() || "正在解析参考视频并切分镜头，请稍候…";
}
