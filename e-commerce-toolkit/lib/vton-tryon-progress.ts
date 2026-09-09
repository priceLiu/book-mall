export type VtonTryonProgressPhase = "submitting" | "polling" | "persisting" | "done" | "failed";

export type VtonTryonProgress = {
  phase: VtonTryonProgressPhase;
  label: string;
  pollCount?: number;
  updatedAt: string;
};

export const VTon_TRYON_PHASE_STEPS: Array<{ phase: VtonTryonProgressPhase; label: string }> = [
  { phase: "submitting", label: "提交" },
  { phase: "polling", label: "生成" },
  { phase: "persisting", label: "转存" },
  { phase: "done", label: "完成" },
];

export function parseVtonTryonProgress(raw: unknown): VtonTryonProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const phase = o.phase;
  if (
    phase !== "submitting" &&
    phase !== "polling" &&
    phase !== "persisting" &&
    phase !== "done" &&
    phase !== "failed"
  ) {
    return null;
  }
  const label = typeof o.label === "string" ? o.label : "";
  const pollCount = typeof o.pollCount === "number" ? o.pollCount : undefined;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();
  return { phase, label, pollCount, updatedAt };
}

export function vtonTryonPhaseIndex(phase?: VtonTryonProgressPhase): number {
  if (!phase) return 0;
  const idx = VTon_TRYON_PHASE_STEPS.findIndex((s) => s.phase === phase);
  if (idx >= 0) return idx;
  if (phase === "failed") return VTon_TRYON_PHASE_STEPS.length;
  return 0;
}

export function vtonTryonProgressHeadline(progress: VtonTryonProgress | null): string {
  if (!progress) return "准备 AI 试衣…";
  if (progress.label.trim()) return progress.label;
  const step = VTon_TRYON_PHASE_STEPS.find((s) => s.phase === progress.phase);
  return step?.label ?? "AI 试衣中…";
}

type BatchLabelInput = {
  status: string;
  currentIndex: number;
  total: number;
  label?: string;
  updatedAt?: string;
};

/** 批量试衣结果区 / 步骤条：按套次序号展示，忽略单套「提交 AI 试衣任务…」 */
export function formatVtonBatchTryonLabel(batch: BatchLabelInput): string {
  if (batch.status === "running") {
    const custom = batch.label?.trim();
    if (
      custom &&
      custom !== "准备批量试衣…" &&
      custom !== "排队中…" &&
      /^试衣中 \d+\/\d+/.test(custom)
    ) {
      return custom;
    }
    if (batch.currentIndex > 0) {
      return `试衣中 ${batch.currentIndex}/${batch.total}…`;
    }
    return custom || "排队中…";
  }
  if (batch.label?.trim()) return batch.label.trim();
  if (batch.status === "cancelled") return "已停止批量试衣";
  if (batch.status === "done") return "批量试衣完成";
  return "批量试衣结束";
}

/** 轮询 meta 时合并 batch 与 tryonProgress，修正历史脏 label */
export function mergeVtonTryonProgressWithBatch(
  progress: VtonTryonProgress | null,
  batch: BatchLabelInput | null | undefined,
): VtonTryonProgress | null {
  if (!batch || batch.status !== "running") return progress;
  const label = formatVtonBatchTryonLabel(batch);
  const phase =
    progress?.phase === "submitting" && batch.currentIndex > 0 ? "polling" : progress?.phase ?? "polling";
  return {
    phase,
    label,
    pollCount: progress?.pollCount,
    updatedAt: batch.updatedAt ?? progress?.updatedAt ?? new Date().toISOString(),
  };
}
