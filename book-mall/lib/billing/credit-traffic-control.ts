/**
 * 积分交通疏通。
 *
 * 冻结（reserve）在提交时占用额度，成功 settle、失败 release。
 * 本模块只做检查与处置，不改扣费公式：
 *  - 失败 / 取消 / 日志丢失且已过宽限 → 释放冻结
 *  - 已成功但结算事务没走完，且过了宽限 → 按冻结额补 settle（钱在冻结时已离开可用余额）
 *  - 仍在 RUNNING 且超过时限 → 默认只展示；显式疏通时才释放，成功回调会改走实扣
 */
import type { CreditOwnerType, GatewayRequestStatus } from "@prisma/client";

import {
  adjustCredits,
  releaseReserved,
  settleReserved,
  type AccountRef,
} from "@/lib/billing/credit-account-service";
import { getPrismaDbGateSnapshot, type PrismaDbGateSnapshot } from "@/lib/prisma-db-gate";
import { prisma } from "@/lib/prisma";

export const CREDIT_TRAFFIC_DEFAULTS = {
  lookbackMs: 7 * 24 * 60 * 60 * 1000,
  runningTimeoutMs: 30 * 60 * 1000,
  terminalGraceMs: 2 * 60 * 1000,
};

export type TrafficDisposition =
  | "in_flight"
  | "release"
  | "settle_frozen"
  | "stale_running"
  | "closed";

export function classifyOpenReserve(input: {
  logStatus: GatewayRequestStatus | null;
  ageMs: number;
  hasSettle: boolean;
  hasRelease: boolean;
  runningTimeoutMs?: number;
  terminalGraceMs?: number;
}): TrafficDisposition {
  const runningTimeoutMs = input.runningTimeoutMs ?? CREDIT_TRAFFIC_DEFAULTS.runningTimeoutMs;
  const terminalGraceMs = input.terminalGraceMs ?? CREDIT_TRAFFIC_DEFAULTS.terminalGraceMs;
  if (input.hasSettle || input.hasRelease) return "closed";
  if (input.logStatus == null || input.logStatus === "FAILED" || input.logStatus === "CANCELLED") {
    return input.ageMs >= terminalGraceMs ? "release" : "in_flight";
  }
  if (input.logStatus === "SUCCEEDED") {
    return input.ageMs >= terminalGraceMs ? "settle_frozen" : "in_flight";
  }
  if (input.logStatus === "RUNNING" || input.logStatus === "PENDING") {
    return input.ageMs >= runningTimeoutMs ? "stale_running" : "in_flight";
  }
  return "in_flight";
}

export type TrafficItem = {
  logId: string;
  accountId: string;
  ownerType: CreditOwnerType;
  ownerId: string;
  reservedCredits: number;
  ageMs: number;
  logStatus: GatewayRequestStatus | null;
  requestKind: string | null;
  model: string | null;
  disposition: TrafficDisposition;
};

export type TrafficSnapshot = {
  now: string;
  pool: PrismaDbGateSnapshot;
  counts: Record<TrafficDisposition, number>;
  items: TrafficItem[];
};

function logIdFromReserveKey(key: string | null, refId: string | null): string | null {
  if (key?.startsWith("reserve:")) return key.slice("reserve:".length);
  return refId;
}

export async function inspectCreditTraffic(input?: {
  lookbackMs?: number;
  take?: number;
  now?: Date;
}): Promise<TrafficSnapshot> {
  const now = input?.now ?? new Date();
  const lookbackMs = input?.lookbackMs ?? CREDIT_TRAFFIC_DEFAULTS.lookbackMs;
  const take = Math.min(200, Math.max(1, input?.take ?? 80));
  const since = new Date(now.getTime() - lookbackMs);

  const reserves = await prisma.creditLedger.findMany({
    where: {
      type: "RESERVE",
      idempotencyKey: { startsWith: "reserve:" },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    take: 400,
    select: {
      idempotencyKey: true,
      credits: true,
      createdAt: true,
      refId: true,
      accountId: true,
      account: { select: { ownerType: true, ownerId: true } },
    },
  });

  const logIds = reserves
    .map((r) => logIdFromReserveKey(r.idempotencyKey, r.refId))
    .filter((id): id is string => Boolean(id));

  const closeKeys = logIds.flatMap((id) => [`settle:${id}`, `release:${id}`]);
  const [siblings, logs] = await Promise.all([
    closeKeys.length
      ? prisma.creditLedger.findMany({
          where: { idempotencyKey: { in: closeKeys } },
          select: { idempotencyKey: true },
        })
      : Promise.resolve([]),
    logIds.length
      ? prisma.gatewayRequestLog.findMany({
          where: { id: { in: logIds } },
          select: { id: true, status: true, requestKind: true, model: true },
        })
      : Promise.resolve([]),
  ]);

  const closed = new Set(siblings.map((s) => s.idempotencyKey));
  const logById = new Map(logs.map((l) => [l.id, l]));
  const counts: Record<TrafficDisposition, number> = {
    in_flight: 0,
    release: 0,
    settle_frozen: 0,
    stale_running: 0,
    closed: 0,
  };

  const items: TrafficItem[] = [];
  for (const row of reserves) {
    const logId = logIdFromReserveKey(row.idempotencyKey, row.refId);
    if (!logId) continue;
    const log = logById.get(logId);
    const disposition = classifyOpenReserve({
      logStatus: log?.status ?? null,
      ageMs: now.getTime() - row.createdAt.getTime(),
      hasSettle: closed.has(`settle:${logId}`),
      hasRelease: closed.has(`release:${logId}`),
    });
    counts[disposition] += 1;
    if (disposition === "closed") continue;
    items.push({
      logId,
      accountId: row.accountId,
      ownerType: row.account.ownerType,
      ownerId: row.account.ownerId,
      reservedCredits: Math.abs(Number(row.credits)),
      ageMs: now.getTime() - row.createdAt.getTime(),
      logStatus: log?.status ?? null,
      requestKind: log?.requestKind ?? null,
      model: log?.model ?? null,
      disposition,
    });
  }

  items.sort((a, b) => b.ageMs - a.ageMs);

  return {
    now: now.toISOString(),
    pool: getPrismaDbGateSnapshot(),
    counts,
    items: items.slice(0, take),
  };
}

async function refForLog(logId: string): Promise<{ ref: AccountRef; credits: number } | null> {
  const row = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: `reserve:${logId}` },
    select: {
      credits: true,
      account: { select: { ownerType: true, ownerId: true } },
    },
  });
  if (!row) return null;
  return {
    ref: { ownerType: row.account.ownerType, ownerId: row.account.ownerId },
    credits: Math.abs(Number(row.credits)),
  };
}

export async function releaseFrozenLog(logId: string, description: string) {
  const found = await refForLog(logId);
  if (!found || found.credits <= 0) return { ok: false as const, error: "没有可释放的冻结" };
  const released = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: `release:${logId}` },
    select: { id: true },
  });
  if (released) return { ok: true as const, deduped: true };
  await releaseReserved({
    ref: found.ref,
    credits: found.credits,
    gatewayLogId: logId,
    description,
  });
  return { ok: true as const, deduped: false };
}

export async function settleFrozenLog(logId: string) {
  const found = await refForLog(logId);
  if (!found || found.credits <= 0) return { ok: false as const, error: "没有可结算的冻结" };
  await settleReserved({
    ref: found.ref,
    credits: found.credits,
    gatewayLogId: logId,
    description: "疏通：成功任务按冻结额补结算",
  });
  return { ok: true as const };
}

export type TrafficSweepResult = {
  released: number;
  settled: number;
  skipped: number;
  errors: string[];
};

/** 自动疏通：释放失败冻结、补结成功冻结。超时仍在跑的任务默认不自动放行。 */
export async function sweepCreditTraffic(input?: {
  releaseStaleRunning?: boolean;
  now?: Date;
}): Promise<TrafficSweepResult> {
  const snap = await inspectCreditTraffic({ now: input?.now, take: 200 });
  const result: TrafficSweepResult = { released: 0, settled: 0, skipped: 0, errors: [] };
  for (const item of snap.items) {
    try {
      if (item.disposition === "release") {
        const r = await releaseFrozenLog(item.logId, "疏通：失败或丢失任务释放冻结");
        if (r.ok) result.released += 1;
        else result.errors.push(`${item.logId}: ${r.error}`);
      } else if (item.disposition === "settle_frozen") {
        const r = await settleFrozenLog(item.logId);
        if (r.ok) result.settled += 1;
        else result.errors.push(`${item.logId}: ${r.error}`);
      } else if (item.disposition === "stale_running" && input?.releaseStaleRunning) {
        const r = await releaseFrozenLog(item.logId, "疏通：超时在途任务释放冻结，成功后改实扣");
        if (r.ok) result.released += 1;
        else result.errors.push(`${item.logId}: ${r.error}`);
      } else {
        result.skipped += 1;
      }
    } catch (e) {
      result.errors.push(`${item.logId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

export async function adjustTrafficCredits(input: {
  ownerType: CreditOwnerType;
  ownerId: string;
  credits: number;
  reason: string;
  idempotencyKey: string;
  actorUserId?: string | null;
}) {
  return adjustCredits({
    ref: { ownerType: input.ownerType, ownerId: input.ownerId },
    credits: input.credits,
    idempotencyKey: input.idempotencyKey,
    description: input.reason,
    actorUserId: input.actorUserId,
  });
}
