import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { getMembershipFlags } from "@/lib/membership";
import {
  getMembershipToolAccess,
  invalidateMembershipToolAccessCache,
} from "@/lib/membership-tool-access";

export type ToolsSsoEligibility = {
  ok: boolean;
  isAdmin: boolean;
  billingPersona: "PLATFORM_CREDIT" | "BYOK" | null;
  /** @deprecated Phase D：工具 SSO 不再要求黄金会员；保留字段供 introspect 兼容 */
  gold: Awaited<ReturnType<typeof getGoldMemberAccess>>;
  /** 课程会员计划是否在有效期内（仅课程，不含工具） */
  hasMembershipSubscription: boolean;
  /** @deprecated 单品工具订阅；Phase D 改用 UserToolServicePeriod */
  hasToolProductSubscription: boolean;
  /** 有效会员套餐（个人/团队/BYOK）可进工具站 */
  hasActiveToolService: boolean;
  /** 兼容 introspect：等同 hasActiveToolService */
  hasActiveSubscription: boolean;
  /** 会员套餐展示名（个人/团队/BYOK） */
  membershipPlanName: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  image: string | null;
};

/** introspect / Canvas BFF 热路径：短 TTL 缓存，避免并发占满本进程连接池 */
const SSO_ELIG_CACHE_TTL_MS = 15_000;
const ssoEligCache = new Map<
  string,
  { value: ToolsSsoEligibility; expiresAt: number }
>();

/** 订阅/套餐变更后可调用以立即失效（如支付回调、关联 Key 后）。 */
export function invalidateToolsSsoEligibilityCache(userId?: string): void {
  if (userId) ssoEligCache.delete(userId);
  else ssoEligCache.clear();
  invalidateMembershipToolAccessCache(userId);
}

async function computeToolsSsoEligibility(
  userId: string,
): Promise<ToolsSsoEligibility> {
  /**
   * 顺序执行 + 合并 user/billingPersona 查询，降低与 Canvas autosave 等路由
   * 叠加时的连接池峰值（dev 单进程 limit 有限，Promise.all 曾同时占 5+ 连接）。
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      email: true,
      phone: true,
      name: true,
      image: true,
      billingPersona: true,
      billingPersonaLockedAt: true,
    },
  });
  const billingPersona = user?.billingPersonaLockedAt
    ? user.billingPersona
    : null;

  const memberAccess = await getMembershipToolAccess(userId);
  const gold = await getGoldMemberAccess(userId);
  const membership = await getMembershipFlags(userId);

  const isAdmin =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const hasMembershipSubscription = membership.hasActiveSubscription;
  const hasToolProductSubscription = membership.hasActiveToolProductSubscription;
  const hasActiveToolService = memberAccess.ok;
  let ok = hasActiveToolService;

  const relaxDev =
    process.env.NODE_ENV === "development" &&
    process.env.TOOLS_SSO_RELAX_MEMBERSHIP?.trim() === "1";

  if (relaxDev && user) {
    if (!ok) {
      console.warn(
        "[tools-sso] TOOLS_SSO_RELAX_MEMBERSHIP=1：开发模式下放行工具站 SSO（无会员套餐）",
      );
    }
    ok = true;
  }

  return {
    ok,
    isAdmin,
    billingPersona,
    gold,
    hasMembershipSubscription,
    hasToolProductSubscription,
    hasActiveToolService,
    hasActiveSubscription: hasActiveToolService,
    membershipPlanName: memberAccess.planName,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    name: user?.name ?? null,
    image: user?.image ?? null,
  };
}

/** 工具站 SSO：须有效产品线；Admin 前台无 bypass，仅后台有权限。 */
export async function getToolsSsoEligibility(
  userId: string,
): Promise<ToolsSsoEligibility> {
  const nowMs = Date.now();
  const cached = ssoEligCache.get(userId);
  if (cached && cached.expiresAt > nowMs) return cached.value;

  const value = await computeToolsSsoEligibility(userId);
  ssoEligCache.set(userId, {
    value,
    expiresAt: nowMs + SSO_ELIG_CACHE_TTL_MS,
  });
  return value;
}
