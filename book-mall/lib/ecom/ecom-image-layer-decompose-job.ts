import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import { buildDecomposePrompt } from "@/lib/ecom/ecom-image-layer-prompt";
import {
  isImageLayerDecomposeJobAlive,
  parseImageLayerDecomposeJob,
  type ImageLayerDecomposeJobState,
} from "@/lib/ecom/ecom-image-layer-decompose-job-state";
import {
  appendEcomImageLayerGeneration,
  getEcomImageLayerProject,
  workspaceFromStack,
} from "@/lib/ecom/ecom-image-layer-project-service";
import {
  sanitizeImageLayerWorkspace,
  type ImageLayerProjectDto,
} from "@/lib/ecom/ecom-image-layer-project-types";
import { decomposeImageLayer } from "@/lib/ecom/ecom-image-layer-service";
import { prisma } from "@/lib/prisma";

const HEARTBEAT_MS = 20_000;

const inflightProjectIds = new Set<string>();

type LockedRow = {
  meta: unknown;
  workspace: unknown;
};

function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function withLockedImageLayerProject<T>(
  userId: string,
  projectId: string,
  fn: (
    row: LockedRow,
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedRow[]>`
      SELECT meta, workspace
      FROM "EcomImageLayerProject"
      WHERE id = ${projectId} AND "userId" = ${userId}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;
    return fn(
      {
        meta: parseJsonField(row.meta),
        workspace: parseJsonField(row.workspace),
      },
      tx,
    );
  });
}

function asMetaRecord(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return { ...(meta as Record<string, unknown>) };
}

async function writeJob(
  userId: string,
  projectId: string,
  jobId: string,
  patch: Partial<ImageLayerDecomposeJobState> & { status: ImageLayerDecomposeJobState["status"] },
  opts?: { requireStale?: boolean },
): Promise<boolean> {
  const wrote = await withLockedImageLayerProject(userId, projectId, async (row, tx) => {
    const current = parseImageLayerDecomposeJob(row.meta);
    if (!current || current.id !== jobId || current.status !== "running") return false;
    if (opts?.requireStale && isImageLayerDecomposeJobAlive(current)) return false;
    const meta = {
      ...asMetaRecord(row.meta),
      decomposeJob: { ...current, ...patch },
    };
    await tx.ecomImageLayerProject.update({
      where: { id: projectId },
      data: { meta: meta as Prisma.InputJsonValue },
    });
    return true;
  });
  return wrote === true;
}

async function touchDecomposeHeartbeat(
  userId: string,
  projectId: string,
  jobId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await withLockedImageLayerProject(userId, projectId, async (row, tx) => {
    const current = parseImageLayerDecomposeJob(row.meta);
    if (!current || current.id !== jobId || current.status !== "running") return;
    const meta = {
      ...asMetaRecord(row.meta),
      decomposeJob: { ...current, heartbeatAt: now },
    };
    await tx.ecomImageLayerProject.update({
      where: { id: projectId },
      data: { meta: meta as Prisma.InputJsonValue },
    });
  });
}

function scheduleDecomposeWorker(opts: {
  userId: string;
  projectId: string;
  jobId: string;
  sourceImageUrl: string;
  bboxes?: Array<[number, number, number, number]>;
  size?: string;
}): void {
  if (inflightProjectIds.has(opts.projectId)) return;
  inflightProjectIds.add(opts.projectId);
  const timer = setInterval(() => {
    void touchDecomposeHeartbeat(opts.userId, opts.projectId, opts.jobId).catch((e) => {
      console.error("[image-layer-decompose] heartbeat", e);
    });
  }, HEARTBEAT_MS);

  void (async () => {
    try {
      const stack = await decomposeImageLayer({
        userId: opts.userId,
        sourceImageUrl: opts.sourceImageUrl,
        bboxes: opts.bboxes,
        size: opts.size,
      });
      const saved = await withLockedImageLayerProject(
        opts.userId,
        opts.projectId,
        async (row, tx) => {
          const current = parseImageLayerDecomposeJob(row.meta);
          if (!current || current.id !== opts.jobId || current.status !== "running") {
            return false;
          }
          const prev = sanitizeImageLayerWorkspace(row.workspace);
          const finishedAt = new Date().toISOString();
          const workspace = {
            ...prev,
            ...workspaceFromStack(stack, {
              sourceImageUrl: stack.sourceImageUrl ?? opts.sourceImageUrl,
              originalImageUrl: opts.sourceImageUrl,
              pendingBboxes: [],
              pendingBbox: null,
            }),
          };
          const meta = {
            ...asMetaRecord(row.meta),
            decomposeJob: {
              ...current,
              status: "succeeded" as const,
              finishedAt,
              heartbeatAt: finishedAt,
            },
          };
          await tx.ecomImageLayerProject.update({
            where: { id: opts.projectId },
            data: {
              workspace: workspace as Prisma.InputJsonValue,
              meta: meta as Prisma.InputJsonValue,
            },
          });
          return true;
        },
      );
      if (saved) {
        try {
          await appendEcomImageLayerGeneration(opts.userId, opts.projectId, {
            kind: "decompose",
            title: "AI 图层分离",
            prompt: buildDecomposePrompt(opts.bboxes ?? []),
            ossUrl: stack.background.url,
            logId: stack.logId ?? null,
            compareFromUrl: opts.sourceImageUrl,
          });
        } catch (e) {
          console.error("[image-layer-decompose] append generation", e);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "图层拆分失败";
      console.error("[image-layer-decompose]", message);
      const finishedAt = new Date().toISOString();
      await writeJob(opts.userId, opts.projectId, opts.jobId, {
        status: "failed",
        finishedAt,
        heartbeatAt: finishedAt,
        error: message,
      }).catch((err) => {
        console.error("[image-layer-decompose] mark failed", err);
      });
    } finally {
      clearInterval(timer);
      inflightProjectIds.delete(opts.projectId);
    }
  })();
}

export async function expireStaleImageLayerDecomposeJob(
  userId: string,
  projectId: string,
): Promise<ImageLayerProjectDto | null> {
  const project = await getEcomImageLayerProject(userId, projectId);
  if (!project) return null;
  const job = parseImageLayerDecomposeJob(project.meta);
  if (!job || job.status !== "running" || isImageLayerDecomposeJobAlive(job)) {
    return project;
  }
  const finishedAt = new Date().toISOString();
  await writeJob(
    userId,
    projectId,
    job.id,
    {
      status: "failed",
      finishedAt,
      error: "图层分离已中断，请重新点击「AI 图层分离」",
    },
    { requireStale: true },
  );
  return getEcomImageLayerProject(userId, projectId);
}

export async function startImageLayerDecomposeJob(opts: {
  userId: string;
  projectId: string;
  sourceImageUrl: string;
  bboxes?: Array<[number, number, number, number]>;
  size?: string;
}): Promise<{ jobId: string; status: "running" }> {
  const now = new Date().toISOString();
  const created = await withLockedImageLayerProject(
    opts.userId,
    opts.projectId,
    async (row, tx) => {
      const current = parseImageLayerDecomposeJob(row.meta);
      if (current?.status === "running" && isImageLayerDecomposeJobAlive(current)) {
        return { jobId: current.id, attached: true as const };
      }
      const jobId = randomUUID();
      const job: ImageLayerDecomposeJobState = {
        id: jobId,
        status: "running",
        sourceImageUrl: opts.sourceImageUrl,
        startedAt: now,
        heartbeatAt: now,
      };
      const meta = { ...asMetaRecord(row.meta), decomposeJob: job };
      await tx.ecomImageLayerProject.update({
        where: { id: opts.projectId },
        data: { meta: meta as Prisma.InputJsonValue },
      });
      return { jobId, attached: false as const };
    },
  );
  if (!created) throw new Error("项目不存在");
  if (!created.attached) {
    scheduleDecomposeWorker({
      userId: opts.userId,
      projectId: opts.projectId,
      jobId: created.jobId,
      sourceImageUrl: opts.sourceImageUrl,
      bboxes: opts.bboxes,
      size: opts.size,
    });
  }
  return { jobId: created.jobId, status: "running" };
}
