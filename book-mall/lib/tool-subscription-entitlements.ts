import { prisma } from "@/lib/prisma";
import {
  TOOL_SUITE_NAV_KEYS,
  type ToolSuiteNavKey,
} from "@/lib/tool-suite-nav-keys";

const ALLOWED = new Set<string>(TOOL_SUITE_NAV_KEYS);

function normalizeAllowlist(raw: string[]): ToolSuiteNavKey[] {
  const out: ToolSuiteNavKey[] = [];
  for (const k of raw) {
    const t = k.trim();
    if (ALLOWED.has(t)) out.push(t as ToolSuiteNavKey);
  }
  return out;
}

/** 单品工具订阅：当前有效周期内的 navKey（去重） */
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

function mergeNavKeys(
  a: ToolSuiteNavKey[],
  b: ToolSuiteNavKey[],
): ToolSuiteNavKey[] {
  const s = new Set<ToolSuiteNavKey>();
  for (const x of a) s.add(x);
  for (const x of b) s.add(x);
  return Array.from(s);
}

/**
 * 解析当前用户可用的工具站分组 navKey。
 * - 会员计划订阅：沿用计划 toolsNavAllowlist（空 = 套件全集）
 * - 单品工具订阅：合并对应 Product.toolNavKey
 */
export async function resolveToolsNavKeysForUser(userId: string): Promise<{
  keys: ToolSuiteNavKey[];
  planName: string | null;
  planSlug: string | null;
}> {
  const relaxMembership =
    process.env.NODE_ENV === "development" &&
    process.env.TOOLS_SSO_RELAX_MEMBERSHIP?.trim() === "1";

  const now = new Date();
  const productKeys = await navKeysFromActiveToolProductSubscriptions(userId);

  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: now },
    },
    orderBy: { currentPeriodEnd: "desc" },
    include: { plan: true },
  });

  let planKeys: ToolSuiteNavKey[] = [];
  let planName: string | null = null;
  let planSlug: string | null = null;

  if (sub) {
    planName = sub.plan.name;
    planSlug = sub.plan.slug;
    const rawList = sub.plan.toolsNavAllowlist ?? [];
    planKeys =
      rawList.length === 0 ? [...TOOL_SUITE_NAV_KEYS] : normalizeAllowlist(rawList);
  }

  const merged = mergeNavKeys(planKeys, productKeys);

  if (merged.length > 0) {
    return { keys: merged, planName, planSlug };
  }

  if (!sub && relaxMembership) {
    return {
      keys: [...TOOL_SUITE_NAV_KEYS],
      planName: null,
      planSlug: null,
    };
  }

  return { keys: [], planName: null, planSlug: null };
}
