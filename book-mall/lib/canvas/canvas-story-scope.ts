/** 漫剧列行 / 文案段任务 scope（存于 inputPayload.storyScope） */

import { createHash } from "node:crypto";
import type { Prisma, CanvasGenerationTask } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CANVAS_DB_TX_OPTIONS, runTxWithRetry } from "@/lib/db-tx-retry";
import { promptArchiveFieldsForTask } from "@/lib/canvas/canvas-task-prompt-archive";
import { CanvasProjectError } from "./canvas-project-service";
import { GENERATION_INFLIGHT_STATUSES } from "@/lib/generation/traffic-control/constants";
import { resolveCanvasProjectTrafficScope } from "@/lib/generation/traffic-control/scope-key";

export type CanvasTaskStoryScope = {
  rowKey?: string;
  mediaKind?: string;
  llmSection?: string;
};

export function extractStoryScopeFromInputPayload(
  inputPayload: unknown,
): CanvasTaskStoryScope | undefined {
  if (!inputPayload || typeof inputPayload !== "object") return undefined;
  const raw = (inputPayload as Record<string, unknown>).storyScope;
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const out: CanvasTaskStoryScope = {};
  if (typeof s.rowKey === "string") out.rowKey = s.rowKey;
  if (typeof s.mediaKind === "string") out.mediaKind = s.mediaKind;
  if (typeof s.llmSection === "string") out.llmSection = s.llmSection;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function storyScopeKey(scope?: CanvasTaskStoryScope): string {
  if (!scope) return "";
  return [scope.llmSection, scope.rowKey, scope.mediaKind]
    .filter(Boolean)
    .join(":");
}

/** 同一 nodeId 上两任务是否互斥（同 scope 或 legacy 无 scope） */
export function storyScopesConflict(
  requested?: CanvasTaskStoryScope,
  existing?: CanvasTaskStoryScope,
): boolean {
  const a = storyScopeKey(requested);
  const b = storyScopeKey(existing);
  if (!a && !b) return true;
  if (!a || !b) return true;
  return a === b;
}

/** Poll 重试 / Gateway 日志：优先 payload.clientPage，否则按 storyScope 推断专业版路径 */
export function resolveCanvasTaskClientPage(
  projectId: string,
  inputPayload: unknown,
): string {
  if (inputPayload && typeof inputPayload === "object") {
    const page = (inputPayload as Record<string, unknown>).clientPage;
    if (typeof page === "string" && page.trim()) return page.trim();
  }
  if (extractStoryScopeFromInputPayload(inputPayload)) {
    return `canvas/${projectId}/story-pro`;
  }
  return `canvas/${projectId}`;
}

async function findInflightScopeConflict(
  tx: Prisma.TransactionClient,
  projectId: string,
  nodeId: string,
  storyScope?: CanvasTaskStoryScope,
): Promise<void> {
  const active = await tx.canvasGenerationTask.findMany({
    where: {
      projectId,
      nodeId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
      deletedAt: null,
    },
    select: { inputPayload: true },
  });
  for (const t of active) {
    const existingScope = extractStoryScopeFromInputPayload(t.inputPayload);
    if (storyScopesConflict(storyScope, existingScope)) {
      throw new CanvasProjectError(
        "TASK_ALREADY_INFLIGHT",
        `node ${nodeId} task already in progress`,
        409,
      );
    }
  }
}

/**
 * 同一 nodeId + storyScope 仅允许一条 PENDING/SUBMITTED（防并发双提交）。
 * 须在事务内先占位再调厂商，避免 ensure + create 之间的竞态窗口。
 */
function storyScopeAdvisoryLockKeys(
  projectId: string,
  nodeId: string,
  storyScope?: CanvasTaskStoryScope,
): [number, number] {
  const seed = `${projectId}\0${nodeId}\0${storyScopeKey(storyScope)}`;
  const buf = createHash("sha256").update(seed).digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

export async function createStoryScopedCanvasTask(
  args: {
    projectId: string;
    nodeId: string;
    storyScope?: CanvasTaskStoryScope;
    initialStatus?: "PENDING" | "SUBMITTED" | "QUEUED";
    actorUserId?: string;
    data: Omit<
      Prisma.CanvasGenerationTaskUncheckedCreateInput,
      "projectId" | "nodeId" | "status" | "queuedAt" | "tenantId" | "actorUserId"
    >;
  },
): Promise<CanvasGenerationTask> {
  const status = args.initialStatus ?? "PENDING";
  const actorUserId = args.actorUserId;
  // 事务外解析 scope，缩短持连接时间（resolve 含额外读库，不应占 advisory lock）。
  let tenantId: string | null = null;
  if (actorUserId && status === "QUEUED") {
    const scope = await resolveCanvasProjectTrafficScope(
      args.projectId,
      actorUserId,
    );
    tenantId = scope.tenantId ?? null;
  }

  // 同 (project,node,scope) 由 pg_advisory_xact_lock 串行化，已足够互斥去重，
  // 无需 Serializable（其谓词锁在并发下徒增 P2034 写冲突 → "数据库繁忙，任务未提交"）。
  // 改默认隔离级 + 瞬时错误重试（连接池耗尽 / 写冲突），消除「点几次才成功」。
  return runTxWithRetry(
    () =>
      prisma.$transaction(async (tx) => {
      const [k1, k2] = storyScopeAdvisoryLockKeys(
        args.projectId,
        args.nodeId,
        args.storyScope,
      );
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::int, ${k2}::int)`;

      await findInflightScopeConflict(
        tx,
        args.projectId,
        args.nodeId,
        args.storyScope,
      );
      const payload = args.data.inputPayload;
      const scopePatch =
        args.storyScope &&
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload)
          ? {
              ...(payload as Record<string, unknown>),
              storyScope: args.storyScope,
            }
          : args.storyScope
            ? { storyScope: args.storyScope }
            : payload;

      const archive = promptArchiveFieldsForTask({
        kind: args.data.kind,
        inputPayload: scopePatch,
        textOutput: args.data.textOutput ?? null,
      });

      return tx.canvasGenerationTask.create({
        data: {
          ...args.data,
          ...archive,
          projectId: args.projectId,
          nodeId: args.nodeId,
          status,
          queuedAt: status === "QUEUED" ? new Date() : undefined,
          tenantId: tenantId ?? undefined,
          actorUserId: actorUserId ?? undefined,
          inputPayload: scopePatch as Prisma.InputJsonValue,
        },
      });
      }, CANVAS_DB_TX_OPTIONS),
    { label: "createStoryScopedCanvasTask", maxRetries: 5 },
  );
}
