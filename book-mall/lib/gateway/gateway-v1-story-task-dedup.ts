/**
 * Gateway createTask · storyTaskId 幂等（Canvas / Story 任务 id 写入日志 storyTaskId）。
 * 百炼 R2V 等异步路径原先无 KIE 同款 dedup，并发 dispatch 会在 ~500ms 内双 createTask。
 */
import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

const STORY_TASK_DEDUP_WAIT_MS = 3_000;
const STORY_TASK_DEDUP_POLL_MS = 100;

export type GatewayStoryTaskDedupeHit = {
  logId: string;
  taskId: string;
};

function storyTaskAdvisoryLockKeys(storyTaskId: string): [number, number] {
  const buf = createHash("sha256")
    .update(`gw-story-task-create:${storyTaskId}`)
    .digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

/** 串行化同一 storyTaskId 的 createTask（跨 dispatch / poll 并发）。 */
export async function acquireGatewayStoryTaskCreateLock(
  storyTaskId: string,
): Promise<void> {
  const [k1, k2] = storyTaskAdvisoryLockKeys(storyTaskId);
  await prisma.$executeRaw`SELECT pg_advisory_lock(${k1}::int, ${k2}::int)`;
}

export async function releaseGatewayStoryTaskCreateLock(
  storyTaskId: string,
): Promise<void> {
  const [k1, k2] = storyTaskAdvisoryLockKeys(storyTaskId);
  await prisma.$executeRaw`SELECT pg_advisory_unlock(${k1}::int, ${k2}::int)`;
}

/**
 * 若已有非 FAILED 日志：返回最早一条的 logId + externalTaskId。
 * 日志在但 vendor taskId 尚未写入时，短暂轮询（同锁内第二次 createTask 会等到第一次落库）。
 */
export async function dedupeGatewayCreateByStoryTaskId(
  storyTaskId: string | null | undefined,
  opts?: { waitMs?: number },
): Promise<GatewayStoryTaskDedupeHit | "not_found" | "in_progress"> {
  const id = storyTaskId?.trim();
  if (!id) return "not_found";

  const deadline = Date.now() + (opts?.waitMs ?? STORY_TASK_DEDUP_WAIT_MS);
  while (true) {
    const log = await prisma.gatewayRequestLog.findFirst({
      where: {
        storyTaskId: id,
        status: { not: "FAILED" },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, externalTaskId: true },
    });
    if (!log) return "not_found";
    const ext = log.externalTaskId?.trim();
    if (ext) return { logId: log.id, taskId: ext };
    if (Date.now() >= deadline) return "in_progress";
    await new Promise((r) => setTimeout(r, STORY_TASK_DEDUP_POLL_MS));
  }
}

export type GatewayStoryTaskLockedCreateResult<T> =
  | { kind: "created"; value: T }
  | { kind: "deduped"; hit: GatewayStoryTaskDedupeHit };

/**
 * 同一 storyTaskId 的 createTask 全程持 advisory lock：
 * 第二次请求会等到第一次落库后走幂等返回，避免双 Gateway 日志。
 */
export async function runGatewayStoryTaskLockedCreate<T>(
  storyTaskId: string | null | undefined,
  createFn: () => Promise<T>,
): Promise<GatewayStoryTaskLockedCreateResult<T>> {
  const id = storyTaskId?.trim();
  if (!id) {
    return { kind: "created", value: await createFn() };
  }
  await acquireGatewayStoryTaskCreateLock(id);
  try {
    const hit = await dedupeGatewayCreateByStoryTaskId(id, { waitMs: 0 });
    if (hit !== "not_found" && hit !== "in_progress") {
      return { kind: "deduped", hit };
    }
    return { kind: "created", value: await createFn() };
  } finally {
    await releaseGatewayStoryTaskCreateLock(id);
  }
}
