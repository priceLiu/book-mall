import type { Prisma } from "@prisma/client";

import { getPoolBalances } from "@/lib/billing/credit-account-service";
import { K_CREDITS_CONSUMED } from "@/lib/finance/bill-display-keys";
import {
  loadModelDisplayNameMap,
  projectGatewayLogToBillRow,
} from "@/lib/finance/gateway-bill-projection";
import { prisma } from "@/lib/prisma";

export type BillingDetailsTab = "usage" | "charge";

const GATEWAY_SELECT = {
  id: true,
  model: true,
  canonicalModelKey: true,
  requestKind: true,
  status: true,
  clientPage: true,
  billingMode: true,
  billingPersonaSnap: true,
  creditsCharged: true,
  costSnapshotYuan: true,
  marginSnapshot: true,
  submittedAt: true,
  completedAt: true,
  actorBookUserId: true,
} as const;

function parseCredits(cell: string | undefined): number {
  const n = parseInt(cell ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function sumCredits(rows: Record<string, string>[]): number {
  return rows.reduce((s, r) => s + parseCredits(r[K_CREDITS_CONSUMED]), 0);
}

async function buildGatewayRows(input: {
  tab: BillingDetailsTab;
  userId?: string;
  take: number;
}): Promise<{
  rows: Record<string, string>[];
  totalCalls: number;
}> {
  const where: Prisma.GatewayRequestLogWhereInput = {
    ...(input.userId ? { actorBookUserId: input.userId } : {}),
  };

  if (input.tab === "usage") {
    where.status = "SUCCEEDED";
  } else {
    where.creditsCharged = { gt: 0 };
  }

  const logs = await prisma.gatewayRequestLog.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: input.take,
    select: GATEWAY_SELECT,
  });

  const userIds = [...new Set(logs.map((l) => l.actorBookUserId).filter(Boolean))] as string[];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? u.id]));

  const modelKeys = logs.map((l) => l.canonicalModelKey ?? l.model ?? "");
  const displayNames = await loadModelDisplayNameMap(modelKeys, prisma);

  const rows = logs.map((log) => {
    const uid = log.actorBookUserId ?? input.userId ?? "";
    const label = userMap.get(uid) ?? uid;
    return projectGatewayLogToBillRow(log, uid, label, displayNames);
  });

  const totalCalls =
    input.tab === "usage"
      ? logs.length
      : await prisma.gatewayRequestLog.count({
          where: {
            ...(input.userId ? { actorBookUserId: input.userId } : {}),
            status: "SUCCEEDED",
          },
        });

  return { rows, totalCalls };
}

export async function fetchBillingDetailsForUser(input: {
  userId: string;
  tab: BillingDetailsTab;
  take?: number;
}) {
  const take = Math.min(2000, Math.max(1, input.take ?? 500));

  const [user, pools, gatewayPart] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true },
    }),
    getPoolBalances({ ownerType: "USER", ownerId: input.userId }),
    buildGatewayRows({ tab: input.tab, userId: input.userId, take }),
  ]);

  if (!user) return null;

  const balanceCredits = pools.general.balance + pools.video.balance;
  const totalCredits = sumCredits(gatewayPart.rows);

  return {
    source: "finance-2.0",
    tab: input.tab,
    user: { id: user.id, name: user.name, email: user.email },
    balancePoints: balanceCredits,
    poolBalances: {
      general: pools.general.balance,
      video: pools.video.balance,
    },
    totalCalls: gatewayPart.totalCalls,
    totalPoints: totalCredits,
    totalCredits,
    rows: gatewayPart.rows,
  };
}

export async function fetchBillingDetailsAllUsers(input: {
  tab: BillingDetailsTab;
  take?: number;
}) {
  const take = Math.min(2000, Math.max(1, input.take ?? 500));
  const gatewayPart = await buildGatewayRows({ tab: input.tab, take });

  const totalInDb =
    input.tab === "usage"
      ? await prisma.gatewayRequestLog.count({ where: { status: "SUCCEEDED" } })
      : await prisma.gatewayRequestLog.count({ where: { creditsCharged: { gt: 0 } } });

  const totalCredits = sumCredits(gatewayPart.rows);

  return {
    source: "finance-2.0",
    tab: input.tab,
    rows: gatewayPart.rows,
    total: totalInDb,
    returned: gatewayPart.rows.length,
    take,
    truncated: gatewayPart.rows.length < totalInDb,
    totalCalls: gatewayPart.totalCalls,
    totalPoints: totalCredits,
    totalCredits,
  };
}
