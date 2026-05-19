import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "平台价目表 — 个人中心",
};

/**
 * 价目表已统一到前台价格公示页（宽表 + AI 试衣阶梯价见 #ai-tryon）。
 * 保留本路由仅用于登录校验与旧链接跳转。
 */
export default async function MyPricingTablePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?next=/account/pricing");
  }
  redirect("/pricing-disclosure?from=account");
}
