import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { getMembershipFlags } from "@/lib/membership";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import {
  getMembershipToolAccess,
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
  name: string | null;
  image: string | null;
};

/** 工具站 SSO：须有效产品线；Admin 前台无 bypass，仅后台有权限。 */
export async function getToolsSsoEligibility(userId: string): Promise<ToolsSsoEligibility> {
  const [user, gold, membership, memberAccess, billingPersona] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, name: true, image: true },
    }),
    getGoldMemberAccess(userId),
    getMembershipFlags(userId),
    getMembershipToolAccess(userId),
    getUserBillingPersona(userId),
  ]);
  const isAdmin = user?.role === "ADMIN";
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
    name: user?.name ?? null,
    image: user?.image ?? null,
  };
}
