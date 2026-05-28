import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { getMembershipFlags } from "@/lib/membership";
import { userHasAnyActiveToolService } from "@/lib/tool-service-fee/periods";

export type ToolsSsoEligibility = {
  ok: boolean;
  isAdmin: boolean;
  /** @deprecated Phase D：工具 SSO 不再要求黄金会员；保留字段供 introspect 兼容 */
  gold: Awaited<ReturnType<typeof getGoldMemberAccess>>;
  /** 课程会员计划是否在有效期内（仅课程，不含工具） */
  hasMembershipSubscription: boolean;
  /** @deprecated 单品工具订阅；Phase D 改用 UserToolServicePeriod */
  hasToolProductSubscription: boolean;
  /** 是否至少有一个有效的工具技术服务费周期 */
  hasActiveToolService: boolean;
  /** 兼容 introspect：hasActiveToolService */
  hasActiveSubscription: boolean;
  email: string | null;
  name: string | null;
  image: string | null;
};

/** 工具站 SSO：管理员直通；普通用户须至少一个有效工具技术服务费周期。 */
export async function getToolsSsoEligibility(userId: string): Promise<ToolsSsoEligibility> {
  const [user, gold, membership, hasToolService] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, name: true, image: true },
    }),
    getGoldMemberAccess(userId),
    getMembershipFlags(userId),
    userHasAnyActiveToolService(userId),
  ]);
  const isAdmin = user?.role === "ADMIN";
  const hasMembershipSubscription = membership.hasActiveSubscription;
  const hasToolProductSubscription = membership.hasActiveToolProductSubscription;
  const hasActiveToolService = hasToolService;
  let ok = isAdmin || hasActiveToolService;

  const relaxDev =
    process.env.NODE_ENV === "development" &&
    process.env.TOOLS_SSO_RELAX_MEMBERSHIP?.trim() === "1";

  if (relaxDev && user) {
    if (!ok) {
      console.warn(
        "[tools-sso] TOOLS_SSO_RELAX_MEMBERSHIP=1：开发模式下放行工具站 SSO（无工具技术服务费）",
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
    hasActiveToolService,
    hasActiveSubscription: hasActiveToolService,
    email: user?.email ?? null,
    name: user?.name ?? null,
    image: user?.image ?? null,
  };
}
