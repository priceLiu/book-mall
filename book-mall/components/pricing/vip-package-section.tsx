"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Crown,
  Film,
  ImageIcon,
  Minus,
  Plus,
  Shield,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  computeVipPackageQuote,
  computeVipSeatAllocation,
  VIP_MIN_AMOUNT_YUAN,
} from "@/lib/finance/vip-package-calculator";
import {
  formatComputePowerRefYuan,
  VIP_BENEFITS,
  VIP_COMPLIANCE_FOOTER_ITEMS,
  VIP_COMPLIANCE_FOOTER_TITLE,
  VIP_CONSUMPTION_ORDER_NOTE,
  VIP_CONTRACT_NOTE,
  VIP_CREDIT_NO_CASH_NOTE,
  VIP_CREDIT_VALIDITY_YEARS,
  VIP_FUND_RISK_NOTE,
  VIP_MEMBER_POLICY_NOTE,
  VIP_PACKAGE_INTRO,
  VIP_PACKAGE_TITLE,
  VIP_SEAT_POLICY_NOTE,
} from "@/components/pricing/vip-package-disclosure";

const PANEL_CLASS = "rounded-2xl border border-border bg-white";

const AMOUNT_PRESETS = [
  { label: "¥100000", value: 100_000 },
  { label: "¥200000", value: 200_000 },
  { label: "¥500000", value: 500_000 },
] as const;

function credits(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function VipPackageSection() {
  const [amount, setAmount] = useState(200_000);
  const [seats, setSeats] = useState(27);
  const [chosen, setChosen] = useState<"general_heavy" | "video_heavy">("general_heavy");

  const quote = useMemo(
    () => computeVipPackageQuote({ amountYuan: amount, targetMargin: 0.5 }),
    [amount],
  );

  const scheme =
    chosen === "video_heavy" ? quote.schemeVideoHeavy : quote.schemeGeneralHeavy;

  const seatAlloc = useMemo(
    () =>
      computeVipSeatAllocation({
        totalGeneralCredits: scheme.generalCredits,
        totalVideoCredits: scheme.videoCredits,
        seats,
      }),
    [scheme.generalCredits, scheme.videoCredits, seats],
  );

  const chiefGeneral = seatAlloc.perSeatGeneral + seatAlloc.remainderGeneral;
  const chiefVideo = seatAlloc.perSeatVideo + seatAlloc.remainderVideo;

  const checkoutHref = `/checkout/vip?amount=${amount}&scheme=${chosen}&seats=${seats}`;

  return (
    <section id="vip-package" className="mt-10 scroll-mt-24">
      <div
        className={cn(
          PANEL_CLASS,
          "relative overflow-hidden border-[#8957e5]/25 bg-gradient-to-br from-[#f8f4ff] via-white to-white p-6 md:p-8",
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#8957e5]/8 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8957e5]/30 bg-[#8957e5]/10 px-3 py-1 text-xs font-medium text-[#5a32a3]">
              <Crown className="h-3.5 w-3.5" />
              企业大额预充
            </div>
            <h2 className="site-pricing-section-title mt-3">{VIP_PACKAGE_TITLE}</h2>
            <p className="mt-2 max-w-3xl site-pricing-body-text">{VIP_PACKAGE_INTRO}</p>
            <p className="mt-2 text-xs text-muted-foreground">{VIP_FUND_RISK_NOTE}</p>
          </div>
          <div className="rounded-xl border border-border bg-white/80 px-4 py-3 text-right">
            <p className="text-xs text-muted-foreground">起订金额</p>
            <p className="text-lg font-semibold text-foreground">
              ¥{VIP_MIN_AMOUNT_YUAN.toLocaleString("zh-CN")}
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          <span className="mr-1 self-center text-sm text-muted-foreground">充值档位</span>
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setAmount(preset.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition",
                amount === preset.value
                  ? "border-[#8957e5] bg-[#8957e5] text-white"
                  : "border-border bg-white text-foreground hover:border-[#8957e5]/40",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="relative mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SchemeCard
            title="方案 A · 通用多"
            subtitle="适用场景：视频算力消耗约 15%，以文本、图文生成需求为主"
            icon={<ImageIcon className="h-4 w-4" />}
            active={chosen === "general_heavy"}
            onSelect={() => setChosen("general_heavy")}
            generalCredits={quote.schemeGeneralHeavy.generalCredits}
            videoCredits={quote.schemeGeneralHeavy.videoCredits}
            totalCredits={quote.schemeGeneralHeavy.totalCredits}
            computePowerRefYuan={quote.schemeGeneralHeavy.faceValueYuan}
          />
          <SchemeCard
            title="方案 B · 视频多"
            subtitle="适用场景：视频算力消耗约 40%，适合短视频、数字人视频制作团队"
            icon={<Film className="h-4 w-4" />}
            active={chosen === "video_heavy"}
            onSelect={() => setChosen("video_heavy")}
            generalCredits={quote.schemeVideoHeavy.generalCredits}
            videoCredits={quote.schemeVideoHeavy.videoCredits}
            totalCredits={quote.schemeVideoHeavy.totalCredits}
            computePowerRefYuan={quote.schemeVideoHeavy.faceValueYuan}
          />
        </div>

        <div className="relative mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
          <div className="rounded-xl border border-border bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="site-pricing-panel-title flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  席位与积分分配（示意）
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  开通时可自定义总席位数量；主账号管理员可在团队中心设置每位成员积分消耗上限。
                </p>
              </div>
              <div className="inline-flex items-center rounded-lg border border-border/70 bg-background">
                <button
                  type="button"
                  aria-label="减少席位"
                  onClick={() => setSeats((s) => Math.max(1, s - 1))}
                  disabled={seats <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-l-lg text-foreground/70 transition hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[3.5rem] text-center text-sm font-medium text-foreground">
                  {seats} 席
                </span>
                <button
                  type="button"
                  aria-label="增加席位"
                  onClick={() => setSeats((s) => Math.min(999, s + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-r-lg text-foreground/70 transition hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li>
                · 均分参考（{seats} 席示例）：单席位通用 {credits(seatAlloc.perSeatGeneral)} + 视频{" "}
                {credits(seatAlloc.perSeatVideo)}
              </li>
              <li>
                · 首席账号（含管理员权限）：通用 {credits(chiefGeneral)} + 视频{" "}
                {credits(chiefVideo)}
              </li>
              <li>
                · 团队共享总池：通用 {credits(scheme.generalCredits)} + 视频{" "}
                {credits(scheme.videoCredits)}
              </li>
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">{VIP_CONSUMPTION_ORDER_NOTE}</p>
            <p className="mt-2 text-xs text-muted-foreground">{VIP_SEAT_POLICY_NOTE}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{VIP_CREDIT_NO_CASH_NOTE}</p>
          </div>

          <div className="space-y-2.5 rounded-xl border border-border bg-white/90 p-5 text-sm">
            <p className="site-pricing-panel-title">套餐权益</p>
            <ul className="space-y-2.5">
              {VIP_BENEFITS.map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-foreground/90">{text}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              {VIP_MEMBER_POLICY_NOTE}
            </p>
            <p className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{VIP_CONTRACT_NOTE}</span>
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <Button asChild className="h-11 rounded-full px-8">
            <Link href="/#community">联系商务 · 签订合同 / 开票</Link>
          </Button>
          {quote.meetsMinimum ? (
            <Button asChild variant="outline" className="h-11 rounded-full px-6">
              <Link href={checkoutHref}>提交预充订单</Link>
            </Button>
          ) : (
            <Button variant="outline" className="h-11 rounded-full px-6" disabled>
              提交预充订单
            </Button>
          )}
          <Button asChild variant="ghost" className="h-11 rounded-full px-4">
            <Link href="/account/team">团队中心</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            当前示意：¥{amount.toLocaleString("zh-CN")} 充值 · 已选
            {chosen === "video_heavy" ? "视频多" : "通用多"}方案 · 积分有效期 {VIP_CREDIT_VALIDITY_YEARS} 年
          </p>
        </div>

        <div className="relative mt-6 rounded-xl border border-border/80 bg-muted/20 p-4 md:p-5">
          <p className="text-xs font-medium text-foreground">{VIP_COMPLIANCE_FOOTER_TITLE}</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
            {VIP_COMPLIANCE_FOOTER_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function SchemeCard({
  title,
  subtitle,
  icon,
  active,
  onSelect,
  generalCredits,
  videoCredits,
  totalCredits,
  computePowerRefYuan,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
  generalCredits: number;
  videoCredits: number;
  totalCredits: number;
  computePowerRefYuan: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-5 text-left transition",
        active
          ? "border-[#8957e5] bg-[#f0ebff] ring-1 ring-[#8957e5]/20"
          : "border-border bg-white hover:border-[#8957e5]/35",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg",
              active ? "bg-[#8957e5]/15 text-[#5a32a3]" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </span>
          {title}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            active ? "bg-[#8957e5] text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {active ? "已选" : "可选"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-semibold text-foreground">{credits(totalCredits)}</span>
        <span className="text-sm text-muted-foreground">总积分</span>
      </div>
      <p className="mt-2 text-sm text-foreground">
        通用积分：{credits(generalCredits)} ｜ 视频积分：{credits(videoCredits)}
      </p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {formatComputePowerRefYuan(computePowerRefYuan)}
      </p>
    </button>
  );
}
