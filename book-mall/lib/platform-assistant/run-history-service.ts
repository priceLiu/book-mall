import type { GatewayRequestStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { clientPageToToolLabel } from "@/lib/finance/client-page-tool";
import { buildPlatformAssistantGatewayLogWhere } from "@/lib/platform-assistant/platform-assistant-billing";

export type PlatformAssistantRunOutcome = "success" | "failed" | "running";

export type PlatformAssistantRunHistoryItem = {
  id: string;
  status: GatewayRequestStatus;
  outcome: PlatformAssistantRunOutcome;
  sceneLabel: string;
  model: string;
  submittedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  failMessage: string | null;
  actorBookUserId: string | null;
};

export type PlatformAssistantRunHistoryFilter = "all" | "success" | "failed" | "running";

function outcomeFromStatus(status: GatewayRequestStatus): PlatformAssistantRunOutcome {
  if (status === "SUCCEEDED") return "success";
  if (status === "FAILED") return "failed";
  return "running";
}

function whereForFilter(filter: PlatformAssistantRunHistoryFilter): Prisma.GatewayRequestLogWhereInput {
  switch (filter) {
    case "success":
      return { status: "SUCCEEDED" };
    case "failed":
      return { status: "FAILED" };
    case "running":
      return { status: { in: ["PENDING", "RUNNING"] } };
    default:
      return {};
  }
}

export async function listPlatformAssistantRunHistory(input?: {
  limit?: number;
  cursorId?: string | null;
  filter?: PlatformAssistantRunHistoryFilter;
}): Promise<{ items: PlatformAssistantRunHistoryItem[]; nextCursorId: string | null }> {
  const limit = Math.min(100, Math.max(1, input?.limit ?? 50));
  const filter = input?.filter ?? "all";
  const cursorId = input?.cursorId?.trim() || null;

  const rows = await prisma.gatewayRequestLog.findMany({
    where: buildPlatformAssistantGatewayLogWhere(whereForFilter(filter)),
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursorId
      ? {
          cursor: { id: cursorId },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      status: true,
      model: true,
      clientPage: true,
      submittedAt: true,
      completedAt: true,
      durationMs: true,
      failMessage: true,
      actorBookUserId: true,
    },
  });

  const page = rows.slice(0, limit);
  const nextCursorId = rows.length > limit ? page[page.length - 1]!.id : null;

  const items: PlatformAssistantRunHistoryItem[] = page.map((row) => ({
    id: row.id,
    status: row.status,
    outcome: outcomeFromStatus(row.status),
    sceneLabel: clientPageToToolLabel(row.clientPage),
    model: row.model,
    submittedAt: row.submittedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    failMessage: row.failMessage,
    actorBookUserId: row.actorBookUserId,
  }));

  return { items, nextCursorId };
}

export async function getPlatformAssistantRunHistorySummary(): Promise<{
  last24hTotal: number;
  last24hSucceeded: number;
  last24hFailed: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const base = buildPlatformAssistantGatewayLogWhere({ submittedAt: { gte: since } });

  const [last24hTotal, last24hSucceeded, last24hFailed] = await Promise.all([
    prisma.gatewayRequestLog.count({ where: base }),
    prisma.gatewayRequestLog.count({
      where: buildPlatformAssistantGatewayLogWhere({
        submittedAt: { gte: since },
        status: "SUCCEEDED",
      }),
    }),
    prisma.gatewayRequestLog.count({
      where: buildPlatformAssistantGatewayLogWhere({
        submittedAt: { gte: since },
        status: "FAILED",
      }),
    }),
  ]);

  return { last24hTotal, last24hSucceeded, last24hFailed };
}
