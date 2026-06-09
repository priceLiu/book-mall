import type { GatewayClientSource, Prisma } from "@prisma/client";

import { K_CREDITS_CONSUMED } from "@/lib/finance/bill-display-keys";
import {
  loadModelDisplayNameMap,
  projectGatewayLogToBillRow,
} from "@/lib/finance/gateway-bill-projection";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";
import { clientPageToToolKey } from "@/lib/finance/client-page-tool";
import { toolKeyToLabel } from "@/lib/tool-key-label";

export type UsageOverviewFilters = {
  since?: string;
  tool?: string;
  userId?: string;
  billingPersona?: string;
  staffFlag?: string;
  tenantId?: string;
};

export type UsageAgg = { yuan: number; count: number; credits: number };

export type UsageOverviewExportLine = {
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  toolKey: string;
  modelKey: string;
  requestKind: string;
  billingPersona: string;
  creditsConsumed: number;
  feeDescription: string;
  yuan: number;
};

export type UsageOverviewPayload = {
  filters: { since: string; tool: string; userId: string };
  totalYuan: number;
  totalCredits: number;
  totalCount: number;
  /** 全部成功调用次数（含 BYOK 0 积分） */
  totalCallsAll: number;
  byMonth: Array<{ k: string; yuan: number; count: number; credits: number }>;
  byTool: Array<{ k: string; label: string; yuan: number; count: number; credits: number }>;
  byModel: Array<{ k: string; yuan: number; count: number; credits: number }>;
  byUser: Array<{ k: string; label: string; yuan: number; count: number; credits: number }>;
  recentLines: Array<{
    id: string;
    createdAt: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    toolKey: string;
    modelKey: string;
    requestKind: string;
    billingPersona: string;
    creditsConsumed: number;
    feeDescription: string;
    yuan: number;
  }>;
  exportRows: UsageOverviewExportLine[];
  exportRangeLabel: string;
};

const GATEWAY_SELECT = {
  id: true,
  actorBookUserId: true,
  clientSource: true,
  clientPage: true,
  canonicalModelKey: true,
  model: true,
  requestKind: true,
  status: true,
  billingMode: true,
  billingPersonaSnap: true,
  creditsCharged: true,
  costSnapshotYuan: true,
  marginSnapshot: true,
  submittedAt: true,
  completedAt: true,
} as const;

function ymKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const y = x.getUTCFullYear();
  const m = x.getUTCMonth() + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function resolveToolKey(input: {
  clientPage?: string | null;
  clientSource?: GatewayClientSource | null;
}): string {
  if (input.clientPage?.trim()) {
    return clientPageToToolKey(input.clientPage);
  }
  if (!input.clientSource) return "(unknown)";
  return input.clientSource.toLowerCase();
}

function bump(m: Map<string, UsageAgg>, k: string, yuan: number, credits: number) {
  const ex = m.get(k) ?? { yuan: 0, count: 0, credits: 0 };
  ex.yuan += yuan;
  ex.count += 1;
  ex.credits += credits;
  m.set(k, ex);
}

function sortDesc(
  m: Map<string, UsageAgg>,
): Array<{ k: string; yuan: number; count: number; credits: number }> {
  return Array.from(m.entries())
    .map(([k, v]) => ({ k, ...v }))
    .sort((a, b) => b.count - a.count || b.credits - a.credits || b.yuan - a.yuan);
}

function creditsToYuan(credits: number): number {
  return Number((Math.abs(credits) * DEFAULT_CREDIT_ANCHOR_YUAN).toFixed(4));
}

function personaLabel(
  persona: string | null | undefined,
  billingMode: string | null | undefined,
): string {
  if (persona === "BYOK" || billingMode === "BYOK") return "自带 Key（BYOK）";
  if (persona === "PLATFORM_CREDIT" || billingMode === "PLATFORM_CREDIT") return "平台代付";
  return "—";
}

const REQUEST_KIND_LABEL: Record<string, string> = {
  CHAT: "对话",
  IMAGE: "生图",
  VIDEO: "生视频",
  TRYON: "AI试衣",
  TTS: "语音",
  OTHER: "其他",
};

export async function buildUsageOverviewData(
  filters: UsageOverviewFilters,
): Promise<UsageOverviewPayload> {
  const sinceMonth = (filters.since || "").trim();
  const onlyTool = (filters.tool || "").trim().toLowerCase();
  const onlyUserId = (filters.userId || "").trim();
  const persona = (filters.billingPersona || "").trim();
  const staffFlag = (filters.staffFlag || "").trim();
  const tenantId = (filters.tenantId || "").trim();

  const now = new Date();
  const defaultSince = new Date(now.getUTCFullYear(), now.getUTCMonth() - 5, 1);
  const sinceCutoff =
    sinceMonth && /^\d{6}$/.test(sinceMonth)
      ? new Date(
          Date.UTC(parseInt(sinceMonth.slice(0, 4), 10), parseInt(sinceMonth.slice(4), 10) - 1, 1),
        )
      : defaultSince;

  const gatewayWhere: Prisma.GatewayRequestLogWhereInput = {
    status: "SUCCEEDED",
    submittedAt: { gte: sinceCutoff },
    ...(onlyUserId ? { actorBookUserId: onlyUserId } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(persona === "BYOK" || persona === "PLATFORM_CREDIT"
      ? { billingMode: persona }
      : {}),
    ...(staffFlag === "1" ? { staffFlag: true } : staffFlag === "0" ? { staffFlag: false } : {}),
  };

  const gatewayLogs = await prisma.gatewayRequestLog.findMany({
    where: gatewayWhere,
    select: GATEWAY_SELECT,
    orderBy: { submittedAt: "desc" },
    take: 5000,
  });

  const userIds = [
    ...new Set(gatewayLogs.map((g) => g.actorBookUserId).filter(Boolean)),
  ] as string[];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const modelKeys = gatewayLogs.map((g) => g.canonicalModelKey ?? g.model ?? "");
  const displayNames = await loadModelDisplayNameMap(modelKeys, prisma);

  type LineRow = {
    id: string;
    createdAt: Date;
    userId: string;
    toolKey: string;
    modelKey: string;
    requestKind: string;
    billingPersona: string;
    creditsConsumed: number;
    feeDescription: string;
    yuan: number;
  };

  const lines: LineRow[] = [];

  for (const g of gatewayLogs) {
    const userId = g.actorBookUserId;
    if (!userId) continue;

    const toolKey = resolveToolKey({
      clientPage: g.clientPage,
      clientSource: g.clientSource,
    });
    if (onlyTool && toolKey !== onlyTool) continue;

    const billRow = projectGatewayLogToBillRow(
      g,
      userId,
      userMap.get(userId)?.name ?? userMap.get(userId)?.email ?? userId,
      displayNames,
    );

    const creditsConsumed = parseInt(billRow[K_CREDITS_CONSUMED] ?? "0", 10) || 0;

    lines.push({
      id: g.id,
      createdAt: g.submittedAt,
      userId,
      toolKey,
      modelKey: g.canonicalModelKey ?? g.model,
      requestKind: REQUEST_KIND_LABEL[g.requestKind] ?? g.requestKind,
      billingPersona: billRow["平台/计费身份"] ?? personaLabel(g.billingPersonaSnap, g.billingMode),
      creditsConsumed,
      feeDescription: billRow["平台账单/费用说明"] ?? "",
      yuan: creditsToYuan(creditsConsumed),
    });
  }

  const byMonth = new Map<string, UsageAgg>();
  const byTool = new Map<string, UsageAgg>();
  const byModel = new Map<string, UsageAgg>();
  const byUser = new Map<string, UsageAgg>();
  let totalYuan = 0;
  let totalCredits = 0;
  let totalCount = 0;

  for (const l of lines) {
    totalYuan += l.yuan;
    totalCredits += l.creditsConsumed;
    if (l.creditsConsumed > 0) totalCount += 1;
    bump(byMonth, ymKey(l.createdAt), l.yuan, l.creditsConsumed);
    bump(byTool, l.toolKey, l.yuan, l.creditsConsumed);
    bump(byModel, l.modelKey, l.yuan, l.creditsConsumed);
    bump(byUser, l.userId, l.yuan, l.creditsConsumed);
  }

  const exportRows: UsageOverviewExportLine[] = lines.map((l) => {
    const u = userMap.get(l.userId);
    return {
      createdAt: l.createdAt.toISOString().replace("T", " ").slice(0, 19),
      userId: l.userId,
      userName: u?.name ?? "",
      userEmail: u?.email ?? "",
      toolKey: l.toolKey,
      modelKey: l.modelKey,
      requestKind: l.requestKind,
      billingPersona: l.billingPersona,
      creditsConsumed: l.creditsConsumed,
      feeDescription: l.feeDescription,
      yuan: Number(l.yuan.toFixed(2)),
    };
  });

  const exportRangeLabel = (() => {
    const parts: string[] = [];
    if (sinceMonth) parts.push(`since-${sinceMonth}`);
    if (onlyTool) parts.push(`tool-${onlyTool.replace(/[^\w-]/g, "_")}`);
    if (onlyUserId) parts.push(`user-${onlyUserId.slice(0, 6)}`);
    return parts.length > 0 ? parts.join("_") : "all";
  })();

  const recentLines = lines
    .slice()
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .slice(0, 50)
    .map((l) => {
      const u = userMap.get(l.userId);
      return {
        id: l.id,
        createdAt: l.createdAt.toISOString().replace("T", " ").slice(0, 19),
        userId: l.userId,
        userName: u?.name ?? null,
        userEmail: u?.email ?? null,
        toolKey: l.toolKey,
        modelKey: l.modelKey,
        requestKind: l.requestKind,
        billingPersona: l.billingPersona,
        creditsConsumed: l.creditsConsumed,
        feeDescription: l.feeDescription,
        yuan: Number(l.yuan.toFixed(2)),
      };
    });

  return {
    filters: { since: sinceMonth, tool: onlyTool, userId: onlyUserId },
    totalYuan: Number(totalYuan.toFixed(2)),
    totalCredits,
    totalCount,
    totalCallsAll: lines.length,
    byMonth: sortDesc(byMonth).slice(0, 12),
    byTool: sortDesc(byTool)
      .slice(0, 20)
      .map((r) => ({
        ...r,
        label: `${toolKeyToLabel(r.k)} · ${r.k}`,
      })),
    byModel: sortDesc(byModel).slice(0, 20),
    byUser: sortDesc(byUser)
      .slice(0, 20)
      .map((r) => {
        const u = userMap.get(r.k);
        return {
          ...r,
          label: u ? `${u.name ?? "(no name)"} · ${u.email ?? ""}` : r.k,
        };
      }),
    recentLines,
    exportRows,
    exportRangeLabel,
  };
}
