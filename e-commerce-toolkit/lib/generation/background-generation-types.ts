export type BackgroundGenerationTaskStatus = "running" | "succeeded" | "failed";

export type BackgroundGenerationPollResult =
  | { status: "running" }
  | { status: "succeeded" }
  | { status: "failed"; error?: string };

export type BackgroundGenerationTask = {
  id: string;
  label: string;
  hint?: string;
  startedAt: string;
  /** 用于伪进度条 */
  expectedDurationMs?: number;
  status: BackgroundGenerationTaskStatus;
  error?: string;
  /** true = 仅 Dock 展示，前台 inline busy 关闭 */
  minimized: boolean;
  poll: () => Promise<BackgroundGenerationPollResult>;
  onSucceeded?: () => void | Promise<void>;
};

export type RegisterBackgroundGenerationTaskInput = Omit<
  BackgroundGenerationTask,
  "status" | "minimized" | "error"
> & {
  status?: BackgroundGenerationTaskStatus;
  minimized?: boolean;
};
