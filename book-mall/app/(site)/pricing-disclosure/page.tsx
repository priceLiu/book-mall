import Link from "next/link";
import type { SubscriptionInterval } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { formatPointsAsYuan } from "@/lib/currency";
import { getEffectiveBillablePricesForDisclosure } from "@/lib/pricing-disclosure";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "价格公示与使用说明",
  description:
    "订阅价格、工具按次单价（点数）、最低余额线等运营公示，附典型扣费场景说明。",
};

function intervalLabel(interval: SubscriptionInterval): string {
  return interval === "MONTH" ? "按月" : interval === "YEAR" ? "按年" : String(interval);
}

function actionLabel(action: string | null): string {
  if (action == null || !action.trim()) return "未限定行为（通配该工具）";
  const a = action.trim();
  if (a === "try_on") return "try_on（如 AI 试衣成片）";
  if (a === "invoke") return "invoke（一次生成任务）";
  return a;
}

export default async function PricingDisclosurePage() {
  let billable: Awaited<ReturnType<typeof getEffectiveBillablePricesForDisclosure>> = [];
  let plans: Awaited<ReturnType<typeof prisma.subscriptionPlan.findMany>> = [];
  let config: Awaited<ReturnType<typeof prisma.platformConfig.findUnique>> = null;
  let dbUnavailable = false;

  try {
    const now = new Date();
    ;[billable, plans, config] = await Promise.all([
      getEffectiveBillablePricesForDisclosure(now),
      prisma.subscriptionPlan.findMany({
        where: { active: true },
        orderBy: { interval: "asc" },
      }),
      prisma.platformConfig.findUnique({ where: { id: "default" } }),
    ]);
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("PricingDisclosurePage", e);
    dbUnavailable = true;
  }

  const findPrice = (toolKey: string, action: string | null) =>
    billable.find(
      (r) =>
        r.toolKey === toolKey && (r.action ?? "") === (action ?? ""),
    );

  const aiFit = findPrice("fitting-room__ai-fit", "try_on");
  const tti = findPrice("text-to-image", "invoke");
  const itv = findPrice("image-to-video", "invoke");

  return (
    <main className="container max-w-screen-lg mx-auto px-4 pb-24 pt-8 md:pt-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">价格公示与使用说明</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          以下数据与主站管理后台、计费结算同源；货币为人民币。账户以<strong>点</strong>为单位记账，
          <strong className="text-foreground">1 点 = ¥0.01</strong>（与历史「分」整数口径一致）。
        </p>
      </div>

      {dbUnavailable ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          暂时无法连接数据库，明细无法加载。请稍后再试。
        </p>
      ) : null}

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">一、订阅会员价格</h2>
        <p className="text-sm text-muted-foreground">
          订阅费用于解锁会员身份与普通型权益；<strong className="text-foreground">不可</strong>用钱包余额抵扣。
          如需使用按量工具，请在订阅开通后在个人中心为钱包充值，并满足最低余额线。
        </p>
        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-secondary bg-muted/50">
              <tr>
                <th className="p-3 font-medium">套餐</th>
                <th className="p-3 font-medium">计费周期</th>
                <th className="p-3 font-medium text-right">标价</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-muted-foreground">
                    暂无在售订阅档位。
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} className="border-b border-secondary/80 last:border-0">
                    <td className="p-3">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({p.slug})</span>
                    </td>
                    <td className="p-3 text-muted-foreground">{intervalLabel(p.interval)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      ¥{formatPointsAsYuan(p.pricePoints)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          购买入口参见{" "}
          <Link href="/subscribe" className="text-primary underline">
            订阅与支付
          </Link>
          。
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-lg font-semibold">二、按次扣费单价（工具）</h2>
        <p className="text-sm text-muted-foreground">
          以下单价适用于已标价的工具行为；实际扣费以执行成功为准，与后台「工具管理」配置的生效区间一致。
        </p>
        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-secondary bg-muted/50">
              <tr>
                <th className="p-3 font-medium">工具</th>
                <th className="p-3 font-medium">行为</th>
                <th className="p-3 font-medium text-right">单价（点）</th>
                <th className="p-3 font-medium text-right">单价（元）</th>
                <th className="p-3 font-medium">生效区间（本地时间）</th>
                <th className="p-3 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              {billable.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-muted-foreground">
                    当前无生效中的按次标价。
                  </td>
                </tr>
              ) : (
                billable.map((r) => (
                  <tr key={`${r.toolKey}-${r.action ?? ""}-${r.effectiveFrom.toISOString()}`} className="border-b border-secondary/80 align-top last:border-0">
                    <td className="p-3">
                      <span className="font-medium">{toolKeyToLabel(r.toolKey)}</span>
                      <div className="text-xs text-muted-foreground font-mono">{r.toolKey}</div>
                    </td>
                    <td className="p-3">{actionLabel(r.action)}</td>
                    <td className="p-3 text-right tabular-nums">{r.pricePoints.toLocaleString("zh-CN")}</td>
                    <td className="p-3 text-right tabular-nums">¥{formatPointsAsYuan(r.pricePoints)}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {r.effectiveFrom.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })}
                      {" — "}
                      {r.effectiveTo
                        ? r.effectiveTo.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })
                        : "至今"}
                    </td>
                    <td className="p-3 max-w-[14rem] text-muted-foreground">{r.note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-lg font-semibold">三、平台余额线（参考配置）</h2>
        <p className="text-sm text-muted-foreground">
          使用依赖余额的高阶/按量能力前，可用余额通常须不低于<strong className="text-foreground">最低余额线</strong>
          （运营可在后台调整）。以下为当前配置快照：
        </p>
        {config ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              最低余额线（工具准入）：{" "}
              <span className="tabular-nums font-medium text-foreground">
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

      <section className="mt-12 space-y-4">
        <h2 className="text-lg font-semibold">四、典型使用与扣费案例</h2>
        <p className="text-sm text-muted-foreground">
          以下为常见路径的示例；如果您的账号已开通对应工具且余额充足，单次成功执行将按下表所示从钱包扣点（失败一般不扣费，以各工具内提示为准）。
        </p>
        <ul className="list-disc space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">AI 智能试衣 · 生成一次试衣成片</strong>
            {aiFit ? (
              <>
                ：扣费{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {aiFit.pricePoints.toLocaleString("zh-CN")} 点
                </span>
                （¥{formatPointsAsYuan(aiFit.pricePoints)}）。
              </>
            ) : (
              <>：当前公示表未列出该档单价，请以「按次扣费单价」表或应用内提示为准。</>
            )}
          </li>
          <li>
            <strong className="text-foreground">文生图 · 发起一次生成任务</strong>
            {tti ? (
              <>
                ：扣费{" "}
                <span className="tabular-nums font-medium text-foreground">
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
                <span className="tabular-nums font-medium text-foreground">
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

      <section className="mt-12 rounded-xl border border-secondary bg-muted/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">说明与权利保留</p>
        <p className="mt-2 leading-relaxed">
          单价与订阅价可能随运营策略变更；新价格仅在生效时间之后适用。完整计费与提现规则摘要见首页{" "}
          <Link href="/#billing-policy" className="text-primary underline">
            计费、余额与提现说明
          </Link>
          。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/">返回首页</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/subscribe">去订阅</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
