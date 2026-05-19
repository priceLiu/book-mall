import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPricingTableRowsForDisclosure } from "@/lib/pricing-disclosure";
import { PricingTable } from "@/components/pricing/pricing-table";
import { PricingFormulaCard } from "@/components/pricing/pricing-formula-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "平台价目表 — 个人中心",
};

/**
 * 个人中心 · 平台价目表（与 /pricing-disclosure 同源同表）。
 *
 * 普通用户不展示「云挂牌价（成本）」「M」「公式」三列（仅管理员可见）；公示页仍展示全文。
 */
export default async function MyPricingTablePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?next=/account/pricing");
  }

  const rows = await getPricingTableRowsForDisclosure();
  const showPlatformCostColumns = session.user.role === "ADMIN";

  return (
    <main className="py-8 md:py-10">
      <div className="space-y-6">
        <header className="space-y-1">
          <Link href="/account" className="text-sm text-primary hover:underline">
            ← 返回个人中心
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">平台价目表</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {showPlatformCostColumns ? (
              <>
                以下是工具站各模型的「按次 / 按图 / 按秒」
                <strong className="text-foreground">平台零售价</strong>
                （单位：点；100 点 = 1 元）。
                <br />
                平台零售价 ={" "}
                <strong className="text-foreground">云厂商挂牌价（成本价）× M</strong>
                （当前 M = 2，
                <Link href="/pricing-disclosure" className="text-primary hover:underline">
                  查看完整价格公示
                </Link>
                ）。 实际扣费以调用成功后系统记账为准；下列价格不含税。
              </>
            ) : (
              <>
                以下为各工具模型的<strong className="text-foreground">平台零售价</strong>（单位：点；100 点 =
                ¥1），含<strong className="text-foreground">平台单价</strong>（人民币）与<strong className="text-foreground">点数</strong>。
                实际扣费以调用成功后系统记账为准。
                <br />
                <Link href="/pricing-disclosure" className="text-primary hover:underline">
                  打开完整价格公示
                </Link>
                可查看含成本与系数在内的全部字段。
              </>
            )}
          </p>
        </header>

        <PricingFormulaCard showRetailCoefficient={showPlatformCostColumns} />

        <PricingTable rows={rows} showPlatformCostColumns={showPlatformCostColumns} />
      </div>
    </main>
  );
}
