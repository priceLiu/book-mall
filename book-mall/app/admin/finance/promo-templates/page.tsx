import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  PromoTemplatesAdminClient,
  type AdminPromoTemplateRow,
} from "@/components/admin/promo-templates-admin-client";

export const metadata = {
  title: "充值优惠模板 — 管理后台",
};

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminPromoTemplatesPage() {
  const rows = await prisma.rechargePromoTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { coupons: true } },
    },
  });

  const templates: AdminPromoTemplateRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    paidAmountPoints: r.paidAmountPoints,
    bonusPoints: r.bonusPoints,
    active: r.active,
    claimableFromLocal: toDatetimeLocalValue(r.claimableFrom),
    claimableToLocal: toDatetimeLocalValue(r.claimableTo),
    validDaysAfterClaim: r.validDaysAfterClaim,
    maxClaimsPerUser: r.maxClaimsPerUser,
    sortOrder: r.sortOrder,
    note: r.note,
    issuedCount: r._count.coupons,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">充值优惠模板</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          配置「充 N 送 M」活动窗口与每用户领取上限；用户领取生成{" "}
          <code className="text-xs">UserRechargeCoupon</code>，充值核销时写入订单{" "}
          <code className="text-xs">meta.topup.rechargeCouponId</code> 以便对账。
          点数口径与工具扣费一致（100 点 = 1 元），可对照{" "}
          <Link href="/admin/tool-apps/manage" className="font-medium text-primary underline-offset-4 hover:underline">
            工具管理 → 按次单价
          </Link>
          。
        </p>
      </div>
      <PromoTemplatesAdminClient templates={templates} />
    </div>
  );
}
