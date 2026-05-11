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
  const ok = isAdmin || gold.isGoldMember;
  return {
    ok,
    isAdmin,
    gold,
    email: user?.email ?? null,
    name: user?.name ?? null,
    image: user?.image ?? null,
  };
}
