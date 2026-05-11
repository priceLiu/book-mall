import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";

export type ToolsSsoEligibility = {
  ok: boolean;
  isAdmin: boolean;
  gold: Awaited<ReturnType<typeof getGoldMemberAccess>>;
  /** 与 role 同次查询带出，供 introspect 避免第二次 hit User */
  email: string | null;
  name: string | null;
  image: string | null;
};

/** 工具站 SSO：黄金会员或主站管理员均可换取令牌（管理员便于开发与运维直通）。 */
export async function getToolsSsoEligibility(userId: string): Promise<ToolsSsoEligibility> {
  const [user, gold] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, name: true, image: true },
    }),
    getGoldMemberAccess(userId),
  ]);
  const isAdmin = user?.role === "ADMIN";
  let ok = isAdmin || gold.isGoldMember;

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
    email: user?.email ?? null,
    name: user?.name ?? null,
    image: user?.image ?? null,
  };
}
