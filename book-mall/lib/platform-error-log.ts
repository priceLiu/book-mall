import { createHash } from "node:crypto";

import type {
  PlatformErrorSeverity,
  PlatformErrorSource,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PlatformErrorContext = {
  userId?: string;
  projectId?: string;
  nodeId?: string;
  taskId?: string;
  gatewayLogId?: string;
  modelKey?: string;
  clientPage?: string;
  endpoint?: string;
  stack?: string;
  [key: string]: unknown;
};

export type RecordPlatformErrorInput = {
  source: PlatformErrorSource;
  severity?: PlatformErrorSeverity;
  code?: string | null;
  message: string;
  detail?: string | null;
  context?: PlatformErrorContext;
};

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function clip(text: string | null | undefined, max: number): string | null {
  const t = text?.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function buildFingerprint(input: RecordPlatformErrorInput): string {
  const ctx = input.context ?? {};
  const parts = [
    input.source,
    input.code ?? "",
    input.message.slice(0, 200),
    ctx.projectId ?? "",
    ctx.nodeId ?? "",
    ctx.modelKey ?? "",
    ctx.endpoint ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

/**
 * 写入平台错误日志（fire-and-forget；5 分钟内同 fingerprint 合并计数）。
 * 供 Gateway finalize、Canvas 任务失败、API catch 等调用。
 */
export function recordPlatformError(input: RecordPlatformErrorInput): void {
  const message = clip(input.message, 2000);
  if (!message) return;

  const fingerprint = buildFingerprint({ ...input, message });
  const detail = clip(input.detail, 8000);
  const context =
    input.context && Object.keys(input.context).length > 0
      ? (input.context as Record<string, unknown>)
      : undefined;

  void (async () => {
    try {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS);
      const existing = await prisma.platformErrorLog.findFirst({
        where: {
          fingerprint,
          createdAt: { gte: since },
          resolvedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, occurrenceCount: true },
      });

      if (existing) {
        await prisma.platformErrorLog.update({
          where: { id: existing.id },
          data: {
            occurrenceCount: existing.occurrenceCount + 1,
            detail: detail ?? undefined,
            context: context ?? undefined,
          },
        });
        return;
      }

      await prisma.platformErrorLog.create({
        data: {
          source: input.source,
          severity: input.severity ?? "ERROR",
          code: clip(input.code, 120),
          message,
          detail,
          context,
          fingerprint,
        },
      });
    } catch (e) {
      console.warn("[platform-error-log] write failed", e);
    }
  })();
}

export function recordGatewayPlatformError(opts: {
  logId: string;
  failCode?: string | null;
  failMessage?: string | null;
  model?: string | null;
  endpoint?: string | null;
  clientPage?: string | null;
  storyTaskId?: string | null;
  userId?: string | null;
}): void {
  const message = opts.failMessage?.trim() || opts.failCode?.trim() || "Gateway 请求失败";
  recordPlatformError({
    source: "GATEWAY",
    code: opts.failCode,
    message,
    detail: opts.failMessage,
    context: {
      gatewayLogId: opts.logId,
      userId: opts.userId ?? undefined,
      taskId: opts.storyTaskId ?? undefined,
      modelKey: opts.model ?? undefined,
      clientPage: opts.clientPage ?? undefined,
      endpoint: opts.endpoint ?? undefined,
    },
  });
}

export function recordCanvasPlatformError(opts: {
  failCode?: string | null;
  failMessage?: string | null;
  projectId?: string | null;
  nodeId?: string | null;
  taskId?: string | null;
  modelKey?: string | null;
  userId?: string | null;
  gatewayLogId?: string | null;
}): void {
  const message = opts.failMessage?.trim() || opts.failCode?.trim() || "Canvas 生成失败";
  recordPlatformError({
    source: "CANVAS",
    code: opts.failCode,
    message,
    detail: opts.failMessage,
    context: {
      userId: opts.userId ?? undefined,
      projectId: opts.projectId ?? undefined,
      nodeId: opts.nodeId ?? undefined,
      taskId: opts.taskId ?? undefined,
      modelKey: opts.modelKey ?? undefined,
      gatewayLogId: opts.gatewayLogId ?? undefined,
    },
  });
}
