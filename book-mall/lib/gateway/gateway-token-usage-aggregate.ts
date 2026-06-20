/**
 * Gateway 日志用量聚合 — 财务团队/个人列表唯一归口。
 * 按七类计费单位统计：图/试衣=张，视频=秒，文字/TTS/视频理解=千 Token。
 */
import type { BillingCategory, GatewayRequestLog, Prisma } from "@prisma/client";

import {
  BILLING_CATEGORY_ORDER,
  isPortraitLibraryGatewayLog,
  resolveBillingCategory,
} from "@/lib/billing/billing-category";
import { isTextToVideoInput } from "@/lib/billing/byok-pricing";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import {
  resolveBillableImageCountFromLog,
  resolveBillableVideoSecondsFromLog,
} from "@/lib/gateway/log-billing-metrics";
import { buildGatewayLogWhereForTeamTenant } from "@/lib/gateway/log-query-scope";
import { prisma } from "@/lib/prisma";

/** 与 finance-web FinanceGatewayUsage 字段对齐。 */
export type GatewayUsageSummary = {
  textToImageImages: number;
  imageToVideoSeconds: number;
  textToVideoSeconds: number;
  videoToVideoSeconds: number;
  videoUnderstandingKTokens: number;
  ttsKTokens: number;
  textKTokens: number;
  seedance20Seconds: number;
  otherCalls: number;
  succeededCalls: number;
};

/** @deprecated 别名，逐步迁移 */
export type GatewayTokenUsageSummary = GatewayUsageSummary;

export const EMPTY_GATEWAY_USAGE: GatewayUsageSummary = {
  textToImageImages: 0,
  imageToVideoSeconds: 0,
  textToVideoSeconds: 0,
  videoToVideoSeconds: 0,
  videoUnderstandingKTokens: 0,
  ttsKTokens: 0,
  textKTokens: 0,
  seedance20Seconds: 0,
  otherCalls: 0,
  succeededCalls: 0,
};

export const EMPTY_GATEWAY_TOKEN_USAGE = EMPTY_GATEWAY_USAGE;

const GATEWAY_USAGE_LOG_SELECT = {
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
  keyof typeof GATEWAY_USAGE_LOG_SELECT
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

/** LLM 类：厂商 usage 或 prompt 估算 → 千 Token。 */
export function resolveEffectiveLogKTokens(log: GatewayTokenLogRow): number {
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

  if (totalTokens == null || totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens / 1000));
}

/** @deprecated 仅 LLM 类明细仍用；列表聚合请走 resolveBillableUsageForLog。 */
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

function addKTokensToCategory(summary: GatewayUsageSummary, category: BillingCategory, kTokens: number) {
  switch (category) {
    case "VIDEO_UNDERSTANDING":
      summary.videoUnderstandingKTokens += kTokens;
      break;
    case "TTS":
      summary.ttsKTokens += kTokens;
      break;
    case "TEXT":
      summary.textKTokens += kTokens;
      break;
    case "OTHER":
      summary.otherCalls += 1;
      break;
    default:
      break;
  }
}

/** 单条成功日志 → 计费用量（张 / 秒 / 千 Token / 次）。供明细/测试使用。 */
export function resolveBillableUsageForLog(log: GatewayTokenLogRow): {
  category: BillingCategory;
  amount: number;
} {
  const category = resolveBillingCategory(log, log.billingCategory);

  if (isPortraitLibraryGatewayLog(log)) {
    return { category: "OTHER", amount: 1 };
  }

  if (category === "TEXT_TO_IMAGE" || log.requestKind === "IMAGE" || log.requestKind === "TRYON") {
    return { category: "TEXT_TO_IMAGE", amount: resolveBillableImageCountFromLog(log) };
  }

  if (log.requestKind === "VIDEO" || category === "IMAGE_TO_VIDEO" || category === "VIDEO_TO_VIDEO") {
    const seconds = resolveBillableVideoSecondsFromLog(log);
    if (category === "VIDEO_TO_VIDEO") return { category: "VIDEO_TO_VIDEO", amount: seconds };
    if (isTextToVideoInput(log.inputSummary)) return { category: "IMAGE_TO_VIDEO", amount: seconds };
    return { category: "IMAGE_TO_VIDEO", amount: seconds };
  }

  if (category === "VIDEO_UNDERSTANDING" || category === "TTS" || category === "TEXT") {
    return { category, amount: resolveEffectiveLogKTokens(log) };
  }

  return { category: "OTHER", amount: 1 };
}

function addUsageToSummary(summary: GatewayUsageSummary, log: GatewayTokenLogRow) {
  if (isPortraitLibraryGatewayLog(log)) {
    summary.otherCalls += 1;
    return;
  }

  const category = resolveBillingCategory(log, log.billingCategory);

  if (category === "TEXT_TO_IMAGE" || log.requestKind === "IMAGE" || log.requestKind === "TRYON") {
    summary.textToImageImages += resolveBillableImageCountFromLog(log);
    return;
  }

  if (log.requestKind === "VIDEO") {
    const seconds = resolveBillableVideoSecondsFromLog(log);
    if (category === "VIDEO_TO_VIDEO") {
      summary.videoToVideoSeconds += seconds;
    } else if (isTextToVideoInput(log.inputSummary)) {
      summary.textToVideoSeconds += seconds;
    } else {
      summary.imageToVideoSeconds += seconds;
    }
    const modelKey = log.canonicalModelKey ?? log.model;
    if (matchesSeedance20ModelKey(modelKey)) {
      summary.seedance20Seconds += seconds;
    }
    return;
  }

  if (category === "VIDEO_TO_VIDEO") {
    summary.videoToVideoSeconds += resolveBillableVideoSecondsFromLog({
      ...log,
      requestKind: "VIDEO",
    });
    return;
  }

  if (category === "VIDEO_UNDERSTANDING" || category === "TTS" || category === "TEXT") {
    addKTokensToCategory(summary, category, resolveEffectiveLogKTokens(log));
    return;
  }

  summary.otherCalls += 1;
}

export function aggregateGatewayTokenUsageFromLogs(
  logs: GatewayTokenLogRow[],
): GatewayUsageSummary {
  const summary: GatewayUsageSummary = { ...EMPTY_GATEWAY_USAGE };

  for (const log of logs) {
    if (log.status !== "SUCCEEDED") continue;
    summary.succeededCalls += 1;
    addUsageToSummary(summary, log);
  }

  return summary;
}

export async function fetchGatewayTokenUsage(where: Prisma.GatewayRequestLogWhereInput) {
  const logs = await prisma.gatewayRequestLog.findMany({
    where: { AND: [where, { status: "SUCCEEDED" }] },
    select: GATEWAY_USAGE_LOG_SELECT,
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

export async function batchAggregateTeamGatewayTokenUsage(input: {
  tenantIds: string[];
  submittedFrom: Date;
  submittedTo: Date;
}): Promise<Map<string, GatewayUsageSummary>> {
  const result = new Map<string, GatewayUsageSummary>();
  for (const tenantId of input.tenantIds) {
    result.set(tenantId, { ...EMPTY_GATEWAY_USAGE });
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
    select: GATEWAY_USAGE_LOG_SELECT,
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

export async function batchAggregateUserGatewayTokenUsage(input: {
  bookUserIds: string[];
  submittedFrom: Date;
  submittedTo: Date;
}): Promise<Map<string, GatewayUsageSummary>> {
  const result = new Map<string, GatewayUsageSummary>();
  for (const userId of input.bookUserIds) {
    result.set(userId, { ...EMPTY_GATEWAY_USAGE });
  }
  if (input.bookUserIds.length === 0) return result;

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      submittedAt: { gte: input.submittedFrom, lt: input.submittedTo },
      actorBookUserId: { in: input.bookUserIds },
    },
    select: GATEWAY_USAGE_LOG_SELECT,
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
  summary: GatewayUsageSummary,
): Record<string, number> {
  return {
    textToImageImages: summary.textToImageImages,
    imageToVideoSeconds: summary.imageToVideoSeconds,
    textToVideoSeconds: summary.textToVideoSeconds,
    videoToVideoSeconds: summary.videoToVideoSeconds,
    videoUnderstandingKTokens: summary.videoUnderstandingKTokens,
    ttsKTokens: summary.ttsKTokens,
    textKTokens: summary.textKTokens,
    seedance20Seconds: summary.seedance20Seconds,
    otherCalls: summary.otherCalls,
  };
}

export const FINANCE_USAGE_COLUMN_META = [
  { key: "textToImageImages", label: "文生图 · 张" },
  { key: "imageToVideoSeconds", label: "图生视频 · 秒" },
  { key: "textToVideoSeconds", label: "文生视频 · 秒" },
  { key: "videoToVideoSeconds", label: "视频生视频 · 秒" },
  { key: "videoUnderstandingKTokens", label: "视频理解 · 千Token" },
  { key: "ttsKTokens", label: "TTS · 千Token" },
  { key: "textKTokens", label: "文字 · 千Token" },
  { key: "seedance20Seconds", label: "Seedance 2.0 · 秒" },
  { key: "otherCalls", label: "其他 · 次" },
] as const;

/** @deprecated 使用 FINANCE_USAGE_COLUMN_META */
export const FINANCE_TOKEN_COLUMN_META = FINANCE_USAGE_COLUMN_META;

export const BILLING_CATEGORY_USAGE_KEYS = BILLING_CATEGORY_ORDER.map((category) => ({
  category,
  usageKey:
    category === "IMAGE_TO_VIDEO"
      ? ["imageToVideoSeconds", "textToVideoSeconds"]
      : category === "TEXT_TO_IMAGE"
        ? "textToImageImages"
        : category === "VIDEO_TO_VIDEO"
          ? "videoToVideoSeconds"
          : category === "VIDEO_UNDERSTANDING"
            ? "videoUnderstandingKTokens"
            : category === "TTS"
              ? "ttsKTokens"
              : category === "TEXT"
                ? "textKTokens"
                : "otherCalls",
}));

/** @deprecated */
export const BILLING_CATEGORY_TOKEN_KEYS = BILLING_CATEGORY_USAGE_KEYS;
