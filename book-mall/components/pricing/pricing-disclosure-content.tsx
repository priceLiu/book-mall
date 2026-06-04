import Link from "next/link";
import { Suspense } from "react";
import type { SubscriptionInterval } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { formatPointsAsYuan } from "@/lib/currency";
import { resolveShowPricingInternals } from "@/lib/pricing-disclosure-view";
import {
  getAiTryonPricingTableRowsForDisclosure,
  getNonAiTryonPricingTableRowsForDisclosure,
} from "@/lib/pricing-disclosure";
import { PricingDisclosureRouteSync } from "@/components/pricing/pricing-disclosure-route-sync";
import { PricingDisclosureMeteredSection } from "@/components/pricing/pricing-disclosure-metered";
import { BillingPolicySection } from "@/components/layout/sections/billing-policy";
import { SubscriptionPlansTable } from "@/components/pricing/subscription-plans-table";
import { Button } from "@/components/ui/button";

function intervalLabel(interval: SubscriptionInterval): string {
  return interval === "MONTH" ? "按月" : interval === "YEAR" ? "按年" : String(interval);
}

type Props = {
  /** 个人中心内嵌：隐藏云成本/公式，且不展示站内顶栏布局 */
  fromAccount?: boolean;
  /** 嵌入个人中心壳：收窄页脚、链回 /account */
  embedded?: boolean;
};

export async function PricingDisclosureContent({
  fromAccount = false,
  embedded = false,
}: Props) {
  const session = await getServerSession(authOptions);
  const showPricingInternals = resolveShowPricingInternals({
    fromAccount,
    isAdmin: session?.user?.role === "ADMIN",
  });

  let otherToolRows: Awaited<ReturnType<typeof getNonAiTryonPricingTableRowsForDisclosure>> = [];
  let aiTryonRows: Awaited<ReturnType<typeof getAiTryonPricingTableRowsForDisclosure>> = [];
  let plans: Awaited<ReturnType<typeof prisma.subscriptionPlan.findMany>> = [];
  let config: Awaited<ReturnType<typeof prisma.platformConfig.findUnique>> = null;
  let dbUnavailable = false;

  try {
    [otherToolRows, aiTryonRows, plans, config] = await Promise.all([
      getNonAiTryonPricingTableRowsForDisclosure(),
      getAiTryonPricingTableRowsForDisclosure(),
      prisma.subscriptionPlan.findMany({
        where: { active: true },
        orderBy: { interval: "asc" },
      }),
      prisma.platformConfig.findUnique({ where: { id: "default" } }),
    ]);
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("PricingDisclosureContent", e);
    dbUnavailable = true;
  }

  const findPrice = (
    list: typeof otherToolRows,
    toolKey: string,
    action: string | null,
  ) => list.find((r) => r.toolKey === toolKey && (r.action ?? "") === (action ?? ""));

  const aiFitBase = aiTryonRows.find(
    (r) => r.schemeARefModelKey === "aitryon" && !(r.cloudTierRaw ?? "").trim(),
  );
  const tti = findPrice(otherToolRows, "text-to-image", "invoke");
  const itv = findPrice(otherToolRows, "image-to-video", "invoke");

  const subscriptionPlanRows = plans.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    intervalLabel: intervalLabel(p.interval),
    priceDisplay: `¥${formatPointsAsYuan(p.pricePoints)}`,
  }));

  const Wrapper = embedded ? "div" : "main";
  const wrapperClass = embedded
    ? "space-y-10 pb-8"
    : "container mx-auto max-w-screen-2xl px-4 pb-24 pt-8 md:pt-12";

  return (
    <Wrapper className={wrapperClass}>
      {!embedded && !fromAccount ? (
        <Suspense fallback={null}>
          <PricingDisclosureRouteSync />
        </Suspense>
      ) : null}
      {!embedded ? (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            价格公示与使用说明
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            以下数据与主站管理后台、计费结算同源；货币为人民币。账户以<strong>点</strong>
            为单位记账，
            <strong className="text-foreground">1 点 = ¥0.01</strong>
            （与历史「分」整数口径一致）。
            {showPricingInternals ? (
              <>
                <br />
                平台零售价 ={" "}
                <strong className="text-foreground">云厂商挂牌价（成本价）× M</strong>
                ；当前 M = 2（每个模型 / 档位独立公示）。
              </>
            ) : (
              <>
                <br />
                按次工具价目见下文「平台单价」与「点数」列；实际扣费以调用成功为准。
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          以下数据与主站管理后台、计费结算同源；货币为人民币。账户以<strong>点</strong>
          为单位记账，
          <strong className="text-foreground">1 点 = ¥0.01</strong>。按次工具价目见下文；实际扣费以调用成功为准。
        </p>
      )}

      {dbUnavailable ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          暂时无法连接数据库，明细无法加载。请稍后再试。
        </p>
      ) : null}

      <section className={embedded ? "space-y-4" : "mt-10 space-y-4"}>
        <h2 className="text-lg font-semibold">一、订阅会员价格</h2>
        <p className="text-sm text-muted-foreground">
          订阅费用于解锁会员身份与普通型权益；
          <strong className="text-foreground">不可</strong>用钱包余额抵扣。 如需使用按量工具，请在订阅开通后在个人中心为钱包充值，并满足最低余额线。
        </p>
        <SubscriptionPlansTable rows={subscriptionPlanRows} />
        <p className="text-xs text-muted-foreground">
          购买入口参见{" "}
          <Link href="/subscribe" className="text-primary underline">
            订阅与支付
          </Link>
          。
        </p>
      </section>

      <PricingDisclosureMeteredSection
        aiTryonRows={aiTryonRows}
        otherToolRows={otherToolRows}
        minBilledVideoSec={config?.minBilledVideoSec ?? 5}
        showPricingInternals={showPricingInternals}
      />

      <section className={embedded ? "space-y-4" : "mt-12 space-y-4"}>
        <h2 className="text-lg font-semibold">三、平台余额线（参考配置）</h2>
        <p className="text-sm text-muted-foreground">
          使用依赖余额的高阶/按量能力前，可用余额通常须不低于
          <strong className="text-foreground">最低余额线</strong>
          （运营可在后台调整）。以下为当前配置快照：
        </p>
        {config ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              最低余额线（工具准入）：{" "}
              <span className="font-medium tabular-nums text-foreground">
                {config.minBalanceLinePoints.toLocaleString("zh-CN")} 点
              </span>
              （¥{formatPointsAsYuan(config.minBalanceLinePoints)}）
            </li>
            <li>
              较高 / 中等预警线（参考）：{" "}
              <span className="tabular-nums">
                {config.balanceWarnHighPoints.toLocaleString("zh-CN")} /{" "}
                {config.balanceWarnMidPoints.toLocaleString("zh-CN")} 点
              </span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">暂无配置数据。</p>
        )}
      </section>

      <section className={embedded ? "space-y-4" : "mt-12 space-y-4"}>
        <h2 className="text-lg font-semibold">四、典型使用与扣费案例</h2>
        <p className="text-sm text-muted-foreground">
          以下为常见路径的示例；如果您的账号已开通对应工具且余额充足，单次成功执行将按下表所示从钱包扣点（失败一般不扣费，以各工具内提示为准）。
        </p>
        <ul className="list-disc space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">AI 智能试衣 · 生成一次试衣成片</strong>
            （基础版 <code className="text-xs">aitryon</code>，详见{" "}
            <Link href="#ai-tryon" className="text-primary underline">
              第二节 · AI 试衣完整价目
            </Link>
            ）
            {aiFitBase ? (
              <>
                ：扣费{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {aiFitBase.pricePoints.toLocaleString("zh-CN")} 点
                </span>
                （¥{formatPointsAsYuan(aiFitBase.pricePoints)}）。Plus / 分割 / 精修等模型见上表各档。
              </>
            ) : (
              <>：请以「AI 试衣模型单价」表或应用内提示为准。</>
            )}
          </li>
          <li>
            <strong className="text-foreground">文生图 · 发起一次生成任务</strong>
            {tti ? (
              <>
                ：扣费{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {tti.pricePoints.toLocaleString("zh-CN")} 点
                </span>
                （¥{formatPointsAsYuan(tti.pricePoints)}）。
              </>
            ) : (
              <>：当前公示表未列出该档单价，请以「按次扣费单价」表或应用内提示为准。</>
            )}
          </li>
          <li>
            <strong className="text-foreground">图生视频 · 发起一次生成任务</strong>
            {itv ? (
              <>
                ：扣费{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {itv.pricePoints.toLocaleString("zh-CN")} 点
                </span>
                （¥{formatPointsAsYuan(itv.pricePoints)}）。
              </>
            ) : (
              <>：当前公示表未列出该档单价，请以「按次扣费单价」表或应用内提示为准。</>
            )}
          </li>
          <li>
            <strong className="text-foreground">仅浏览「我的图库 / 视频库 / 费用明细」等</strong>
            ：一般不产生按次扣费；若某页挂载了大模型分析等能力，以该页实际调用为准。
          </li>
        </ul>
      </section>

      <BillingPolicySection />

      <section className="rounded-xl border border-secondary bg-muted/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">说明与权利保留</p>
        <p className="mt-2 leading-relaxed">
          单价与订阅价可能随运营策略变更；新价格仅在生效时间之后适用。完整计费与提现规则摘要见本页{" "}
          <Link href="#billing-policy" className="text-primary underline">
            计费、余额与提现说明
          </Link>
          。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {embedded ? (
            <Button asChild variant="subscription" size="sm">
              <Link href="/account">返回概览</Link>
            </Button>
          ) : (
            <Button asChild variant="subscription" size="sm">
              <Link href="/">返回首页</Link>
            </Button>
          )}
          <Button asChild variant="subscription" size="sm">
            <Link href="/subscribe">去订阅</Link>
          </Button>
        </div>
      </section>
    </Wrapper>
  );
}
