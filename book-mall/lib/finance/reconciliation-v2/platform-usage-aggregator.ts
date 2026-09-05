/**
 * GatewayRequestLog → PlatformUsageLine 聚合（对账 v2）。
 */
import { prisma } from "@/lib/prisma";
import { ModelAliasSource } from "@prisma/client";
import { buildReconciliationVendorCodeMap } from "./resolve-model-vendor-map";
import { canonicalKeysByAliases } from "@/lib/model-catalog/resolve";
import { resolveReconciliationVendorCode } from "@/lib/finance/infer-vendor-code";
import { resolveDeepseekReconciliationModelKey } from "@/lib/pricing/deepseek-v4-pricing";

import { isS2vModelKey } from "@/lib/finance/infer-s2v-video-seconds";

import {
  buildJoinKey,
  resolveReconciliationKTokensDirection,
  resolveReconciliationUsage,
  resolveReconciliationVideoSeconds,
  type ReconciliationLogRow,
} from "./billable-units";
import type { PlatformUsageLine, TokenDirection, UnitKind } from "./types";
import { unitNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import {
  calendarDateFromIso,
  dateInPeriod,
  monthLabelFromPeriod,
  normalizePeriod,
  periodFromMonthKeys,
  periodKey as toPeriodKey,
  periodQueryBounds,
  resolvePeriod,
  type ReconciliationPeriod,
} from "./period-range";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function monthFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function logInPeriod(submittedAt: Date, period: ReconciliationPeriod): boolean {
  const day = calendarDateFromIso(submittedAt.toISOString());
  return dateInPeriod(day, period);
}

function asrFileUrlFromInput(inputSummary: unknown): string | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  const input = root.input;
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const url = String(row.fileUrl ?? row.audioUrl ?? "").trim();
  return /^https?:\/\//.test(url) ? url : null;
}

function isAsrFiletransLog(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
}): boolean {
  const m = `${log.model ?? ""} ${log.canonicalModelKey ?? ""}`.toLowerCase();
  return m.includes("asr") || m.includes("filetrans");
}

function s2vAudioUrlFromInput(inputSummary: unknown): string | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  const outer = root.input;
  if (!outer || typeof outer !== "object") return null;
  const inner = (outer as Record<string, unknown>).input;
  if (inner && typeof inner === "object") {
    const row = inner as Record<string, unknown>;
    const url = String(row.audio_url ?? row.audioUrl ?? "").trim();
    if (/^https?:\/\//.test(url)) return url;
  }
  const flat = outer as Record<string, unknown>;
  const url = String(flat.audio_url ?? flat.audioUrl ?? "").trim();
  return /^https?:\/\//.test(url) ? url : null;
}

function isS2vBillableLog(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
}): boolean {
  return isS2vModelKey(log.canonicalModelKey ?? log.model);
}

/** S2V 同一 audio_url 多次尝试时，对账取 billable 最大秒数（贴近阿里按源音频/成片计费）。 */
function buildS2vReconciliationWinnerLogIds(
  logs: Array<{
    id: string;
    submittedAt: Date | null;
    model?: string | null;
    canonicalModelKey?: string | null;
    inputSummary?: unknown;
    resultSummary?: unknown;
    status?: ReconciliationLogRow["status"];
    requestKind?: ReconciliationLogRow["requestKind"];
    billingCategory?: ReconciliationLogRow["billingCategory"];
    pricingTierRaw?: string | null;
  }>,
): Set<string> {
  const byUrl = new Map<string, { id: string; sec: number; at: number }>();
  for (const log of logs) {
    if (!isS2vBillableLog(log)) continue;
    const url = s2vAudioUrlFromInput(log.inputSummary);
    if (!url) continue;
    const sec = resolveReconciliationVideoSeconds(log as ReconciliationLogRow);
    if (sec <= 0) continue;
    const at = log.submittedAt?.getTime() ?? 0;
    const cur = byUrl.get(url);
    if (!cur || sec > cur.sec || (sec === cur.sec && at >= cur.at)) {
      byUrl.set(url, { id: log.id, sec, at });
    }
  }
  return new Set([...byUrl.values()].map((v) => v.id));
}

/** ASR 同一 fileUrl 多次 Gateway 调用时，对账只计 billable 最大的一条（贴近阿里按文件计费）。 */
function buildAsrReconciliationWinnerLogIds(
  logs: Array<{
    id: string;
    submittedAt: Date | null;
    model?: string | null;
    canonicalModelKey?: string | null;
    inputSummary?: unknown;
    resultSummary?: unknown;
    status?: ReconciliationLogRow["status"];
    requestKind?: ReconciliationLogRow["requestKind"];
    billingCategory?: ReconciliationLogRow["billingCategory"];
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    hasTokenUsage?: boolean | null;
    pricingTierRaw?: string | null;
  }>,
): Set<string> {
  const byUrl = new Map<string, { id: string; sec: number; at: number }>();
  for (const log of logs) {
    if (!isAsrFiletransLog(log)) continue;
    const url = asrFileUrlFromInput(log.inputSummary);
    if (!url) continue;
    const sec = resolveReconciliationUsage(log as ReconciliationLogRow).amount;
    if (sec <= 0) continue;
    const at = log.submittedAt?.getTime() ?? 0;
    const cur = byUrl.get(url);
    if (!cur || sec > cur.sec || (sec === cur.sec && at >= cur.at)) {
      byUrl.set(url, { id: log.id, sec, at });
    }
  }
  return new Set([...byUrl.values()].map((v) => v.id));
}

export type AggregatePlatformUsageInput = {
  /** 对账日历区间（优先） */
  period?: ReconciliationPeriod;
  /** @deprecated 转为连续月份的全日历区间 */
  months?: string[];
  cloudAccountIds?: string[];
  userIds?: string[];
  sampleLogLimit?: number;
};

function tokenDirectionForLog(log: ReconciliationLogRow, unitKind: UnitKind): TokenDirection {
  if (unitKind !== "KTOKEN") return "none";
  const pt = log.promptTokens ?? 0;
  const ct = log.completionTokens ?? 0;
  if (pt > 0 && ct <= 0) return "input";
  if (ct > 0 && pt <= 0) return "output";
  return "none";
}

export async function aggregatePlatformUsageForReconciliation(
  input: AggregatePlatformUsageInput,
): Promise<PlatformUsageLine[]> {
  const sampleLimit = input.sampleLogLimit ?? 5;
  const period = normalizePeriod(
    resolvePeriod({ period: input.period, months: input.months }),
  );
  const { from, to } = periodQueryBounds(period);
  const pk = toPeriodKey(period);
  const monthLabel = monthLabelFromPeriod(period);

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      submittedAt: { gte: from, lte: to },
      OR: [
        { status: "SUCCEEDED" },
        {
          status: "FAILED",
          OR: [{ model: "wan2.2-s2v" }, { canonicalModelKey: "wan2.2-s2v" }],
        },
      ],
      ...(input.userIds?.length ? { actorBookUserId: { in: input.userIds } } : {}),
    },
    select: {
      id: true,
      userId: true,
      status: true,
      requestKind: true,
      model: true,
      canonicalModelKey: true,
      pricingModelKey: true,
      billingCategory: true,
      inputSummary: true,
      resultSummary: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      hasTokenUsage: true,
      pricingTierRaw: true,
      creditsCharged: true,
      vendorListUnitCostYuan: true,
      costSnapshotYuan: true,
      estimatedVendorCostYuan: true,
      submittedAt: true,
      actorBookUserId: true,
      providerKind: true,
    },
  });

  const ppcCache = new Map<string, number>();
  async function pricePerCreditForUser(bookUserId: string | null | undefined): Promise<number> {
    const key = bookUserId ?? "_default";
    if (ppcCache.has(key)) return ppcCache.get(key)!;
    let ppc = 0.04;
    if (bookUserId) {
      const acct = await prisma.creditAccount.findFirst({
        where: { ownerType: "USER", ownerId: bookUserId },
        select: { pricePerCreditYuan: true },
      });
      if (acct?.pricePerCreditYuan != null) ppc = num(acct.pricePerCreditYuan);
    }
    ppcCache.set(key, ppc);
    return ppc;
  }

  const listCostCache = new Map<string, number>();
  async function listUnitForModel(
    modelKey: string,
    unitKind: UnitKind,
    tokenDirection: TokenDirection,
    log?: (typeof logs)[number],
  ): Promise<number> {
    const cacheKey = `${modelKey}|${unitKind}|${tokenDirection}`;
    if (listCostCache.has(cacheKey)) return listCostCache.get(cacheKey)!;

    if (log?.vendorListUnitCostYuan != null && num(log.vendorListUnitCostYuan) > 0) {
      const v = num(log.vendorListUnitCostYuan);
      listCostCache.set(cacheKey, v);
      return v;
    }

    const profile = await prisma.modelCostProfile.findFirst({
      where: {
        active: true,
        canonicalModelKey: { in: [modelKey, modelKey === "qwen3.5-flash" ? "qwen-turbo" : modelKey] },
      },
      orderBy: { updatedAt: "desc" },
      select: { listCostYuan: true, inputListCostYuan: true, outputListCostYuan: true },
    });
    let val = 0;
    if (profile) {
      if (unitKind === "KTOKEN" && tokenDirection === "input" && profile.inputListCostYuan != null) {
        val = num(profile.inputListCostYuan);
      } else if (unitKind === "KTOKEN" && tokenDirection === "output" && profile.outputListCostYuan != null) {
        val = num(profile.outputListCostYuan);
      } else if (profile.listCostYuan != null) {
        val = num(profile.listCostYuan);
      }
    }
    listCostCache.set(cacheKey, val);
    return val;
  }

  const netCostCache = new Map<string, number>();
  async function netUnitForModel(
    modelKey: string,
    unitKind: UnitKind,
    tokenDirection: TokenDirection,
    log?: (typeof logs)[number],
  ): Promise<number> {
    const fromLog = log ? unitNetCostYuan(log) : null;
    if (fromLog != null && fromLog > 0) return fromLog;

    const cacheKey = `${modelKey}|${unitKind}|${tokenDirection}|net`;
    if (netCostCache.has(cacheKey)) return netCostCache.get(cacheKey)!;

    const profile = await prisma.modelCostProfile.findFirst({
      where: {
        active: true,
        canonicalModelKey: { in: [modelKey, modelKey === "qwen3.5-flash" ? "qwen-turbo" : modelKey] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        netCostYuan: true,
        listCostYuan: true,
        inputListCostYuan: true,
        outputListCostYuan: true,
        discountRate: true,
      },
    });
    let val = 0;
    if (profile) {
      const discount = num(profile.discountRate);
      const netFromList = (list: unknown) => {
        const l = num(list);
        return l > 0 ? l * (1 - discount) : 0;
      };
      if (unitKind === "KTOKEN" && tokenDirection === "input" && profile.inputListCostYuan != null) {
        val = netFromList(profile.inputListCostYuan);
      } else if (
        unitKind === "KTOKEN" &&
        tokenDirection === "output" &&
        profile.outputListCostYuan != null
      ) {
        val = netFromList(profile.outputListCostYuan);
      } else if (profile.netCostYuan != null) {
        val = num(profile.netCostYuan);
      } else if (profile.listCostYuan != null) {
        val = netFromList(profile.listCostYuan);
      }
    }
    netCostCache.set(cacheKey, val);
    return val;
  }

  const modelAliasInputs = logs.flatMap((log) => {
    const keys = [log.canonicalModelKey, log.model, log.pricingModelKey].filter(Boolean) as string[];
    return keys.map((aliasValue) => ({
      source: ModelAliasSource.VENDOR_RESOURCE_SPEC,
      aliasValue,
    }));
  });
  const modelAliasLookup = await canonicalKeysByAliases(modelAliasInputs);

  /** Gateway `model` 与阿里云 CSV「选型配置」一致时优先用它 join（如 qwen3.5-flash）。 */
  function isVendorSpecModel(model: string): boolean {
    return (
      !model.includes("/") &&
      /^(happyhorse|qwen|wan|text-embedding|cosyvoice|deepseek|pixverse)/i.test(model)
    );
  }

  function resolveLogModelKey(log: (typeof logs)[number]): string {
    const gatewayModel = log.model?.trim();
    if (gatewayModel && isVendorSpecModel(gatewayModel)) return gatewayModel;
    for (const k of [log.canonicalModelKey, log.pricingModelKey, log.model]) {
      if (!k) continue;
      const hit = modelAliasLookup.get(`${ModelAliasSource.VENDOR_RESOURCE_SPEC}::${k}`);
      if (hit) return hit;
    }
    return log.canonicalModelKey ?? log.model ?? "(unknown)";
  }

  const agg = new Map<string, PlatformUsageLine & { _logIds: string[] }>();

  const asrWinnerLogIds = buildAsrReconciliationWinnerLogIds(logs);
  const s2vWinnerLogIds = buildS2vReconciliationWinnerLogIds(logs);

  const resolvedModelKeys = logs.map((log) => resolveLogModelKey(log));
  const vendorCodeMap = await buildReconciliationVendorCodeMap(
    [...new Set(resolvedModelKeys)],
    prisma,
  );

  for (const log of logs) {
    if (!log.submittedAt || !logInPeriod(log.submittedAt, period)) continue;
    if (log.status === "FAILED") {
      const modelKey = log.canonicalModelKey ?? log.model ?? "";
      if (!isS2vModelKey(modelKey)) continue;
      if (resolveReconciliationVideoSeconds(log as ReconciliationLogRow) <= 0) continue;
    }
    if (isAsrFiletransLog(log) && asrFileUrlFromInput(log.inputSummary)) {
      if (!asrWinnerLogIds.has(log.id)) continue;
    }
    if (isS2vBillableLog(log) && s2vAudioUrlFromInput(log.inputSummary)) {
      if (!s2vWinnerLogIds.has(log.id)) continue;
    }
    const row = log as ReconciliationLogRow;
    const usage = resolveReconciliationUsage(row);
    const rawModelKey = resolveLogModelKey(log);
    const catalogVendor = vendorCodeMap.get(rawModelKey);
    const vendorCode = resolveReconciliationVendorCode({
      providerKind: log.providerKind,
      modelKey: rawModelKey,
      catalogVendor,
    });
    const modelKey =
      vendorCode === "deepseek"
        ? resolveDeepseekReconciliationModelKey(rawModelKey)
        : rawModelKey;
    const tierForJoin = vendorCode === "deepseek" ? null : usage.tierRaw;
    const isEmbeddingModel = modelKey.toLowerCase().includes("embedding");

    const directions: TokenDirection[] =
      usage.unitKind === "KTOKEN"
        ? isEmbeddingModel
          ? ["none"]
          : (() => {
            const d = tokenDirectionForLog(row, usage.unitKind);
            if (d !== "none") return [d];
            const pt = log.promptTokens ?? 0;
            const ct = log.completionTokens ?? 0;
            if (pt > 0 && ct > 0) return ["input", "output"] as TokenDirection[];
            if (pt > 0) return ["input"];
            if (ct > 0) return ["output"];
            return ["none"];
          })()
        : ["none"];

    for (const tokenDirection of directions) {
      let amount = usage.amount;
      if (usage.unitKind === "KTOKEN" && tokenDirection !== "none") {
        amount = resolveReconciliationKTokensDirection(row, tokenDirection);
        if (amount <= 0) continue;
      } else if (amount <= 0 && usage.unitKind !== "CALL") {
        continue;
      }

      const joinKey = buildJoinKey({
        vendor: vendorCode,
        modelKey,
        tierRaw: tierForJoin,
        unitKind: usage.unitKind,
        tokenDirection,
        periodKey: pk,
      });

      const credits = num(log.creditsCharged);
      const ppc = await pricePerCreditForUser(log.actorBookUserId ?? log.userId);
      const totalTokens = (log.promptTokens ?? 0) + (log.completionTokens ?? 0);
      const creditShare =
        usage.unitKind === "KTOKEN" &&
        tokenDirection !== "none" &&
        totalTokens > 0
          ? tokenDirection === "input"
            ? (log.promptTokens ?? 0) / totalTokens
            : (log.completionTokens ?? 0) / totalTokens
          : 1;
      const revenue = credits * ppc * creditShare;

      const cur =
        agg.get(joinKey) ??
        ({
          vendor: vendorCode,
          joinKey,
          month: monthLabel,
          period,
          periodKey: pk,
          userId: log.actorBookUserId ?? log.userId,
          modelKey,
          tierRaw: tierForJoin,
          unitKind: usage.unitKind,
          tokenDirection,
          platformUnits: 0,
          listUnitYuan: 0,
          platformListYuan: 0,
          platformNetCostYuan: 0,
          platformCredits: 0,
          platformRevenueYuan: 0,
          callCount: 0,
          sampleLogIds: [],
          _logIds: [],
        } as PlatformUsageLine & { _logIds: string[] });

      cur.platformUnits += amount;
      cur.platformCredits += credits * creditShare;
      cur.platformRevenueYuan += revenue;
      const unitNet = unitNetCostYuan(log);
      if (unitNet != null && unitNet > 0) {
        cur.platformNetCostYuan += unitNet * amount;
      }
      cur.callCount += 1;
      if (cur.listUnitYuan <= 0 && log.vendorListUnitCostYuan != null) {
        cur.listUnitYuan = num(log.vendorListUnitCostYuan);
      }
      cur._logIds.push(log.id);
      if (cur.sampleLogIds.length < sampleLimit) cur.sampleLogIds.push(log.id);
      agg.set(joinKey, cur);
    }
  }

  const lines: PlatformUsageLine[] = [];
  for (const cur of agg.values()) {
    let listUnitYuan = await listUnitForModel(
      cur.modelKey,
      cur.unitKind,
      cur.tokenDirection,
    );
    if (listUnitYuan <= 0) listUnitYuan = cur.listUnitYuan;
    cur.listUnitYuan = listUnitYuan;
    cur.platformListYuan =
      cur.listUnitYuan > 0
        ? Math.round(cur.platformUnits * cur.listUnitYuan * 1e4) / 1e4
        : cur.platformListYuan;
    if (cur.platformNetCostYuan <= 0 && cur.platformUnits > 0) {
      const netUnit = await netUnitForModel(cur.modelKey, cur.unitKind, cur.tokenDirection);
      if (netUnit > 0) {
        cur.platformNetCostYuan = Math.round(cur.platformUnits * netUnit * 1e4) / 1e4;
      }
    } else {
      cur.platformNetCostYuan = Math.round(cur.platformNetCostYuan * 1e4) / 1e4;
    }
    const { _logIds: _, ...line } = cur;
    lines.push(line);
  }

  return lines.sort((a, b) => b.platformListYuan - a.platformListYuan);
}

/** 内存聚合（单测 / 无 DB）。 */
export function aggregatePlatformUsageFromLogs(
  logs: Array<
    ReconciliationLogRow & {
      userId?: string | null;
      submittedAt?: Date;
      creditsCharged?: number;
      pricePerCreditSnapshotYuan?: number;
      costSnapshotYuan?: number;
      estimatedVendorCostYuan?: number;
    }
  >,
  listUnitByModel: Record<string, number> = {},
  netUnitByModel: Record<string, number> = {},
  period?: ReconciliationPeriod,
): PlatformUsageLine[] {
  const resolvedPeriod = period ?? { from: "2026-08-01", to: "2026-08-31" };
  const pk = toPeriodKey(resolvedPeriod);
  const monthLabel = monthLabelFromPeriod(resolvedPeriod);
  const agg = new Map<string, PlatformUsageLine>();

  for (const log of logs) {
    const usage = resolveReconciliationUsage(log);
    const modelKey = log.canonicalModelKey ?? log.model ?? "(unknown)";

    const joinKey = buildJoinKey({
      vendor: "aliyun",
      modelKey,
      tierRaw: usage.tierRaw,
      unitKind: usage.unitKind,
      tokenDirection: "none",
      periodKey: pk,
    });

    const cur =
      agg.get(joinKey) ??
      ({
        vendor: "aliyun",
        joinKey,
        month: monthLabel,
        period: resolvedPeriod,
        periodKey: pk,
        userId: log.userId ?? null,
        modelKey,
        tierRaw: usage.tierRaw,
        unitKind: usage.unitKind,
        tokenDirection: "none",
        platformUnits: 0,
        listUnitYuan: listUnitByModel[modelKey] ?? 0,
        platformListYuan: 0,
        platformNetCostYuan: 0,
        platformCredits: 0,
        platformRevenueYuan: 0,
        callCount: 0,
        sampleLogIds: [],
      } satisfies PlatformUsageLine);

    cur.platformUnits += usage.amount;
    cur.platformCredits += num(log.creditsCharged);
    cur.platformRevenueYuan +=
      num(log.creditsCharged) * num(log.pricePerCreditSnapshotYuan, 0.04);
    const unitNet = unitNetCostYuan(log);
    const netUnit =
      unitNet != null && unitNet > 0 ? unitNet : (netUnitByModel[modelKey] ?? 0);
    if (netUnit > 0) {
      cur.platformNetCostYuan += netUnit * usage.amount;
    }
    cur.callCount += 1;
    if (log.id && cur.sampleLogIds.length < 5) cur.sampleLogIds.push(log.id);
    agg.set(joinKey, cur);
  }

  for (const cur of agg.values()) {
    if (cur.listUnitYuan > 0) {
      cur.platformListYuan = Math.round(cur.platformUnits * cur.listUnitYuan * 1e4) / 1e4;
    }
    cur.platformNetCostYuan = Math.round(cur.platformNetCostYuan * 1e4) / 1e4;
  }

  return [...agg.values()];
}
