/**
 * Gateway 阻塞预警 / 自愈 · 阈值（检测节奏 10min ≠ CHAT 杀死线 15min）。
 */

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** 流式 CHAT 仍 RUNNING 且无 externalTaskId：超过此时长视为漏收口，自动 FAILED */
export function staleChatStreamMs(): number {
  return envInt("STALE_CHAT_STREAM_MS", 15 * 60 * 1000);
}

/** CHAT 偏长（可能仍在流）：只告警不自动杀 */
export function chatLongWarnMs(): number {
  return envInt("GATEWAY_HEALTH_CHAT_LONG_MS", 10 * 60 * 1000);
}

/** 非视频异步（有 taskId）兜底，与 expireStaleGatewayLogs 默认 30min 对齐 */
export function staleNonVideoAsyncMs(): number {
  return envInt("STALE_NONVIDEO_ASYNC_MS", 30 * 60 * 1000);
}

/** 视频 RUNNING 偏长（先告警，看门狗向厂商核对） */
export function staleVideoWarnMs(): number {
  return envInt("GATEWAY_HEALTH_VIDEO_WARN_MS", 90 * 60 * 1000);
}

/** 视频硬上限（与 poll-service STALE_VOLCENGINE_VIDEO_HARD_MS 默认 4h 对齐） */
export function staleVideoHardMs(): number {
  return envInt("STALE_VOLCENGINE_VIDEO_HARD_MS", 4 * 60 * 60 * 1000);
}

/** Canvas QUEUED/DISPATCHING 过久 */
export function canvasStaleDispatchMs(): number {
  return envInt("GATEWAY_HEALTH_CANVAS_STALE_MS", 10 * 60 * 1000);
}

/** 在飞总数告警线 */
export function inflightSpikeThreshold(): number {
  return envInt("GATEWAY_HEALTH_INFLIGHT_SPIKE", 80);
}

/** poll worker 心跳失活 */
export function pollWorkerStaleMs(): number {
  return envInt("GATEWAY_HEALTH_POLL_WORKER_STALE_MS", 3 * 60 * 1000);
}

/** 常驻扫描间隔（默认 10 分钟） */
export function gatewayHealthScanIntervalMs(): number {
  return envInt("GATEWAY_HEALTH_SCAN_INTERVAL_MS", 10 * 60 * 1000);
}

/** 流式 SSE 空闲超时（无新 chunk） */
export function chatStreamIdleMs(): number {
  return envInt("GATEWAY_CHAT_STREAM_IDLE_MS", 180_000);
}

/** 流式墙钟上限（略高于剧本 10min） */
export function chatStreamWallMs(): number {
  return envInt("GATEWAY_CHAT_STREAM_MAX_MS", 12 * 60 * 1000);
}

export function healthHealChatLimit(): number {
  return envInt("GATEWAY_HEALTH_HEAL_CHAT_LIMIT", 80);
}
