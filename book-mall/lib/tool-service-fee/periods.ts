import { prisma } from "@/lib/prisma";
import {
  TOOL_SUITE_NAV_KEYS,
  type ToolSuiteNavKey,
} from "@/lib/tool-suite-nav-keys";

const ALLOWED = new Set<string>(TOOL_SUITE_NAV_KEYS);

/** 将已过期的 ACTIVE 周期标记为 EXPIRED */
export async function expireStaleToolServicePeriods(userId?: string): Promise<number> {
  const now = new Date();
  const r = await prisma.userToolServicePeriod.updateMany({
    where: {
      status: "ACTIVE",
      periodEnd: { lte: now },
      ...(userId ? { userId } : {}),
    },
    data: { status: "EXPIRED" },
  });
  return r.count;
}

export type ActiveToolServicePeriod = {
  toolNavKey: ToolSuiteNavKey;
  periodStart: Date;
  periodEnd: Date;
  lastChargedPoints: number | null;
};

export async function getActiveToolServicePeriods(
  userId: string,
): Promise<ActiveToolServicePeriod[]> {
  await expireStaleToolServicePeriods(userId);
  const now = new Date();
  const rows = await prisma.userToolServicePeriod.findMany({
    where: {
      userId,
      status: "ACTIVE",
      periodEnd: { gt: now },
    },
    orderBy: { periodEnd: "desc" },
  });
  const out: ActiveToolServicePeriod[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = r.toolNavKey.trim();
    if (!ALLOWED.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push({
      toolNavKey: k as ToolSuiteNavKey,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      lastChargedPoints: r.lastChargedPoints,
    });
  }
  return out;
}

export async function navKeysFromActiveToolServicePeriods(
  userId: string,
): Promise<ToolSuiteNavKey[]> {
  const periods = await getActiveToolServicePeriods(userId);
  return periods.map((p) => p.toolNavKey);
}

export async function userHasAnyActiveToolService(userId: string): Promise<boolean> {
  const keys = await navKeysFromActiveToolServicePeriods(userId);
  return keys.length > 0;
}
