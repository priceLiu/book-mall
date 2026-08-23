/**
 * Gateway 阻塞预警 · 纯函数判定（可单测）。
 */
import {
  inflightSpikeThreshold,
  pollWorkerStaleMs,
} from "@/lib/gateway/gateway-health-policy";

export type GatewayHealthAlertLevel = "INFO" | "WARN" | "CRITICAL";

export type GatewayHealthAlertCode =
  | "STALE_CHAT"
  | "CHAT_LONG"
  | "STALE_ASYNC"
  | "STALE_VIDEO"
  | "VIDEO_HARD"
  | "POLL_WORKER_STALE"
  | "CANVAS_STALE_DISPATCH"
  | "INFLIGHT_SPIKE";

export type GatewayHealthAlert = {
  code: GatewayHealthAlertCode;
  level: GatewayHealthAlertLevel;
  message: string;
  value: number;
};

export type GatewayHealthCounts = {
  staleChat: number;
  chatLong: number;
  staleAsync: number;
  staleVideo: number;
  videoHard: number;
  canvasStaleDispatch: number;
  inflight: number;
  pollWorkerStale: boolean;
  pollWorkerAgeMs: number | null;
};

export function gatewayHealthOpsStatus(
  alerts: GatewayHealthAlert[],
): "healthy" | "warn" | "critical" {
  if (alerts.some((a) => a.level === "CRITICAL")) return "critical";
  if (alerts.some((a) => a.level === "WARN")) return "warn";
  return "healthy";
}

export type GatewayHealthSample = {
  id: string;
  model: string;
  requestKind: string;
  submittedAt: string;
  ageSec: number;
};

export type GatewayHealthHealReport = {
  staleChatClosed: number;
  expired: number;
  videoWatchdog: unknown;
  kieWatchdog: unknown;
  canvasRecovered: number;
  statsReconciled: boolean;
};

export type GatewayHealthSnapshot = {
  scannedAt: string;
  source: string;
  opsHealth: "healthy" | "warn" | "critical";
  counts: GatewayHealthCounts;
  alerts: GatewayHealthAlert[];
  samples: {
    staleChat: GatewayHealthSample[];
    staleVideo: GatewayHealthSample[];
    staleAsync: GatewayHealthSample[];
  };
  lastHeal: GatewayHealthHealReport | null;
  lastHealAt: string | null;
};

export function evaluateGatewayHealthAlerts(
  c: GatewayHealthCounts,
): GatewayHealthAlert[] {
  const alerts: GatewayHealthAlert[] = [];

  if (c.staleChat > 0) {
    alerts.push({
      code: "STALE_CHAT",
      level: "CRITICAL",
      message: `${c.staleChat} 条流式 Chat 超过 15 分钟仍 RUNNING（无厂商 taskId），属于漏收口`,
      value: c.staleChat,
    });
  }

  if (c.chatLong > 0) {
    alerts.push({
      code: "CHAT_LONG",
      level: "WARN",
      message: `${c.chatLong} 条 Chat 已运行 10～15 分钟，可能仍在流式输出`,
      value: c.chatLong,
    });
  }

  if (c.staleAsync > 0) {
    alerts.push({
      code: "STALE_ASYNC",
      level: "WARN",
      message: `${c.staleAsync} 条非视频异步任务超过 30 分钟仍 RUNNING`,
      value: c.staleAsync,
    });
  }

  if (c.videoHard > 0) {
    alerts.push({
      code: "VIDEO_HARD",
      level: "CRITICAL",
      message: `${c.videoHard} 条视频任务超过硬上限（4 小时）仍 RUNNING`,
      value: c.videoHard,
    });
  } else if (c.staleVideo > 0) {
    alerts.push({
      code: "STALE_VIDEO",
      level: "WARN",
      message: `${c.staleVideo} 条视频任务超过 90 分钟仍 RUNNING（看门狗应向厂商核对）`,
      value: c.staleVideo,
    });
  }

  if (c.pollWorkerStale) {
    const ageSec =
      c.pollWorkerAgeMs != null ? Math.round(c.pollWorkerAgeMs / 1000) : null;
    alerts.push({
      code: "POLL_WORKER_STALE",
      level: "CRITICAL",
      message:
        ageSec != null
          ? `Gateway 轮询心跳已 ${ageSec}s 未成功（阈值 ${Math.round(pollWorkerStaleMs() / 1000)}s）`
          : "Gateway 轮询心跳从未成功，异步任务可能无法收口",
      value: ageSec ?? -1,
    });
  }

  if (c.canvasStaleDispatch > 0) {
    alerts.push({
      code: "CANVAS_STALE_DISPATCH",
      level: "WARN",
      message: `${c.canvasStaleDispatch} 条画布任务卡在排队/出队超过 10 分钟`,
      value: c.canvasStaleDispatch,
    });
  }

  const spike = inflightSpikeThreshold();
  if (c.inflight >= spike) {
    alerts.push({
      code: "INFLIGHT_SPIKE",
      level: c.inflight >= spike * 2 ? "CRITICAL" : "WARN",
      message: `Gateway 在飞 ${c.inflight} 条，超过阈值 ${spike}（含正常生成与僵尸）`,
      value: c.inflight,
    });
  }

  return alerts;
}
