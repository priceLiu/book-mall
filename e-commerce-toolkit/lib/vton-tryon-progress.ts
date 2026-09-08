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
