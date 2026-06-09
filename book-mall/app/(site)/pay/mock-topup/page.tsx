import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "模拟收银 — 积分充值 — AI Mall",
};

/** 钱包充值已退役，重定向至账户账单（积分加油包入口）。 */
export default async function MockTopupPayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Faccount%2Fbilling");
  }
  redirect("/account/billing?topup=credits");
}
