import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { getMembershipFlags } from "@/lib/membership";

export type ToolsSsoEligibility = {
  ok: boolean;
  isAdmin: boolean;
  gold: Awaited<ReturnType<typeof getGoldMemberAccess>>;
  /** 会员计划（月度/年度）是否在有效期内 */
  hasMembershipSubscription: boolean;
  /** 是否有单品工具订阅（有效期内） */
  hasToolProductSubscription: boolean;
  /**
   * 兼容 introspect 字段名：会员计划 **或** 单品工具订阅任一有效即为 true
   * （仍需黄金会员或管理员，见 ok）
   */
  hasActiveSubscription: boolean;
  /** 与 role 同次查询带出，供 introspect 避免第二次 hit User */
  email: string | null;
  name: string | null;
  image: string | null;
};

/** 工具站 SSO：管理员直通；普通用户须黄金会员且（会员计划 **或** 单品工具订阅）有效。 */
export async function getToolsSsoEligibility(userId: string): Promise<ToolsSsoEligibility> {
  const [user, gold, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, name: true, image: true },
    }),
    getGoldMemberAccess(userId),
    getMembershipFlags(userId),
  ]);
  const isAdmin = user?.role === "ADMIN";
  const hasMembershipSubscription = membership.hasActiveSubscription;
  const hasToolProductSubscription = membership.hasActiveToolProductSubscription;
  const hasToolsBillingGate =
    hasMembershipSubscription || hasToolProductSubscription;
  /** introspect / 旧文案沿用字段：任一订阅通路有效 */
  const hasActiveSubscription = hasToolsBillingGate;
  let ok = isAdmin || (gold.isGoldMember && hasToolsBillingGate);

  const relaxDev =
    process.env.NODE_ENV === "development" &&
    process.env.TOOLS_SSO_RELAX_MEMBERSHIP?.trim() === "1";

  if (relaxDev && user) {
    if (!ok) {
      console.warn(
        "[tools-sso] TOOLS_SSO_RELAX_MEMBERSHIP=1：开发模式下放行工具站 SSO（非管理员且非黄金会员）",
      );
    }
    ok = true;
  }

  return {
    ok,
    isAdmin,
    gold,
    hasMembershipSubscription,
    hasToolProductSubscription,
    hasActiveSubscription,
    email: user?.email ?? null,
    name: user?.name ?? null,
    image: user?.image ?? null,
  };
}
