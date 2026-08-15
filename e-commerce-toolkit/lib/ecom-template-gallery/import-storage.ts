const STORAGE_KEY = "ecom-template-import-v1";

export type ImportItemStatus =
  | "queued"
  | "uploading"
  | "success"
  | "skipped"
  | "failed"
  | "cancelled";

export type PersistedImportItem = {
  id: string;
  title: string;
  thumbPreview: string;
  category: string;
  mediaKind: "image" | "video";
  sourceUrl: string;
  ext: string;
  hot: boolean;
  posterUrl?: string;
  thumbSourceUrl?: string;
  status: ImportItemStatus;
  progress: number;
  error?: string;
  /** 已失败并重新排队的次数（上限见 import provider） */
  retryCount?: number;
  /** 进入 uploading 的时间戳；刷新后在 grace 内不重复提交 */
  uploadStartedAt?: number;
};

export type PersistedImportJob = {
  id: string;
  createdAt: number;
  items: PersistedImportItem[];
  done: boolean;
  notified: boolean;
  /** 用户手动停止；刷新后不再自动恢复 */
  cancelled?: boolean;
};

export function loadPersistedImportJobs(): PersistedImportJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedImportJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePersistedImportJobs(jobs: PersistedImportJob[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(-5)));
  } catch {
    /* ignore quota */
  }
}

export function jobStats(items: PersistedImportItem[]) {
  return {
    total: items.length,
    success: items.filter((i) => i.status === "success").length,
    skipped: items.filter((i) => i.status === "skipped").length,
    failed: items.filter((i) => i.status === "failed").length,
    cancelled: items.filter((i) => i.status === "cancelled").length,
    pending: items.filter((i) => i.status === "queued" || i.status === "uploading")
      .length,
  };
}

const PANEL_STATUS_ORDER: Record<ImportItemStatus, number> = {
  uploading: 0,
  failed: 1,
  queued: 2,
  success: 3,
  skipped: 4,
  cancelled: 5,
};

const PANEL_MAX_COMPLETED = 8;

function isActiveImportItem(item: PersistedImportItem): boolean {
  return (
    item.status === "queued" ||
    item.status === "uploading" ||
    item.status === "failed"
  );
}

/**
 * 服务端不回传真实进度，面板按耗时估算；到达此上限即表示「只剩等回执」，
 * 面板须改用等待文案，不要继续显示「上传中」。
 */
export const UPLOAD_DISPLAY_PROGRESS_CAP = 88;

/** 面板展示用进度：仅随 uploadStartedAt 单调递增，避免 reconcile 写回旧值导致条闪 */
export function computeImportItemDisplayProgress(
  item: PersistedImportItem,
  now = Date.now(),
): number {
  switch (item.status) {
    case "success":
    case "skipped":
    case "failed":
      return 100;
    case "cancelled":
    case "queued":
      return 0;
    case "uploading": {
      if (item.progress != null && item.progress <= 8) return item.progress;
      if (item.uploadStartedAt) {
        const elapsed = now - item.uploadStartedAt;
        return Math.min(
          UPLOAD_DISPLAY_PROGRESS_CAP,
          10 + Math.floor(elapsed / 4000),
        );
      }
      return Math.max(item.progress ?? 10, 10);
    }
    default:
      return item.progress ?? 0;
  }
}

/** reconcile 返回的 items 与内存合并，勿用 catalog 核对前的快照覆盖上传中进度 */
export function mergeReconciledImportItems(
  currentItems: PersistedImportItem[],
  reconciledItems: PersistedImportItem[],
): PersistedImportItem[] {
  const currentById = new Map(currentItems.map((it) => [it.id, it]));
  return reconciledItems.map((rec) => {
    const prev = currentById.get(rec.id);
    if (!prev) return rec;
    if (rec.status === "skipped" || rec.status === "success") return rec;
    if (prev.status === "uploading" && rec.status !== "uploading") {
      return prev;
    }
    if (prev.status === "uploading" && rec.status === "uploading") {
      return {
        ...rec,
        progress: Math.max(prev.progress ?? 0, rec.progress ?? 0),
        uploadStartedAt: prev.uploadStartedAt ?? rec.uploadStartedAt,
      };
    }
    return rec;
  });
}

/** 面板红色副文案：仅真实失败/重试提示 */
export function isImportItemErrorMessage(item: PersistedImportItem): boolean {
  if (item.status === "failed") return true;
  if (!item.error?.trim()) return false;
  return (
    item.error.includes("排队重试") ||
    item.error.includes("无法连接") ||
    item.error.includes("网络请求") ||
    item.error.includes("源站拉取失败") ||
    item.error.includes("源站响应") ||
    item.error.includes("上传中断") ||
    item.error.includes("上传失败") ||
    item.error.includes("上传超时")
  );
}

/** 导入面板：进行中全部展示，已完成保留最近若干条便于核对 */
export function listImportPanelItems(
  items: PersistedImportItem[],
): PersistedImportItem[] {
  const active = items.filter(isActiveImportItem);
  const completed = items
    .filter((item) => item.status === "success" || item.status === "skipped")
    .slice(-PANEL_MAX_COMPLETED);
  return [...active, ...completed].sort(
    (a, b) =>
      (PANEL_STATUS_ORDER[a.status] ?? 99) -
      (PANEL_STATUS_ORDER[b.status] ?? 99),
  );
}

export function hasResumableItems(job: PersistedImportJob): boolean {
  if (job.cancelled) return false;
  return job.items.some(
    (i) =>
      i.status === "queued" ||
      i.status === "uploading" ||
      i.status === "failed",
  );
}

function cancelPendingItems(
  items: PersistedImportItem[],
): PersistedImportItem[] {
  return items.map((it) =>
    it.status === "queued" || it.status === "uploading"
      ? {
          ...it,
          status: "cancelled" as const,
          progress: 0,
          error: "已手动停止",
        }
      : it,
  );
}

/** 停止指定任务（写入 localStorage 用） */
export function stopPersistedImportJob(
  jobs: PersistedImportJob[],
  jobId: string,
): PersistedImportJob[] {
  return jobs.map((job) => {
    if (job.id !== jobId) return job;
    return {
      ...job,
      cancelled: true,
      done: true,
      notified: true,
      items: cancelPendingItems(job.items),
    };
  });
}

/** 服务端单条导入可能 3～6 分钟；此窗口内不重复 POST */
export const UPLOAD_IN_FLIGHT_GRACE_MS = 8 * 60 * 1000;

/** 页面刷新 / HMR：grace 内保留 uploading，仅核对 catalog */
export function normalizeStalledImportJobs(
  jobs: PersistedImportJob[],
): PersistedImportJob[] {
  const now = Date.now();
  return jobs.map((job) => {
    if (job.cancelled) {
      return {
        ...job,
        done: true,
        items: cancelPendingItems(job.items),
      };
    }
    return {
      ...job,
      done: false,
      items: job.items.map((it) => {
        if (it.status !== "uploading") return it;
        const started = it.uploadStartedAt ?? 0;
        if (started > 0 && now - started < UPLOAD_IN_FLIGHT_GRACE_MS) {
          const progress =
            (it.progress ?? 0) >= 90 ? 88 : Math.max(it.progress ?? 0, 55);
          return {
            ...it,
            progress,
            error: undefined,
          };
        }
        return {
          ...it,
          status: "queued" as const,
          progress: 0,
          uploadStartedAt: undefined,
          error: undefined,
        };
      }),
    };
  });
}
