import type { StoryGenerationTask, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isTransientSystemBusyError, runTxWithRetry } from "@/lib/db-tx-retry";
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
import { acquireTrafficSlotInTx, releaseTrafficSlot } from "./slot";
import { resolveStoryProjectTrafficScope } from "./scope-key";
import { nextDispatchAfterFromSpacing } from "./token-bucket";

async function dispatchOneStoryQueuedTask(
  task: StoryGenerationTask & { project: { userId: string } },
): Promise<"dispatched" | "skipped" | "failed"> {
  if (task.kind !== "FRAME_VIDEO") return "skipped";

  const now = new Date();
  if (task.dispatchAfter && task.dispatchAfter.getTime() > now.getTime()) {
    return "skipped";
  }

  const actorUserId = task.actorUserId ?? task.project.userId;
  const scope = await resolveStoryProjectTrafficScope(task.projectId, actorUserId);
  const input = task.inputPayload as Record<string, unknown>;

  const slotResult = await prisma.$transaction(async (tx) => {
    const fresh = await tx.storyGenerationTask.findUnique({ where: { id: task.id } });
    if (!fresh || fresh.status !== "QUEUED") return { action: "skipped" as const };

    const acquired = await acquireTrafficSlotInTx(tx, scope);
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
  });

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
          },
        }),
      { label: "story-dispatch-submitted-write", maxRetries: 5 },
    );
    return "dispatched";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await releaseTrafficSlot(scope.scopeKey);

    if (!vendorJob && isTransientSystemBusyError(e)) {
      await prisma.storyGenerationTask
        .update({
          where: { id: task.id },
          data: {
            status: "QUEUED",
            dispatchAfter: new Date(Date.now() + 5_000),
            failCode: null,
            failMessage: null,
          },
        })
        .catch(() => undefined);
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
}

export async function dispatchQueuedStoryTasks(opts?: {
  projectId?: string;
}): Promise<{ dispatched: number; skipped: number; failed: number; cancelled: number }> {
  const result = { dispatched: 0, skipped: 0, failed: 0, cancelled: 0 };
  if (!isTrafficControlEnabled()) return result;

  try {
  const cutoff = new Date(Date.now() - getQueueTimeoutMin() * 60_000);
  const cancelled = await prisma.storyGenerationTask.updateMany({
    where: {
      status: "QUEUED",
      queuedAt: { lt: cutoff },
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

  const queued = await prisma.storyGenerationTask.findMany({
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

  for (const task of queued) {
    const r = await dispatchOneStoryQueuedTask(task);
    if (r === "dispatched") result.dispatched++;
    else if (r === "failed") result.failed++;
    else result.skipped++;
  }

  return result;
  } catch (e) {
    console.warn(
      "[story-dispatch] skipped (db unavailable?)",
      e instanceof Error ? e.message : String(e),
    );
    return result;
  }
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
      tenantId: scope.tenantId ?? null,
      actorUserId: input.actorUserId,
    },
  });
}
