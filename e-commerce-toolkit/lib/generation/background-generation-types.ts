export type BackgroundGenerationTaskStatus = "running" | "succeeded" | "failed";

export type BackgroundGenerationPollResult =
  | { status: "running"; progressPercent?: number; detail?: string }
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
  /** 爆款拆解/重写等：提交后立即在右下角 Dock 展示（不等 10 分钟） */
  showInDockFromStart?: boolean;
  /** 0～1，轮询写入；有值时 Dock 优先展示 */
  progressPercent?: number;
  progressDetail?: string;
  poll: () => Promise<BackgroundGenerationPollResult>;
  onSucceeded?: () => void | Promise<void>;
  onFailed?: () => void | Promise<void>;
  /** 运行中可取消（如拉片中止） */
  onCancel?: () => void | Promise<void>;
  cancelLabel?: string;
  /** 完成后在 Dock 展示「打开作品 / 查看结果」 */
  openLabel?: string;
  onOpen?: () => void | Promise<void>;
};

export type RegisterBackgroundGenerationTaskInput = Omit<
  BackgroundGenerationTask,
  "status" | "minimized" | "error"
> & {
  status?: BackgroundGenerationTaskStatus;
  minimized?: boolean;
};
