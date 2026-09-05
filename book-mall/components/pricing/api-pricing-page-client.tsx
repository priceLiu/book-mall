"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PricingModeTabs } from "@/components/pricing/pricing-mode-tabs";
import {
  API_CREDIT_TOPUP_PACKS,
  type ApiCreditTopupPack,
} from "@/lib/billing/api-credit-topup-packs";
import { unitLabel } from "@/lib/pricing/credit-pricing-formulas";
import { cn } from "@/lib/utils";

const PANEL_CLASS = "rounded-2xl border border-border bg-card";

interface ModelPrice {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
}

function RechargeCard({ pack }: { pack: ApiCreditTopupPack }) {
  const perCredit = pack.priceYuan / pack.credits;
  return (
    <div className={cn(PANEL_CLASS, "relative flex h-full min-h-0 flex-col p-6")}>
      {pack.promo ? (
        <span className="absolute right-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {pack.promo}
        </span>
      ) : null}
      <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {pack.label}
      </div>
      <div className="mt-2 text-3xl font-light text-foreground">
        {pack.credits.toLocaleString("zh-CN")}
        <span className="ml-1 text-base text-muted-foreground">积分</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground">¥{pack.priceYuan.toFixed(0)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        约 ¥{perCredit.toFixed(3)}/积分 · 长期有效
      </p>
      <Button type="button" className="mt-auto w-full" variant="secondary" disabled>
        充值即将开放
      </Button>
    </div>
  );
}

export function ApiPricingPageClient({
  models,
  isLoggedIn,
}: {
  models: ModelPrice[];
  isLoggedIn: boolean;
}) {
  const videoModels = models.filter((m) => m.unit === "PER_SEC");
  const imageModels = models.filter((m) => m.unit === "PER_IMAGE");
  const otherModels = models.filter((m) => m.unit !== "PER_SEC" && m.unit !== "PER_IMAGE");

  return (
    <div className="site-pricing-page">
      <div className="site-pricing-hero">
        <h1 className="sr-only">API 价格</h1>
        <PricingModeTabs />
        {!isLoggedIn ? (
          <Button asChild>
            <Link href="/register">注册 API 账号</Link>
          </Button>
        ) : null}
      </div>

      <div className="site-pricing-body">
        <section className="site-pricing-section-head">
          <h2 className="site-pricing-section-title">充值积分</h2>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch lg:grid-cols-3 xl:grid-cols-5">
          {API_CREDIT_TOPUP_PACKS.map((pack) => (
            <RechargeCard key={pack.id} pack={pack} />
          ))}
        </div>

        {models.length > 0 ? (
          <section className="mt-16">
            <div className="site-pricing-section-head">
              <h2 className="site-pricing-section-title">模型扣费（全站统一）</h2>
            </div>
            <div className={cn("mt-4 overflow-x-auto", PANEL_CLASS)}>
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="min-w-[160px]">模型</TableHead>
                    <TableHead className="text-right">每次消耗</TableHead>
                    <TableHead className="text-right">计费单位</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...otherModels, ...imageModels, ...videoModels].map((m) => (
                    <TableRow key={m.canonicalModelKey}>
                      <TableCell className="font-medium">{m.displayName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.creditsPerUnit.toLocaleString("zh-CN")} 积分
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {unitLabel(m.unit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
