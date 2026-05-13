import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMembershipFlags } from "@/lib/membership";
import { prisma } from "@/lib/prisma";

/**
 * 学堂播放器准入：登录 +（管理员 / 有效会员计划 / 有效的课程单品订阅）。
 */
export async function assertCourseLearnAccess(opts?: {
  callbackPath?: string;
  /** 当前课程的 Product.slug（KNOWLEDGE） */
  courseSlug?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const q =
      opts?.callbackPath != null && opts.callbackPath.length > 0
        ? `?callbackUrl=${encodeURIComponent(opts.callbackPath)}`
        : "";
    redirect(`/login${q}`);
  }

  if (session.user.role === "ADMIN") return session;

  const now = new Date();
  const flags = await getMembershipFlags(session.user.id);
  if (flags.hasActiveSubscription) return session;

  const slug = opts?.courseSlug?.trim();
  if (slug) {
    const product = await prisma.product.findFirst({
      where: { slug, kind: "KNOWLEDGE", status: "PUBLISHED" },
      select: { id: true },
    });
    if (product) {
      const row = await prisma.userProductSubscription.findFirst({
        where: {
          userId: session.user.id,
          productId: product.id,
          status: "ACTIVE",
          currentPeriodEnd: { gt: now },
        },
      });
      if (row) return session;
    }
  }

  redirect("/account/subscription/courses");
}
