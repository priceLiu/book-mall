/**
 * Gateway 日志 Token 聚合 — 财务团队/个人列表唯一归口。
 * 与 gateway-log-response-rows 一致：SUCCEEDED 且库内缺 token 时走 resolveGatewayTokenMetrics 回退。
 */
import type { BillingCategory, GatewayRequestLog, Prisma } from "@prisma/client";

import {
  BILLING_CATEGORY_ORDER,
  resolveBillingCategory,
} from "@/lib/billing/billing-category";
import { isTextToVideoInput } from "@/lib/billing/byok-pricing";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import { buildGatewayLogWhereForTeamTenant } from "@/lib/gateway/log-query-scope";
import { prisma } from "@/lib/prisma";

export type GatewayTokenUsageSummary = {
  totalTokens: number;
  textToImageTokens: number;
  imageToVideoTokens: number;
  textToVideoTokens: number;
  videoToVideoTokens: number;
  videoUnderstandingTokens: number;
  ttsTokens: number;
  textTokens: number;
  otherTokens: number;
  seedance20Tokens: number;
  succeededCalls: number;
  callsWithTokens: number;
  callsWithoutTokens: number;
};

export const EMPTY_GATEWAY_TOKEN_USAGE: GatewayTokenUsageSummary = {
  totalTokens: 0,
  textToImageTokens: 0,
  imageToVideoTokens: 0,
  textToVideoTokens: 0,
  videoToVideoTokens: 0,
  videoUnderstandingTokens: 0,
  ttsTokens: 0,
  textTokens: 0,
  otherTokens: 0,
  seedance20Tokens: 0,
  succeededCalls: 0,
  callsWithTokens: 0,
  callsWithoutTokens: 0,
};

const GATEWAY_TOKEN_LOG_SELECT = {
  status: true,
  requestKind: true,
  inputSummary: true,
  resultSummary: true,
  billingCategory: true,
  model: true,
  canonicalModelKey: true,
  totalTokens: true,
  promptTokens: true,
  completionTokens: true,
  hasTokenUsage: true,
  metricsSource: true,
  tenantId: true,
  actorBookUserId: true,
} satisfies Prisma.GatewayRequestLogSelect;

export type GatewayTokenLogRow = Pick<
  GatewayRequestLog,
  keyof typeof GATEWAY_TOKEN_LOG_SELECT
>;

/** Seedance 2.0 模型归口（火山 doubao-seedance-2.0 / KIE bytedance/seedance-2 等）。 */
export function matchesSeedance20ModelKey(modelKey: string | null | undefined): boolean {
  const k = (modelKey ?? "").trim().toLowerCase();
  if (!k) return false;
  if (k === "doubao-seedance-2.0" || k === "bytedance/seedance-2") return true;
  if (k.includes("seedance-2.0") || k.includes("seedance-2-")) return true;
  if (k.includes("bytedance/seedance-2")) return true;
  if (k.includes("seedance") && k.includes("2.0")) return true;
  if (k.includes("seedance-2") && !k.includes("1.5")) return true;
  return false;
}

/** 与 gateway-log-response-rows 对齐的有效 token 数。 */
export function resolveEffectiveLogTotalTokens(log: GatewayTokenLogRow): number {
  if (log.status !== "SUCCEEDED") return 0;

  let totalTokens = log.totalTokens;
  if (!log.hasTokenUsage || !totalTokens || totalTokens <= 0) {
    const tm = resolveGatewayTokenMetrics({
      inputSummary: log.inputSummary,
      resultSummary: log.resultSummary,
      requestKind: log.requestKind,
    });
    if (tm.hasTokenUsage && tm.totalTokens != null && tm.totalTokens > 0) {
      totalTokens = tm.totalTokens;
    }
  }

  return totalTokens != null && totalTokens > 0 ? totalTokens : 0;
}

function addToCategory(
  summary: GatewayTokenUsageSummary,
  category: BillingCategory,
  tokens: number,
) {
  switch (category) {
    case "TEXT_TO_IMAGE":
      summary.textToImageTokens += tokens;
      break;
    case "VIDEO_TO_VIDEO":
      summary.videoToVideoTokens += tokens;
      break;
    case "VIDEO_UNDERSTANDING":
      summary.videoUnderstandingTokens += tokens;
      break;
    case "TTS":
      summary.ttsTokens += tokens;
      break;
    case "TEXT":
      summary.textTokens += tokens;
      break;
    case "OTHER":
      summary.otherTokens += tokens;
      break;
    case "IMAGE_TO_VIDEO":
    default:
      break;
  }
}

export function aggregateGatewayTokenUsageFromLogs(
  logs: GatewayTokenLogRow[],
): GatewayTokenUsageSummary {
  const summary: GatewayTokenUsageSummary = { ...EMPTY_GATEWAY_TOKEN_USAGE };

  for (const log of logs) {
    if (log.status !== "SUCCEEDED") continue;
    summary.succeededCalls += 1;

    const tokens = resolveEffectiveLogTotalTokens(log);
    if (tokens > 0) {
      summary.callsWithTokens += 1;
    } else {
      summary.callsWithoutTokens += 1;
    }

    const category = resolveBillingCategory(log, log.billingCategory);
    if (category === "IMAGE_TO_VIDEO" && log.requestKind === "VIDEO") {
      if (isTextToVideoInput(log.inputSummary)) {
        summary.textToVideoTokens += tokens;
      } else {
        summary.imageToVideoTokens += tokens;
      }
    } else {
      addToCategory(summary, category, tokens);
    }

    summary.totalTokens += tokens;

    const modelKey = log.canonicalModelKey ?? log.model;
    if (matchesSeedance20ModelKey(modelKey)) {
      summary.seedance20Tokens += tokens;
    }
  }

  return summary;
}

export async function fetchGatewayTokenUsage(where: Prisma.GatewayRequestLogWhereInput) {
  const logs = await prisma.gatewayRequestLog.findMany({
    where: { AND: [where, { status: "SUCCEEDED" }] },
    select: GATEWAY_TOKEN_LOG_SELECT,
  });
  return aggregateGatewayTokenUsageFromLogs(logs);
}

export async function fetchTeamGatewayTokenUsage(input: {
  tenantId: string;
  submittedFrom: Date;
  submittedTo: Date;
}) {
  const where = await buildGatewayLogWhereForTeamTenant(input.tenantId, {
    submittedFrom: input.submittedFrom,
    submittedTo: input.submittedTo,
    status: "SUCCEEDED",
  });
  return fetchGatewayTokenUsage(where);
}

export async function fetchUserGatewayTokenUsage(input: {
  bookUserId: string;
  submittedFrom: Date;
  submittedTo: Date;
}) {
  const where: Prisma.GatewayRequestLogWhereInput = {
    actorBookUserId: input.bookUserId,
    submittedAt: { gte: input.submittedFrom, lt: input.submittedTo },
    status: "SUCCEEDED",
  };
  return fetchGatewayTokenUsage(where);
}

/** 团队列表批量聚合（单次查库，按 tenantId 分桶）。 */
export async function batchAggregateTeamGatewayTokenUsage(input: {
  tenantIds: string[];
  submittedFrom: Date;
  submittedTo: Date;
}): Promise<Map<string, GatewayTokenUsageSummary>> {
  const result = new Map<string, GatewayTokenUsageSummary>();
  for (const tenantId of input.tenantIds) {
    result.set(tenantId, { ...EMPTY_GATEWAY_TOKEN_USAGE });
  }
  if (input.tenantIds.length === 0) return result;

  const tenantIdSet = new Set(input.tenantIds);
  const memberships = await prisma.tenantMember.findMany({
    where: { tenantId: { in: input.tenantIds }, status: "ACTIVE" },
    select: { tenantId: true, userId: true },
  });
  const memberIds = [...new Set(memberships.map((m) => m.userId))];
  const teamsByUser = new Map<string, string[]>();
  for (const m of memberships) {
    const cur = teamsByUser.get(m.userId) ?? [];
    cur.push(m.tenantId);
    teamsByUser.set(m.userId, cur);
  }

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      submittedAt: { gte: input.submittedFrom, lt: input.submittedTo },
      OR: [
        { tenantId: { in: input.tenantIds } },
        ...(memberIds.length > 0 ? [{ actorBookUserId: { in: memberIds } }] : []),
      ],
    },
    select: GATEWAY_TOKEN_LOG_SELECT,
  });

  const logsByTenant = new Map<string, GatewayTokenLogRow[]>();
  for (const tenantId of input.tenantIds) {
    logsByTenant.set(tenantId, []);
  }

  for (const log of logs) {
    const targets = new Set<string>();
    if (log.tenantId && tenantIdSet.has(log.tenantId)) {
      targets.add(log.tenantId);
    } else if (log.actorBookUserId) {
      for (const tenantId of teamsByUser.get(log.actorBookUserId) ?? []) {
        if (tenantIdSet.has(tenantId)) targets.add(tenantId);
      }
    }
    for (const tenantId of targets) {
      logsByTenant.get(tenantId)?.push(log);
    }
  }

  for (const [tenantId, tenantLogs] of logsByTenant) {
    result.set(tenantId, aggregateGatewayTokenUsageFromLogs(tenantLogs));
  }

  return result;
}

/** 个人 admin 列表批量聚合。 */
export async function batchAggregateUserGatewayTokenUsage(input: {
  bookUserIds: string[];
  submittedFrom: Date;
  submittedTo: Date;
}): Promise<Map<string, GatewayTokenUsageSummary>> {
  const result = new Map<string, GatewayTokenUsageSummary>();
  for (const userId of input.bookUserIds) {
    result.set(userId, { ...EMPTY_GATEWAY_TOKEN_USAGE });
  }
  if (input.bookUserIds.length === 0) return result;

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      submittedAt: { gte: input.submittedFrom, lt: input.submittedTo },
      actorBookUserId: { in: input.bookUserIds },
    },
    select: GATEWAY_TOKEN_LOG_SELECT,
  });

  const logsByUser = new Map<string, GatewayTokenLogRow[]>();
  for (const userId of input.bookUserIds) {
    logsByUser.set(userId, []);
  }
  for (const log of logs) {
    if (!log.actorBookUserId) continue;
    logsByUser.get(log.actorBookUserId)?.push(log);
  }

  for (const [userId, userLogs] of logsByUser) {
    result.set(userId, aggregateGatewayTokenUsageFromLogs(userLogs));
  }

  return result;
}

export function gatewayTokenUsageToRecord(
  summary: GatewayTokenUsageSummary,
): Record<string, number> {
  return {
    totalTokens: summary.totalTokens,
    textToImageTokens: summary.textToImageTokens,
    imageToVideoTokens: summary.imageToVideoTokens,
    textToVideoTokens: summary.textToVideoTokens,
    videoToVideoTokens: summary.videoToVideoTokens,
    videoUnderstandingTokens: summary.videoUnderstandingTokens,
    ttsTokens: summary.ttsTokens,
    textTokens: summary.textTokens,
    otherTokens: summary.otherTokens,
    seedance20Tokens: summary.seedance20Tokens,
  };
}

export const FINANCE_TOKEN_COLUMN_META = [
  { key: "totalTokens", label: "Token 消耗总量" },
  { key: "textToImageTokens", label: "文生图 Token" },
  { key: "imageToVideoTokens", label: "图生视频 Token" },
  { key: "textToVideoTokens", label: "文生视频 Token" },
  { key: "videoToVideoTokens", label: "视频生视频 Token" },
  { key: "videoUnderstandingTokens", label: "视频理解 Token" },
  { key: "ttsTokens", label: "TTS Token" },
  { key: "textTokens", label: "文字 Token" },
  { key: "seedance20Tokens", label: "Seedance 2.0 Token" },
  { key: "otherTokens", label: "其他 Token" },
] as const;

/** 七类 BillingCategory 与财务 token 列映射说明（文生视频为 IMAGE_TO_VIDEO 子集）。 */
export const BILLING_CATEGORY_TOKEN_KEYS = BILLING_CATEGORY_ORDER.map((category) => ({
  category,
  tokenKey:
    category === "IMAGE_TO_VIDEO"
      ? ["imageToVideoTokens", "textToVideoTokens"]
      : category === "TEXT_TO_IMAGE"
        ? "textToImageTokens"
        : category === "VIDEO_TO_VIDEO"
          ? "videoToVideoTokens"
          : category === "VIDEO_UNDERSTANDING"
            ? "videoUnderstandingTokens"
            : category === "TTS"
              ? "ttsTokens"
              : category === "TEXT"
                ? "textTokens"
                : "otherTokens",
}));
