import type { StoryGenerationTask, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isTransientSystemBusyError, runTxWithRetry, CANVAS_DB_TX_OPTIONS } from "@/lib/db-tx-retry";
import { buildStoryAiKieCallbackUrl } from "@/lib/story/story-ai-constants";
import {
  storyGwCreateKieJob,
  storyGwCreateVolcengineVideoJob,
} from "@/lib/story/story-gateway-client";
import { isVolcengineStoryVideoModelKey } from "@/lib/canvas/canvas-video-volcengine";

import {
  getDispatchBatch,
  getQueueTimeoutMin,
  isTrafficControlEnabled,
} from "./constants";
import { computeStoryQueueDispatchAfter, queueDispatchAfterFromIndex } from "./queue-dispatch-after";
import { acquireTrafficSlotInTx, releaseTrafficSlot } from "./slot";
import { resolveStoryProjectTrafficScope, resolveMaxConcurrencyForScope } from "./scope-key";
import { nextDispatchAfterFromSpacing } from "./token-bucket";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "./release-gateway-video-traffic-slot";
import { clearDispatchStaleRetryInPayload } from "./pre-submit-retry";

async function revertStuckStoryDispatchingTask(
  taskId: string,
  scopeKey: string,
): Promise<void> {
  await releaseTrafficSlot(scopeKey);
  await prisma.storyGenerationTask
    .update({
      where: { id: taskId, status: "DISPATCHING" },
      data: {
        status: "QUEUED",
        dispatchAfter: queueDispatchAfterFromIndex(0),
        failCode: null,
        failMessage: null,
      },
    })
    .catch(() => undefined);
}

async function dispatchOneStoryQueuedTask(
  task: StoryGenerationTask & { project: { userId: string } },
): Promise<"dispatched" | "skipped" | "failed"> {
  let scopeKey: string | null = null;
  try {
  if (task.kind !== "FRAME_VIDEO") return "skipped";

  const now = new Date();
  if (task.dispatchAfter && task.dispatchAfter.getTime() > now.getTime()) {
    return "skipped";
  }

  const actorUserId = task.actorUserId ?? task.project.userId;
  const scope = await resolveStoryProjectTrafficScope(task.projectId, actorUserId);
  scopeKey = scope.scopeKey;
  const maxConcurrency = await resolveMaxConcurrencyForScope(scope);
  const input = task.inputPayload as Record<string, unknown>;

  const slotResult = await runTxWithRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const fresh = await tx.storyGenerationTask.findUnique({ where: { id: task.id } });
        if (!fresh || fresh.status !== "QUEUED") return { action: "skipped" as const };

        const acquired = await acquireTrafficSlotInTx(tx, scope, maxConcurrency);
        if (!acquired.ok) {
          await tx.storyGenerationTask.update({
            where: { id: task.id },
            data: {
              dispatchAfter: acquired.retryAfter ?? nextDispatchAfterFromSpacing(new Date()),
            },
          });
          return { action: "skipped" as const };
        }

        await tx.storyGenerationTask.update({
          where: { id: task.id },
          data: { status: "DISPATCHING", dispatchAfter: null },
        });
        return { action: "claimed" as const };
      }, CANVAS_DB_TX_OPTIONS),
    { label: "story-dispatch-slot", maxRetries: 3 },
  );

  if (slotResult.action !== "claimed") return "skipped";

  let vendorJob: { taskId: string; logId: string } | null = null;
  try {
    const isVolcengine = isVolcengineStoryVideoModelKey(task.model);
    const callBackUrl = buildStoryAiKieCallbackUrl("video", task.id);
    const job = isVolcengine
      ? await storyGwCreateVolcengineVideoJob(task.project.userId, {
          model: task.model,
          body: input,
          storyProjectId: task.projectId,
          storyTaskId: task.id,
        })
      : await storyGwCreateKieJob(task.project.userId, {
          model: task.model,
          input,
          callBackUrl,
          storyProjectId: task.projectId,
          storyTaskId: task.id,
        });
    vendorJob = job;

    await runTxWithRetry(
      () =>
        prisma.storyGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            gatewayLogId: job.logId,
            submittedAt: new Date(),
            lastPolledAt: new Date(),
            inputPayload: clearDispatchStaleRetryInPayload(
              input,
            ) as Prisma.InputJsonValue,
          },
        }),
      { label: "story-dispatch-submitted-write", maxRetries: 5 },
    );

    await releaseGatewayVideoTrafficSlotIfOccupying({
      logId: job.logId,
      scopeKey: scope.scopeKey,
      fireDispatch: true,
    }).catch((e) => {
      console.warn(
        "[story-dispatch] release slot after submit failed",
        job.logId.slice(0, 12),
        e instanceof Error ? e.message : String(e),
      );
    });

    return "dispatched";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await releaseTrafficSlot(scope.scopeKey);

    if (!vendorJob && isTransientSystemBusyError(e)) {
      await revertStuckStoryDispatchingTask(task.id, scope.scopeKey);
      return "skipped";
    }

    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "STORY_VIDEO_DISPATCH_FAILED",
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return "failed";
  }
  } catch (e) {
    if (scopeKey) {
      const fresh = await prisma.storyGenerationTask.findUnique({
        where: { id: task.id },
        select: { status: true },
      });
      if (fresh?.status === "DISPATCHING") {
        await revertStuckStoryDispatchingTask(task.id, scopeKey);
      }
    }
    if (isTransientSystemBusyError(e)) return "skipped";
    console.warn(
      "[story-dispatch] task error",
      task.id.slice(0, 12),
      e instanceof Error ? e.message : String(e),
    );
    return "skipped";
  }
}

export async function dispatchQueuedStoryTasks(opts?: {
  projectId?: string;
}): Promise<{ dispatched: number; skipped: number; failed: number; cancelled: number; recovered: number }> {
  const result = { dispatched: 0, skipped: 0, failed: 0, cancelled: 0, recovered: 0 };
  if (!isTrafficControlEnabled()) return result;

  try {
    const { recoverStaleDispatchingStoryTasks } = await import(
      "./recover-stale-dispatching-story"
    );
    result.recovered = await recoverStaleDispatchingStoryTasks({
      projectId: opts?.projectId,
      limit: 20,
    });
  } catch (e) {
    console.warn(
      "[story-dispatch] recoverStaleDispatchingStory failed",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const cutoff = new Date(Date.now() - getQueueTimeoutMin() * 60_000);
    // FRAME_VIDEO 走 30s×6 pre-submit 自愈，不用 10min QUEUE_TIMEOUT
    const cancelled = await prisma.storyGenerationTask.updateMany({
      where: {
        status: "QUEUED",
        queuedAt: { lt: cutoff },
        kind: { not: "FRAME_VIDEO" },
        ...(opts?.projectId ? { projectId: opts.projectId } : {}),
      },
      data: {
        status: "CANCELLED",
        failCode: "QUEUE_TIMEOUT",
        failMessage: `排队超过 ${getQueueTimeoutMin()} 分钟，请重试`,
        completedAt: new Date(),
      },
    });
    result.cancelled = cancelled.count;
  } catch (e) {
    console.warn(
      "[story-dispatch] cancelQueueTimeouts failed",
      e instanceof Error ? e.message : String(e),
    );
  }

  let queued: (StoryGenerationTask & { project: { userId: string } })[] = [];
  try {
    queued = await prisma.storyGenerationTask.findMany({
      where: {
        status: "QUEUED",
        kind: "FRAME_VIDEO",
        ...(opts?.projectId ? { projectId: opts.projectId } : {}),
        OR: [{ dispatchAfter: null }, { dispatchAfter: { lte: new Date() } }],
      },
      orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
      take: getDispatchBatch(),
      include: { project: { select: { userId: true } } },
    });
  } catch (e) {
    console.warn(
      "[story-dispatch] skipped (db unavailable?)",
      e instanceof Error ? e.message : String(e),
    );
    return result;
  }

  for (const task of queued) {
    try {
      const r = await dispatchOneStoryQueuedTask(task);
      if (r === "dispatched") result.dispatched++;
      else if (r === "failed") result.failed++;
      else result.skipped++;
    } catch (e) {
      result.skipped++;
      console.warn(
        "[story-dispatch] task loop error",
        task.id.slice(0, 12),
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return result;
}

export async function admitStoryFrameVideoTask(input: {
  projectId: string;
  actorUserId: string;
  kind: "FRAME_VIDEO";
  model: string;
  inputPayload: Record<string, unknown>;
  characterId?: string | null;
  frameId?: string | null;
}): Promise<StoryGenerationTask> {
  const scope = await resolveStoryProjectTrafficScope(
    input.projectId,
    input.actorUserId,
  );
  const now = new Date();
  const status = isTrafficControlEnabled() ? "QUEUED" : "PENDING";
  const dispatchAfter = isTrafficControlEnabled()
    ? await computeStoryQueueDispatchAfter(scope, now.getTime())
    : undefined;

  return prisma.storyGenerationTask.create({
    data: {
      projectId: input.projectId,
      kind: input.kind,
      model: input.model,
      inputPayload: input.inputPayload as Prisma.InputJsonValue,
      characterId: input.characterId ?? null,
      frameId: input.frameId ?? null,
      status,
      queuedAt: isTrafficControlEnabled() ? now : undefined,
      dispatchAfter,
      tenantId: scope.tenantId ?? null,
      actorUserId: input.actorUserId,
    },
  });
}
