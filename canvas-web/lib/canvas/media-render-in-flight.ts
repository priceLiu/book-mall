import type {
  MediaRenderJob,
  MediaRenderScaleMode,
} from "@/lib/canvas-api";
import { waitMediaRenderJob } from "@/lib/canvas-api";

export type JianyingMediaRenderTransitionKind = "xfade" | "none";

/** 自动剪辑进行中 · 写入节点 data，Dock 卸载后仍可恢复进度 */
export type JianyingMediaRenderInFlight = {
  jobId: string;
  status: "PENDING" | "RUNNING" | "FAILED";
  progress: number;
  progressLabel?: string | null;
  errorMessage?: string | null;
  transitionKind?: JianyingMediaRenderTransitionKind;
  transitionSec?: number;
  scaleMode?: MediaRenderScaleMode;
  burnIn?: boolean;
  subtitleMode?: "script" | "asr";
};

const activePolls = new Map<string, string>();
const pollPromises = new Map<string, Promise<MediaRenderJob>>();
/** 用户点「停止等待」后忽略该节点后续轮询写回，避免无法再剪辑 */
const dismissedPolls = new Map<string, string>();

export function isMediaRenderJobPolling(
  nodeId: string,
  jobId: string,
): boolean {
  return activePolls.get(nodeId) === jobId;
}

export function dismissMediaRenderPoll(nodeId: string, jobId?: string | null) {
  const id = jobId?.trim();
  if (id) dismissedPolls.set(nodeId, id);
  else dismissedPolls.delete(nodeId);
}

export function isMediaRenderPollDismissed(
  nodeId: string,
  jobId?: string | null,
): boolean {
  const id = jobId?.trim();
  if (!id) return false;
  return dismissedPolls.get(nodeId) === id;
}

export function clearMediaRenderPollDismiss(nodeId: string) {
  dismissedPolls.delete(nodeId);
}

export function friendlyMediaRenderError(message: string): string {
  if (/401|UNAUTHORIZED|工具站登录|无效或过期的工具令牌|重新连接主站/i.test(message)) {
    return "登录连接已断开，请稍候重试；若仍失败请刷新页面或重新连接主站账号。";
  }
  if (/aborted|abort/i.test(message)) {
    return "提交剪辑超时，请稍后重试；若多次失败请检查 book-mall 是否正常运行。";
  }
  if (/已被同一项目的新剪辑任务取代/i.test(message)) {
    return "请勿重复提交剪辑；当前任务仍在进行，请等待完成。";
  }
  if (/语音识别失败/i.test(message)) {
    return message;
  }
  if (/Gateway API Key|GATEWAY_KEY_REQUIRED/i.test(message)) {
    return "须先关联 Gateway API Key 方可使用语音识别烧字幕。";
  }
  if (/poll failed HTTP 5/i.test(message)) {
    return "进度查询暂时失败，成片若已生成可直接下载；稍后会自动重试同步。";
  }
  if (/Response timeout for 60000ms/i.test(message)) {
    return "成片上传云端超时，请稍后重试或降低输出画质；若多次失败请联系客服。";
  }
  if (/maxBuffer length exceeded|stderr maxBuffer/i.test(message)) {
    return "剪辑进程输出异常，请稍后重试；若多次失败请联系客服。";
  }
  if (/执行超时/i.test(message)) {
    return "剪辑耗时过长已超时，请减少分镜数量或降低输出画质后重试。";
  }
  if (/ResponseError|timeout|ECONNRESET|ETIMEDOUT/i.test(message)) {
    return "云端存储暂时不可用，请稍后重试。";
  }
  if (
    /fetch failed|failed to fetch|book_mall_proxy|book_mall_url_missing|networkerror/i.test(
      message,
    )
  ) {
    return "与云端剪辑服务连接失败，请稍后重试；若多次失败请刷新页面后再试。";
  }
  return message;
}

export function renderStatusLabel(job: MediaRenderJob | null): string {
  if (!job) return "提交任务…";
  if (job.status === "PENDING") {
    return job.progressLabel?.trim() || "排队中…";
  }
  if (job.progressLabel?.trim()) return job.progressLabel.trim();
  if (job.progress > 0) return `处理中… ${job.progress}%`;
  return "处理中…";
}

export function isMediaRenderJobInflight(
  inFlight: JianyingMediaRenderInFlight | null | undefined,
): boolean {
  if (!inFlight?.jobId?.trim()) return false;
  return inFlight.status === "PENDING" || inFlight.status === "RUNNING";
}

/** 画布任一节点的自动剪辑进行中 → tasks 轮询应退避，避免与 FFmpeg/保存抢 DB */
export function hasAnyMediaRenderInFlight(
  nodes: ReadonlyArray<{ data?: Record<string, unknown> }>,
): boolean {
  return nodes.some((n) =>
    isMediaRenderJobInflight(
      n.data?.mediaRenderInFlight as JianyingMediaRenderInFlight | null | undefined,
    ),
  );
}

export function isTransientMediaRenderPollError(message: string): boolean {
  return (
    /连接中断|进度查询暂时失败|failed to fetch|book_mall_proxy|502|503|504|ECONNRESET|ETIMEDOUT|abort|timeout/i.test(
      message,
    ) && !/下载分镜视频失败|语音识别失败|积分冻结|Gateway API Key/i.test(message)
  );
}

/** 提交占位 / 无效 inFlight（历史落盘 bug） */
export function isStaleMediaRenderInFlight(
  inFlight: JianyingMediaRenderInFlight | null | undefined,
): boolean {
  if (!inFlight) return false;
  const jobId = inFlight.jobId?.trim() ?? "";
  return !jobId || jobId === "pending";
}

/** hydrate：清掉落盘残留的 pending，避免永远卡在「提交任务」 */
export function clearStaleMediaRenderInFlightInNodes<
  T extends { data?: Record<string, unknown> },
>(nodes: T[]): T[] {
  let changed = false;
  const next = nodes.map((n) => {
    const inflight = n.data?.mediaRenderInFlight as
      | JianyingMediaRenderInFlight
      | null
      | undefined;
    if (!isStaleMediaRenderInFlight(inflight)) return n;
    changed = true;
    return {
      ...n,
      data: { ...(n.data ?? {}), mediaRenderInFlight: null },
    };
  });
  return changed ? next : nodes;
}

export async function pollMediaRenderJobUntilDone(args: {
  nodeId: string;
  jobId: string;
  base: string;
  onPoll: (job: MediaRenderJob) => void;
}): Promise<MediaRenderJob> {
  const { nodeId, jobId, base, onPoll } = args;
  const dedupeKey = `${nodeId}:${jobId}`;
  const existing = pollPromises.get(dedupeKey);
  if (existing) return existing;

  const promise = (async () => {
    activePolls.set(nodeId, jobId);
    try {
      return await waitMediaRenderJob(base, jobId, {
        onPoll: (job) => {
          if (isMediaRenderPollDismissed(nodeId, jobId)) return;
          onPoll(job);
        },
      });
    } finally {
      if (activePolls.get(nodeId) === jobId) {
        activePolls.delete(nodeId);
      }
      pollPromises.delete(dedupeKey);
    }
  })();

  pollPromises.set(dedupeKey, promise);
  return promise;
}
