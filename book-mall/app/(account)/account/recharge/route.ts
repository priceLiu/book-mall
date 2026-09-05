import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { buildLoginRedirectForCheckout } from "@/lib/payments/checkout-login-redirect";
import { resolveCheckoutReturnTo } from "@/lib/payments/checkout-return-to";
import {
  appendReturnToQuery,
  resolveRechargeEntryPath,
} from "@/lib/payments/recharge-entry-route";

export const dynamic = "force-dynamic";

/** 各应用顶栏「积分充值」统一入口：按会员状态分流至轻量包或订阅页 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const returnTo = resolveCheckoutReturnTo(url.searchParams.get("returnTo"));

  const selfQuery = url.searchParams.toString();
  const selfPath = `/account/recharge${selfQuery ? `?${selfQuery}` : ""}`;

  if (!session?.user?.id) {
    redirect(buildLoginRedirectForCheckout(selfPath));
  }

  const target = await resolveRechargeEntryPath(session.user.id);
  redirect(appendReturnToQuery(target, returnTo));
}
