import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { formatMinorAsYuan } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscribeHashScroll, SubscribePlanButton } from "@/components/subscribe/subscribe-client";
import type { SubscriptionPlan } from "@prisma/client";

export const metadata = {
  title: "订阅与支付",
  description: "开通会员订阅，使用 AI 课程与应用服务；余额充值说明。",
};

function AiAppsRechargeNotice() {
  return (
    <div className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-4 text-left shadow-sm dark:border-amber-400/50 dark:bg-amber-950/40">
      <p className="text-base font-semibold text-amber-950 dark:text-amber-100 md:text-lg">
        使用 AI 应用前：须为订阅会员，并完成钱包充值
      </p>
      <p className="mt-3 text-sm leading-relaxed text-amber-900/95 dark:text-amber-200/95">
        <span className="font-medium text-amber-950 dark:text-amber-50">说明：</span>
        AI
        应用按调用计费，账户需有可用余额方可发起推理与工具调用；请先开通「月度 / 年度」订阅获得会员身份，再在个人中心为钱包充值，并满足平台公示的最低余额线。
      </p>
      <p className="mt-3 text-sm leading-relaxed text-amber-900/95 dark:text-amber-200/95">
        <span className="font-medium text-amber-950 dark:text-amber-50">充值款项用途：</span>
        您充入钱包的金额，将用于支付使用中产生的{" "}
        <span className="font-medium text-foreground/90 dark:text-amber-100">
          大模型推理与资源消耗费用
        </span>{" "}
        （按用量结算给上游模型服务），以及平台提供的{" "}
        <span className="font-medium text-foreground/90 dark:text-amber-100">技术服务费</span>
        （含接入、调度、安全与产品运维等）；具体扣费规则以各应用内说明与账单为准。
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="font-medium text-amber-950 dark:text-amber-50">过渡演示：</span>
        <Button asChild size="sm" variant="secondary">
          <Link href="/pay/mock-topup">模拟收银充值</Link>
        </Button>
        <span className="text-amber-900/90 dark:text-amber-200/90">
          （¥50 / ¥100 / ¥200，到账后在个人中心与后台订单可见）
        </span>
      </p>
    </div>
  );
}

export default async function SubscribePage() {
  let monthly: SubscriptionPlan | null = null;
  let yearly: SubscriptionPlan | null = null;
  let dbUnavailable = false;
  try {
    [monthly, yearly] = await Promise.all([
      prisma.subscriptionPlan.findFirst({
        where: { slug: "monthly", active: true },
      }),
      prisma.subscriptionPlan.findFirst({
        where: { slug: "yearly", active: true },
      }),
    ]);
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("SubscribePage", e);
    dbUnavailable = true;
  }

  return (
    <main className="container max-w-screen-lg mx-auto px-4 pb-24 pt-8 md:pt-12">
      <SubscribeHashScroll />
      {dbUnavailable ? (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          暂时无法连接数据库，订阅价格可能无法显示。请检查网络与 Neon 后刷新。
        </p>
      ) : null}

      <section
        id="courses-intro"
        className="mb-14 scroll-mt-28 space-y-4 rounded-2xl border border-secondary bg-card/50 p-6 md:p-8"
      >
        <h2 className="text-xl font-semibold md:text-2xl">AI 课程</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          智选 AI
          课程体系覆盖从入门到进阶的系统化学习路径：结构化视频与图文、实战演练与阶段测验，帮助你在可控时间内建立可用的 AI
          工作流。订阅会员可解锁对应档位的课程浏览与下载权益；部分高阶实训与答疑可能另需余额或定制方案。
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          适合希望<span className="text-foreground font-medium">系统提升</span>
          、需要固定学习节奏与大纲背书的个人与小型团队。{" "}
          <Link href="/products/ai-courses" className="text-primary underline-offset-4 hover:underline">
            查看已上架课程
          </Link>
        </p>
      </section>

      <section
        id="apps-intro"
        className="mb-14 scroll-mt-28 space-y-4 rounded-2xl border border-secondary bg-card/50 p-6 md:p-8"
      >
        <h2 className="text-xl font-semibold md:text-2xl">AI 应用</h2>
        <AiAppsRechargeNotice />
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          工具型产品提供在线推理、结构化内容生成与工作流编排等能力。除订阅会员身份外，按量与工具调用依赖钱包余额；不满足条件时应用将无法正常使用，请以下方「选择订阅」开通会员，并在个人中心充值。
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          <Link href="/products/ai-apps" className="text-primary underline-offset-4 hover:underline">
            浏览 AI 应用列表与计费说明
          </Link>
        </p>
      </section>

      <h2 className="mb-6 text-center text-lg font-semibold md:text-xl">选择订阅</h2>

      <div className="grid gap-6 md:grid-cols-3">
        <Card id="monthly" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>月度订阅</CardTitle>
            <CardDescription>按月灵活续费</CardDescription>
            {monthly ? (
              <p className="pt-2 text-2xl font-bold tabular-nums">
                ¥{formatMinorAsYuan(monthly.priceMinor)}
                <span className="text-base font-normal text-muted-foreground"> / 月</span>
              </p>
            ) : (
              <p className="text-sm text-destructive">未配置月度计划，请联系管理员。</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>会员期内享受订阅档位课程权益</li>
              <li>可叠加钱包充值使用按量工具</li>
              <li>开发环境走模拟支付，生产接入后即可真实扣款</li>
            </ul>
            <SubscribePlanButton planSlug="monthly" className="w-full" variant="secondary">
              订阅 · 月度
            </SubscribePlanButton>
          </CardContent>
        </Card>

        <Card id="yearly" className="scroll-mt-28 border-primary md:scale-[1.02] md:shadow-lg">
          <CardHeader>
            <CardTitle>年度订阅</CardTitle>
            <CardDescription>更优单价，适合长期学习</CardDescription>
            {yearly ? (
              <p className="pt-2 text-2xl font-bold tabular-nums">
                ¥{formatMinorAsYuan(yearly.priceMinor)}
                <span className="text-base font-normal text-muted-foreground"> / 年</span>
              </p>
            ) : (
              <p className="text-sm text-destructive">未配置年度计划，请联系管理员。</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>全年会员权益与课程更新</li>
              <li>适合持续使用 AI 应用与课程的用户</li>
              <li>仍需充值后使用按量计费能力</li>
            </ul>
            <SubscribePlanButton planSlug="yearly" className="w-full">
              订阅 · 年度
            </SubscribePlanButton>
          </CardContent>
        </Card>

        <Card id="apps-plans" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>AI 应用 · 说明</CardTitle>
            <CardDescription>按需选用工具，会员 + 余额双重要求</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              应用侧按产品公示计费：可能包含订阅内含额度或按次/按
              Token 扣费。请务必先完成会员订阅，并在个人中心充值，避免调用失败。
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/products/ai-apps">前往 AI 应用列表</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/account">个人中心 · 钱包与订阅</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        支付说明：当前开发环境为模拟成功支付；生产环境将替换为真实支付渠道与订单状态回调。
      </p>
    </main>
  );
}
