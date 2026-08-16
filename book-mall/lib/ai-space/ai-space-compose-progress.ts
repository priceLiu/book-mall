/** 合成台 · 分步进度（客户端可安全引用） */

export type ComposeProgressStepStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

export type ComposeProgressStep = {
  id: string;
  label: string;
  status: ComposeProgressStepStatus;
  detail?: string | null;
  /** 0–100，仅 running 步可能有子进度 */
  progress?: number | null;
};

export type ComposeProgressInput = {
  status: string;
  videoMaterialId: string | null;
  gatewayTaskId: string | null;
  tempHumanVideoUrl: string | null;
  finalVideoUrl: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
  mediaRenderJob?: {
    status: string;
    progress: number;
    progressLabel: string | null;
  } | null;
};

const STEP_DEFS = [
  { id: "queue", label: "排队等待口播槽位" },
  { id: "s2v_submit", label: "提交对口型任务" },
  { id: "s2v_vendor", label: "厂商生成口播" },
  { id: "s2v_persist", label: "转存口播视频" },
  { id: "composite", label: "画中画合成" },
  { id: "save", label: "写入视频创作库" },
  { id: "done", label: "完成" },
] as const;

function formatWaitMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} 秒`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分钟`;
}

function compositeLabel(hasBackground: boolean): string {
  return hasBackground ? "画中画合成" : "封装导出";
}

function resolveStepIndex(input: ComposeProgressInput): number {
  const { status } = input;
  if (status === "failed") {
    if (input.finalVideoUrl || input.tempHumanVideoUrl) {
      if (input.mediaRenderJob?.status === "FAILED") return 4;
      return 3;
    }
    if (input.gatewayTaskId) return 2;
    if (status === "failed") return 1;
    return 0;
  }
  if (status === "completed") return 6;
  if (status === "composing") {
    const job = input.mediaRenderJob;
    if (job && job.progress >= 90) return 5;
    return 4;
  }
  if (status === "generating_human") {
    if (input.gatewayTaskId) return 2;
    return 1;
  }
  if (status === "pending") return 0;
  return 0;
}

function failedStepIndex(input: ComposeProgressInput): number {
  if (input.mediaRenderJob?.status === "FAILED") return 4;
  if (input.tempHumanVideoUrl && statusIsComposingOrAfter(input)) return 4;
  if (input.gatewayTaskId) return 2;
  return 1;
}

function statusIsComposingOrAfter(input: ComposeProgressInput): boolean {
  return input.status === "composing" || input.status === "completed";
}

export function buildComposeProgressSteps(
  input: ComposeProgressInput,
): ComposeProgressStep[] {
  const hasBackground = Boolean(input.videoMaterialId);
  const createdAt =
    input.createdAt instanceof Date
      ? input.createdAt
      : new Date(input.createdAt);
  const waitMs = Date.now() - createdAt.getTime();
  const activeIdx =
    input.status === "failed"
      ? failedStepIndex(input)
      : resolveStepIndex(input);

  const steps: ComposeProgressStep[] = STEP_DEFS.map((def, idx) => {
    let label: string = def.label;
    if (def.id === "composite") label = compositeLabel(hasBackground);

    let status: ComposeProgressStepStatus = "pending";
    let detail: string | null = null;
    let progress: number | null = null;

    if (input.status === "failed" && idx === activeIdx) {
      status = "failed";
      detail = input.errorMessage;
    } else if (idx < activeIdx) {
      status = "done";
    } else if (idx === activeIdx && input.status !== "completed") {
      status = "running";
      if (def.id === "queue") {
        detail = `已等待 ${formatWaitMs(waitMs)}（厂商同时只处理 1 条）`;
        progress = 10;
      } else if (def.id === "s2v_submit") {
        detail = "正在向 Gateway 提交 wan2.2-s2v 任务";
        progress = 20;
      } else if (def.id === "s2v_vendor") {
        detail = input.gatewayTaskId
          ? `厂商任务 ${input.gatewayTaskId.slice(0, 8)}… · 已等待 ${formatWaitMs(waitMs)}`
          : `已等待 ${formatWaitMs(waitMs)}`;
        progress = 35;
      } else if (def.id === "s2v_persist") {
        detail = "口播视频转存 OSS";
        progress = 55;
      } else if (def.id === "composite") {
        const job = input.mediaRenderJob;
        detail = job?.progressLabel ?? (hasBackground ? "叠加背景与小窗" : "封装成片");
        progress = job?.progress ?? 70;
      } else if (def.id === "save") {
        detail = "写入视频创作库";
        progress = 95;
      }
    } else if (idx === activeIdx && input.status === "completed") {
      status = "done";
    }

    if (
      def.id === "composite" &&
      !hasBackground &&
      idx > activeIdx &&
      input.status !== "failed"
    ) {
      // 无背景仍走 composite 路径，不 skip
    }

    return { id: def.id, label, status, detail, progress };
  });

  if (input.status === "completed") {
    for (const s of steps) s.status = "done";
  }

  return steps;
}

export function computeComposeProgressPercent(
  steps: ComposeProgressStep[],
): number {
  const weights = [5, 10, 35, 5, 35, 8, 2];
  let total = 0;
  let weightSum = 0;
  steps.forEach((step, i) => {
    const w = weights[i] ?? 0;
    weightSum += w;
    if (step.status === "done") total += w;
    else if (step.status === "running") {
      const inner = (step.progress ?? 50) / 100;
      total += w * inner;
    } else if (step.status === "failed") {
      total += w * 0.3;
    }
  });
  return weightSum > 0 ? Math.min(100, Math.round((total / weightSum) * 100)) : 0;
}

export function currentComposeStepId(steps: ComposeProgressStep[]): string {
  const running = steps.find((s) => s.status === "running");
  if (running) return running.id;
  const failed = steps.find((s) => s.status === "failed");
  if (failed) return failed.id;
  return "done";
}
