/**
 * 平台驾驶舱 · 用量审计对比（平台业务线 vs Gateway 技术线）。
 */
import type { GatewayClientSource } from "@prisma/client";

import { cstBusinessDate } from "@/lib/billing/credit-ops-service";
import {
  normalizePeriod,
  periodQueryBounds,
  type ReconciliationPeriod,
} from "@/lib/finance/reconciliation-v2/period-range";
import { prisma } from "@/lib/prisma";

export type UsageAuditStatus =
  | "OK"
  | "MISSING_GATEWAY"
  | "ORPHAN_GATEWAY"
  | "GATEWAY_ONLY";

export type UsageAuditAppRow = {
  appKey: string;
  appLabel: string;
  platformCount: number;
  gatewayCount: number;
  diff: number;
  status: UsageAuditStatus;
  auditSource: string | null;
};

export type UsageAuditSnapshot = {
  from: string;
  to: string;
  rows: UsageAuditAppRow[];
  alertCount: number;
};

type AuditAppDef = {
  appKey: string;
  appLabel: string;
  auditSource: string | null;
  gatewayClientSource?: GatewayClientSource;
  gatewayToolExcludeAssistant?: boolean;
  gatewayAssistantOnly?: boolean;
};

const AUDIT_APPS: AuditAppDef[] = [
  {
    appKey: "CANVAS",
    appLabel: "Canvas 画布",
    auditSource: "CanvasGenerationTask · SUCCEEDED",
    gatewayClientSource: "CANVAS",
  },
  {
    appKey: "STORY",
    appLabel: "Story 故事",
    auditSource: "StoryGenerationTask · SUCCEEDED",
    gatewayClientSource: "STORY",
  },
  {
    appKey: "TOOL",
    appLabel: "工具站",
    auditSource: "ToolUsageEvent · action=invoke",
    gatewayClientSource: "TOOL",
    gatewayToolExcludeAssistant: true,
  },
  {
    appKey: "ASSISTANT",
    appLabel: "AI 小智",
    auditSource: null,
    gatewayClientSource: "TOOL",
    gatewayAssistantOnly: true,
  },
  {
    appKey: "E_COMMERCE",
    appLabel: "电商工具箱",
    auditSource: null,
    gatewayClientSource: "E_COMMERCE",
  },
  {
    appKey: "QUICK_REPLICA",
    appLabel: "QuickReplica",
    auditSource: null,
    gatewayClientSource: "QUICK_REPLICA",
  },
  {
    appKey: "EXTERNAL",
    appLabel: "外部 / 其他",
    auditSource: null,
    gatewayClientSource: "EXTERNAL",
  },
  {
    appKey: "GATEWAY_CONSOLE",
    appLabel: "Gateway 控制台",
    auditSource: null,
    gatewayClientSource: "GATEWAY_CONSOLE",
  },
];

type TimeBounds = { gte: Date; lte: Date };

function resolveAuditStatus(
  platformCount: number,
  gatewayCount: number,
  hasAuditSource: boolean,
): UsageAuditStatus {
  if (!hasAuditSource) return "GATEWAY_ONLY";
  if (platformCount <= 0 && gatewayCount <= 0) return "OK";
  if (platformCount <= 0 && gatewayCount > 0) return "ORPHAN_GATEWAY";
  const gap = platformCount - gatewayCount;
  const threshold = Math.max(5, Math.round(platformCount * 0.25));
  if (gap > threshold && gatewayCount < platformCount) return "MISSING_GATEWAY";
  return "OK";
}

async function countPlatformByApp(bounds: TimeBounds): Promise<Record<string, number>> {
  const [canvas, story, toolInvoke] = await Promise.all([
    prisma.canvasGenerationTask.count({
      where: {
        status: "SUCCEEDED",
        deletedAt: null,
        completedAt: bounds,
      },
    }),
    prisma.storyGenerationTask.count({
      where: {
        status: "SUCCEEDED",
        completedAt: bounds,
      },
    }),
    prisma.toolUsageEvent.count({
      where: {
        action: "invoke",
        createdAt: bounds,
      },
    }),
  ]);
  return {
    CANVAS: canvas,
    STORY: story,
    TOOL: toolInvoke,
  };
}

async function countGatewayByApp(bounds: TimeBounds): Promise<Record<string, number>> {
  const base = {
    status: "SUCCEEDED" as const,
    submittedAt: bounds,
  };

  const counts: Record<string, number> = {};
  for (const app of AUDIT_APPS) {
    if (app.gatewayAssistantOnly) {
      counts[app.appKey] = await prisma.gatewayRequestLog.count({
        where: {
          ...base,
          clientSource: "TOOL",
          clientPage: { startsWith: "platform-assistant/" },
        },
      });
      continue;
    }
    if (app.gatewayToolExcludeAssistant) {
      counts[app.appKey] = await prisma.gatewayRequestLog.count({
        where: {
          ...base,
          clientSource: "TOOL",
          NOT: { clientPage: { startsWith: "platform-assistant/" } },
        },
      });
      continue;
    }
    if (app.gatewayClientSource) {
      counts[app.appKey] = await prisma.gatewayRequestLog.count({
        where: {
          ...base,
          clientSource: app.gatewayClientSource,
        },
      });
    }
  }
  return counts;
}

function buildRows(
  platform: Record<string, number>,
  gateway: Record<string, number>,
): UsageAuditAppRow[] {
  return AUDIT_APPS.map((app) => {
    const platformCount = platform[app.appKey] ?? 0;
    const gatewayCount = gateway[app.appKey] ?? 0;
    const hasAuditSource = app.auditSource != null;
    return {
      appKey: app.appKey,
      appLabel: app.appLabel,
      platformCount,
      gatewayCount,
      diff: platformCount - gatewayCount,
      status: resolveAuditStatus(platformCount, gatewayCount, hasAuditSource),
      auditSource: app.auditSource,
    };
  }).filter((r) => r.platformCount > 0 || r.gatewayCount > 0 || r.auditSource != null);
}

export async function buildUsageAuditForPeriod(
  period: ReconciliationPeriod,
): Promise<UsageAuditSnapshot> {
  const p = normalizePeriod(period);
  const { from, to } = periodQueryBounds(p);
  const bounds: TimeBounds = { gte: from, lte: to };

  const [platform, gateway] = await Promise.all([
    countPlatformByApp(bounds),
    countGatewayByApp(bounds),
  ]);

  const rows = buildRows(platform, gateway);
  const alertCount = rows.filter(
    (r) => r.status === "MISSING_GATEWAY" || r.status === "ORPHAN_GATEWAY",
  ).length;

  return { from: p.from, to: p.to, rows, alertCount };
}

/** 驾驶舱默认：今日 */
export async function buildUsageAuditSnapshot(input?: {
  now?: Date;
}): Promise<UsageAuditSnapshot> {
  const now = input?.now ?? new Date();
  const today = cstBusinessDate(now);
  return buildUsageAuditForPeriod({ from: today, to: today });
}

/** @internal test helper */
export function resolveUsageAuditStatusForTest(
  platformCount: number,
  gatewayCount: number,
  hasAuditSource: boolean,
): UsageAuditStatus {
  return resolveAuditStatus(platformCount, gatewayCount, hasAuditSource);
}
