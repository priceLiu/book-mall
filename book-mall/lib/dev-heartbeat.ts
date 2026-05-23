/**
 * 后台 poll-loop / 类似进程的心跳文件机制（仅本地开发）。
 *
 * - poll-loop 每个 tick 调 `writeDevHeartbeat()` 写 `os.tmpdir()/pw-{id}-heartbeat.json`
 * - /api/dev/health 调 `readDevHeartbeat()` 读，超过 `STALE_AFTER_MS` 视为离线
 *
 * 这是开发自检用的，生产 cron 不会经过这里。
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const HEARTBEAT_FILE_PREFIX = "pw-heartbeat-";
const STALE_AFTER_MS = 60_000;

export type DevHeartbeatPayload = {
  id: string;
  pid: number;
  startedAt: string;
  lastTickAt: string;
  iter: number;
  intervalMs: number;
  lastResult?: Record<string, unknown> | null;
  lastError?: string | null;
};

export type DevHeartbeatStatus =
  | { state: "running"; lastTickAt: string; iter: number; pid: number; ageMs: number; lastError?: string | null }
  | { state: "stale"; lastTickAt: string; iter: number; pid: number; ageMs: number; lastError?: string | null }
  | { state: "missing" };

function heartbeatPath(id: string): string {
  return path.join(os.tmpdir(), `${HEARTBEAT_FILE_PREFIX}${id}.json`);
}

export async function writeDevHeartbeat(payload: DevHeartbeatPayload): Promise<void> {
  try {
    await fs.writeFile(heartbeatPath(payload.id), JSON.stringify(payload), "utf8");
  } catch {
    // 心跳写失败不影响主流程
  }
}

export async function readDevHeartbeat(id: string): Promise<DevHeartbeatStatus> {
  try {
    const raw = await fs.readFile(heartbeatPath(id), "utf8");
    const data = JSON.parse(raw) as DevHeartbeatPayload;
    const last = new Date(data.lastTickAt).getTime();
    if (!Number.isFinite(last)) return { state: "missing" };
    const ageMs = Date.now() - last;
    const state = ageMs <= STALE_AFTER_MS ? "running" : "stale";
    return {
      state,
      lastTickAt: data.lastTickAt,
      iter: data.iter,
      pid: data.pid,
      ageMs,
      lastError: data.lastError ?? null,
    };
  } catch {
    return { state: "missing" };
  }
}

/**
 * 在脚本里使用：返回一个 `tick()` 包装器，自动在每次 tick 后写心跳。
 *
 * @example
 *   const heartbeat = createHeartbeat({ id: "story-poll", intervalMs: 10_000 });
 *   await heartbeat.start();
 *   ...
 *   await heartbeat.recordTick({ scanned: 0 });
 *   ...
 *   await heartbeat.recordError(new Error("..."));
 */
export function createHeartbeat(args: { id: string; intervalMs: number }) {
  const startedAt = new Date().toISOString();
  let iter = 0;

  async function recordTick(lastResult?: Record<string, unknown> | null) {
    iter += 1;
    await writeDevHeartbeat({
      id: args.id,
      pid: process.pid,
      startedAt,
      lastTickAt: new Date().toISOString(),
      iter,
      intervalMs: args.intervalMs,
      lastResult: lastResult ?? null,
      lastError: null,
    });
  }

  async function recordError(err: unknown) {
    await writeDevHeartbeat({
      id: args.id,
      pid: process.pid,
      startedAt,
      lastTickAt: new Date().toISOString(),
      iter,
      intervalMs: args.intervalMs,
      lastResult: null,
      lastError: err instanceof Error ? err.message : String(err),
    });
  }

  return { recordTick, recordError, get iter() { return iter; } };
}
