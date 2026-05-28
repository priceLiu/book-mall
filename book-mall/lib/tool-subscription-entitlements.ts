import { prisma } from "@/lib/prisma";
import {
  TOOL_SUITE_NAV_KEYS,
  type ToolSuiteNavKey,
} from "@/lib/tool-suite-nav-keys";
import { navKeysFromActiveToolServicePeriods } from "@/lib/tool-service-fee/periods";

const ALLOWED = new Set<string>(TOOL_SUITE_NAV_KEYS);

function normalizeAllowlist(raw: string[]): ToolSuiteNavKey[] {
  const out: ToolSuiteNavKey[] = [];
  for (const k of raw) {
    const t = k.trim();
    if (ALLOWED.has(t)) out.push(t as ToolSuiteNavKey);
  }
  return out;
}

/** @deprecated Phase D：改用 UserToolServicePeriod */
export async function navKeysFromActiveToolProductSubscriptions(
  userId: string,
): Promise<ToolSuiteNavKey[]> {
  const now = new Date();
  const rows = await prisma.userProductSubscription.findMany({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: now },
      product: { kind: "TOOL" },
    },
    select: { product: { select: { toolNavKey: true } } },
  });
  const keys = new Set<ToolSuiteNavKey>();
  for (const r of rows) {
    const k = r.product.toolNavKey?.trim();
    if (k && ALLOWED.has(k)) keys.add(k as ToolSuiteNavKey);
  }
  return Array.from(keys);
}

/**
 * 解析当前用户可用的工具站分组 navKey（Phase D：来自有效工具技术服务费周期）。
 */
export async function resolveToolsNavKeysForUser(userId: string): Promise<{
  keys: ToolSuiteNavKey[];
  planName: string | null;
  planSlug: string | null;
}> {
  const relaxMembership =
    process.env.NODE_ENV === "development" &&
    process.env.TOOLS_SSO_RELAX_MEMBERSHIP?.trim() === "1";

  const serviceKeys = await navKeysFromActiveToolServicePeriods(userId);
  if (serviceKeys.length > 0) {
    return {
      keys: serviceKeys,
      planName: "工具技术服务费",
      planSlug: null,
    };
  }

  if (relaxMembership) {
    return {
      keys: [...TOOL_SUITE_NAV_KEYS],
      planName: null,
      planSlug: null,
    };
  }

  return { keys: [], planName: null, planSlug: null };
}

/** 课程会员计划的 toolsNavAllowlist（仅文档/legacy；Phase D 不再用于工具 navKey） */
export async function coursePlanToolsNavAllowlistLegacy(
  userId: string,
): Promise<ToolSuiteNavKey[]> {
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: now },
    },
    orderBy: { currentPeriodEnd: "desc" },
    include: { plan: true },
  });
  if (!sub) return [];
  const rawList = sub.plan.toolsNavAllowlist ?? [];
  return rawList.length === 0 ? [...TOOL_SUITE_NAV_KEYS] : normalizeAllowlist(rawList);
}
