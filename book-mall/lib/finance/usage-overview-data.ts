import type { GatewayClientSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";
import { toolKeyToLabel } from "@/lib/tool-key-label";

export type UsageOverviewFilters = {
  since?: string;
  tool?: string;
  userId?: string;
};

export type UsageAgg = { yuan: number; count: number };

export type UsageOverviewExportLine = {
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  toolKey: string;
  modelKey: string;
  pricingTemplateKey: string | null;
  cloudUnitCostYuan: string | null;
  retailMultiplier: string | null;
  chargedPoints: number | null;
  yuan: number;
};

export type UsageOverviewPayload = {
  filters: { since: string; tool: string; userId: string };
  totalYuan: number;
  totalCount: number;
  byMonth: Array<{ k: string; yuan: number; count: number }>;
  byTool: Array<{ k: string; label: string; yuan: number; count: number }>;
  byModel: Array<{ k: string; yuan: number; count: number }>;
  byUser: Array<{ k: string; label: string; yuan: number; count: number }>;
  recentLines: Array<{
    id: string;
    createdAt: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    toolKey: string;
    modelKey: string;
    pricingTemplateKey: string | null;
    cloudUnitCostYuan: number | null;
    retailMultiplier: number | null;
    chargedPoints: number;
    yuan: number;
  }>;
  exportRows: UsageOverviewExportLine[];
  exportRangeLabel: string;
};

function ymKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const y = x.getUTCFullYear();
  const m = x.getUTCMonth() + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function clientSourceToToolKey(source: GatewayClientSource | null | undefined): string {
  if (!source) return "(unknown)";
  return source.toLowerCase();
}

function bump(m: Map<string, UsageAgg>, k: string, yuan: number) {
  const ex = m.get(k) ?? { yuan: 0, count: 0 };
  ex.yuan += yuan;
  ex.count += 1;
  m.set(k, ex);
}

function sortDesc(m: Map<string, UsageAgg>): Array<{ k: string; yuan: number; count: number }> {
  return Array.from(m.entries())
    .map(([k, v]) => ({ k, ...v }))
    .sort((a, b) => b.yuan - a.yuan || b.count - a.count);
}

function creditsToYuan(credits: number): number {
  return Number((Math.abs(credits) * DEFAULT_CREDIT_ANCHOR_YUAN).toFixed(4));
}

export async function buildUsageOverviewData(
  filters: UsageOverviewFilters,
): Promise<UsageOverviewPayload> {
  const sinceMonth = (filters.since || "").trim();
  const onlyTool = (filters.tool || "").trim().toLowerCase();
  const onlyUserId = (filters.userId || "").trim();

  const now = new Date();
  const defaultSince = new Date(now.getUTCFullYear(), now.getUTCMonth() - 5, 1);
  const sinceCutoff =
    sinceMonth && /^\d{6}$/.test(sinceMonth)
      ? new Date(
          Date.UTC(parseInt(sinceMonth.slice(0, 4), 10), parseInt(sinceMonth.slice(4), 10) - 1, 1),
        )
      : defaultSince;

  const ledgerWhere = {
    type: "CONSUME" as const,
    createdAt: { gte: sinceCutoff },
    account: {
      ownerType: "USER" as const,
      ...(onlyUserId ? { ownerId: onlyUserId } : {}),
    },
  };

  const [ledgerRows, gatewayRows] = await Promise.all([
    prisma.creditLedger.findMany({
      where: ledgerWhere,
      select: {
        id: true,
        createdAt: true,
        credits: true,
        costSnapshotYuan: true,
        refType: true,
        refId: true,
        account: { select: { ownerId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.gatewayRequestLog.findMany({
      where: {
        billingMode: "PLATFORM_CREDIT",
        creditsCharged: { gt: 0 },
        submittedAt: { gte: sinceCutoff },
        ...(onlyUserId ? { actorBookUserId: onlyUserId } : {}),
      },
      select: {
        id: true,
        actorBookUserId: true,
        clientSource: true,
        canonicalModelKey: true,
        model: true,
        billingKind: true,
        creditsCharged: true,
        costSnapshotYuan: true,
        marginSnapshot: true,
        vendorListUnitCostYuan: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: "desc" },
      take: 5000,
    }),
  ]);

  const gatewayById = new Map(gatewayRows.map((g) => [g.id, g]));
  const gatewayIdsFromLedger = new Set(
    ledgerRows
      .filter((l) => l.refType === "gateway_log" && l.refId)
      .map((l) => l.refId as string),
  );

  type LineRow = {
    id: string;
    createdAt: Date;
    userId: string;
    toolKey: string;
    modelKey: string;
    pricingTemplateKey: string | null;
    cloudUnitCostYuan: number | null;
    retailMultiplier: number | null;
    chargedCredits: number;
    yuan: number;
  };

  const lines: LineRow[] = [];

  for (const l of ledgerRows) {
    const userId = l.account.ownerId;
    const credits = Math.abs(l.credits);
    if (credits <= 0) continue;

    const gw =
      l.refType === "gateway_log" && l.refId ? gatewayById.get(l.refId) : undefined;
    const toolKey = clientSourceToToolKey(gw?.clientSource);
    if (onlyTool && toolKey !== onlyTool) continue;

    const modelKey = gw?.canonicalModelKey ?? gw?.model ?? "(unknown)";
    const costSnap =
      l.costSnapshotYuan != null
        ? Number(l.costSnapshotYuan)
        : gw?.costSnapshotYuan != null
          ? Number(gw.costSnapshotYuan)
          : null;
    const margin =
      gw?.marginSnapshot != null ? Number(gw.marginSnapshot) : null;
    const retailMultiplier =
      margin != null && margin < 1 ? Number((1 / (1 - margin)).toFixed(2)) : null;

    lines.push({
      id: l.id,
      createdAt: l.createdAt,
      userId,
      toolKey,
      modelKey,
      pricingTemplateKey: gw?.billingKind ?? null,
      cloudUnitCostYuan: costSnap,
      retailMultiplier,
      chargedCredits: credits,
      yuan: creditsToYuan(credits),
    });
  }

  // 补充仅有 GatewayRequestLog、尚无 ledger 关联的历史行
  for (const g of gatewayRows) {
    if (gatewayIdsFromLedger.has(g.id)) continue;
    const userId = g.actorBookUserId;
    if (!userId) continue;
    const toolKey = clientSourceToToolKey(g.clientSource);
    if (onlyTool && toolKey !== onlyTool) continue;
    const credits = g.creditsCharged ?? 0;
    if (credits <= 0) continue;

    const margin = g.marginSnapshot != null ? Number(g.marginSnapshot) : null;
    lines.push({
      id: g.id,
      createdAt: g.submittedAt,
      userId,
      toolKey,
      modelKey: g.canonicalModelKey ?? g.model,
      pricingTemplateKey: g.billingKind ?? null,
      cloudUnitCostYuan:
        g.costSnapshotYuan != null
          ? Number(g.costSnapshotYuan)
          : g.vendorListUnitCostYuan != null
            ? Number(g.vendorListUnitCostYuan)
            : null,
      retailMultiplier:
        margin != null && margin < 1 ? Number((1 / (1 - margin)).toFixed(2)) : null,
      chargedCredits: credits,
      yuan: creditsToYuan(credits),
    });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(lines.map((l) => l.userId))) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const byMonth = new Map<string, UsageAgg>();
  const byTool = new Map<string, UsageAgg>();
  const byModel = new Map<string, UsageAgg>();
  const byUser = new Map<string, UsageAgg>();
  let totalYuan = 0;
  let totalCount = 0;

  for (const l of lines) {
    totalYuan += l.yuan;
    totalCount += 1;
    bump(byMonth, ymKey(l.createdAt), l.yuan);
    bump(byTool, l.toolKey, l.yuan);
    bump(byModel, l.modelKey, l.yuan);
    bump(byUser, l.userId, l.yuan);
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
      pricingTemplateKey: l.pricingTemplateKey,
      cloudUnitCostYuan: l.cloudUnitCostYuan != null ? l.cloudUnitCostYuan.toFixed(4) : null,
      retailMultiplier: l.retailMultiplier != null ? String(l.retailMultiplier) : null,
      chargedPoints: l.chargedCredits > 0 ? l.chargedCredits : null,
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
        pricingTemplateKey: l.pricingTemplateKey,
        cloudUnitCostYuan: l.cloudUnitCostYuan,
        retailMultiplier: l.retailMultiplier,
        chargedPoints: l.chargedCredits,
        yuan: Number(l.yuan.toFixed(2)),
      };
    });

  return {
    filters: { since: sinceMonth, tool: onlyTool, userId: onlyUserId },
    totalYuan: Number(totalYuan.toFixed(2)),
    totalCount,
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
