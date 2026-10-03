import type { RegisterBackgroundGenerationTaskInput } from "@/lib/generation/background-generation-types";

type BackgroundGen = {
  registerTask: (input: RegisterBackgroundGenerationTaskInput) => void;
};

type TaskPhase = "running" | "ok" | "fail";

/**
 * 登记右下角 Dock，并在同一 Promise 内执行耗时海报 API（生成/批量）。
 */
export function runPosterWithBackgroundTask<T>(
  backgroundGen: BackgroundGen | null,
  opts: {
    taskId: string;
    label: string;
    expectedDurationMs: number;
    hint?: string;
  },
  work: () => Promise<T>,
): Promise<T> {
  if (!backgroundGen) {
    return work();
  }

  const state: { phase: TaskPhase; error: string } = { phase: "running", error: "" };

  backgroundGen.registerTask({
    id: opts.taskId,
    label: opts.label,
    hint: opts.hint,
    startedAt: new Date().toISOString(),
    expectedDurationMs: opts.expectedDurationMs,
    showInDockFromStart: true,
    status: "running",
    minimized: false,
    poll: async () => {
      if (state.phase === "running") return { status: "running" as const };
      if (state.phase === "fail") {
        return { status: "failed" as const, error: state.error || "生成失败" };
      }
      return { status: "succeeded" as const };
    },
  });

  return work()
    .then((result) => {
      state.phase = "ok";
      return result;
    })
    .catch((e) => {
      state.phase = "fail";
      state.error = e instanceof Error ? e.message : "请稍后重试";
      throw e;
    });
}

export function posterDockTaskId(projectId: string, kind: "generate" | "batch" | "compose"): string {
  return `ecom-poster-${kind}-${projectId}`;
}
