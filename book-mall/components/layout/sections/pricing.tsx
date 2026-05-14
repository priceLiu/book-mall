import Link from "next/link";
import { Check } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { formatPointsAsYuan } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function PricingSection() {
  let monthly: SubscriptionPlan | null = null;
  let yearly: SubscriptionPlan | null = null;

  try {
    const results = await Promise.all([
      prisma.subscriptionPlan.findFirst({
        where: { slug: "monthly", active: true },
      }),
      prisma.subscriptionPlan.findFirst({
        where: { slug: "yearly", active: true },
      }),
    ]);
    monthly = results[0];
    yearly = results[1];
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("PricingSection", e);
  }

  type Tier = {
    key: string;
    title: string;
    popular: boolean;
    priceLine: string;
    description: string;
    buttonText: string;
    href: string;
    benefitList: string[];
    buttonVariant: "default" | "secondary";
  };

  const tiers: Tier[] = [
    {
      key: "monthly",
      title: "月度订阅",
      popular: false,
      priceLine: monthly
        ? `¥${formatPointsAsYuan(monthly.pricePoints)} / 月`
        : "价格待定",
      description: "按月开通会员，灵活续费；配合钱包充值使用 AI 应用按量能力。",
      buttonText: "月度订阅",
      href: "/subscribe#monthly",
      benefitList: [
        "会员期内课程与权益按档位开通",
        "个人中心充值后可使用工具型按量服务",
        "先订阅会员，再充值才可用（见订阅页说明）",
      ],
      buttonVariant: "secondary",
    },
    {
      key: "yearly",
      title: "年度订阅",
      popular: true,
      priceLine: yearly
        ? `¥${formatPointsAsYuan(yearly.pricePoints)} / 年`
        : "价格待定",
      description: "年度付费更省，适合持续学习与长期使用 AI 应用。",
      buttonText: "年度订阅",
      href: "/subscribe#yearly",
      benefitList: [
        "全年会员权益与内容更新",
        "适合长期深度用户与小团队",
        "仍须在钱包充值以满足按量计费最低线",
      ],
      buttonVariant: "default",
    },
    {
      key: "custom",
      title: "高级定制",
      popular: false,
      priceLine: "面议",
      description: "私有化交付、企业采购、培训与集成方案，由顾问为您配置。",
      buttonText: "高级定制",
      href: "/#contact",
      benefitList: [
        "方案与报价单独评估",
        "可包含实施与培训",
        "联系商务沟通合同与开票",
      ],
      buttonVariant: "secondary",
    },
  ];

  return (
    <section id="pricing" className="container py-24 sm:py-32">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">价格</h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">会员与订阅</h2>

      <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground pb-4">
        先成为订阅会员，再在个人中心充值；工具型按量能力以站内公示为准。
      </h3>

      <p className="text-center text-sm text-muted-foreground pb-14">
        <Link href="/pricing-disclosure" className="text-primary underline font-medium">
          查看完整价格公示与使用案例
        </Link>
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-4">
        {tiers.map(
          ({
            key,
            title,
            popular,
            priceLine,
            description,
            buttonText,
            href,
            benefitList,
            buttonVariant,
          }) => (
            <Card
              key={key}
              className={
                popular
                  ? "drop-shadow-xl shadow-black/10 dark:shadow-white/10 border-[1.5px] border-primary lg:scale-[1.1]"
                  : ""
              }
            >
              <CardHeader>
                <CardTitle className="pb-2">{title}</CardTitle>

                <CardDescription className="pb-4">{description}</CardDescription>

                <div>
                  <span className="text-3xl font-bold tabular-nums">{priceLine}</span>
                </div>
              </CardHeader>

              <CardContent className="flex">
                <div className="space-y-4">
                  {benefitList.map((benefit) => (
                    <span key={benefit} className="flex">
                      <Check className="text-primary mr-2 shrink-0 mt-0.5" />
                      <span className="text-sm leading-snug">{benefit}</span>
                    </span>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  asChild
                  variant={buttonVariant}
                  className="w-full"
                >
                  <Link href={href}>{buttonText}</Link>
                </Button>
              </CardFooter>
            </Card>
          ),
        )}
      </div>
    </section>
  );
}
