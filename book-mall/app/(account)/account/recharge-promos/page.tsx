import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { formatPointsAsYuan } from "@/lib/currency";
import {
  listClaimableRechargeTemplatesForUser,
  listUserRechargeCouponHistory,
} from "@/lib/recharge-coupon";
import { ClaimRechargePromoButton } from "@/components/account/claim-recharge-promo-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "充值优惠 — 个人中心",
};

const STATUS_LABEL: Record<string, string> = {
  UNUSED: "待使用",
  REDEEMED: "已核销",
  EXPIRED: "已过期",
};

export default async function RechargePromosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/recharge-promos");

  const [claimable, history] = await Promise.all([
    listClaimableRechargeTemplatesForUser(session.user.id),
    listUserRechargeCouponHistory(session.user.id, 40),
  ]);

  return (
    <main className="py-10 md:py-14 max-w-3xl mx-auto px-4 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">充值优惠券</h1>
          <p className="text-sm text-muted-foreground mt-1">
            领取后在模拟收银或正式支付时选择核销；未领取或未核销则仅有实付到账。
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/account">返回个人中心</Link>
        </Button>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">可领取活动</h2>
        {claimable.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前没有进行中的领取活动。</p>
        ) : (
          <ul className="space-y-4">
            {claimable.map((t) => {
              const atCap = t.userClaimedCount >= t.maxClaimsPerUser;
              return (
                <li key={t.id}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      <CardDescription className="tabular-nums">
                        实付 ¥{formatPointsAsYuan(t.paidAmountPoints)} · 赠 {t.bonusPoints.toLocaleString("zh-CN")}{" "}
                        点 · 领取期 {t.claimableFrom.toLocaleString("zh-CN")} —{" "}
                        {t.claimableTo.toLocaleString("zh-CN")} · 领取后 {t.validDaysAfterClaim} 天内有效 ·
                        已领 {t.userClaimedCount}/{t.maxClaimsPerUser}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ClaimRechargePromoButton templateId={t.id} disabled={atCap} />
                      {atCap ? (
                        <p className="text-xs text-muted-foreground mt-2">已达该活动领取上限。</p>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">我的优惠券</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无记录。</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-3 font-medium">状态</th>
                  <th className="p-3 font-medium">内容</th>
                  <th className="p-3 font-medium">实付档 / 赠送</th>
                  <th className="p-3 font-medium">有效期至</th>
                  <th className="p-3 font-medium">核销订单</th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="p-3">{STATUS_LABEL[c.status] ?? c.status}</td>
                    <td className="p-3">
                      <span className="font-medium">{c.titleSnap}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{c.templateSlugSnap}</span>
                    </td>
                    <td className="p-3 tabular-nums">
                      ¥{formatPointsAsYuan(c.paidAmountPointsSnap)}
                      <span className="text-muted-foreground">
                        {" "}
                        / +{c.bonusPointsSnap} 点
                      </span>
                    </td>
                    <td className="p-3 tabular-nums text-muted-foreground">
                      {c.expiresAt.toLocaleString("zh-CN")}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {c.orderId ? c.orderId.slice(0, 12) + "…" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        模拟充值入口：{" "}
        <Link href="/pay/mock-topup" className="text-primary underline">
          前往收银台
        </Link>
      </p>
    </main>
  );
}
