"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CreditsView = "seat" | "pool";

type Props = {
  perPeriodCredits: number;
  poolCreditsPerPeriod: number;
  maxImages: number;
  maxVideos15s: number;
  imageAnchorLabel: string;
  videoAnchorLabel: string;
  isTeam: boolean;
  /** 最受欢迎卡片：积分切换用白底药丸样式（见图右侧选中态） */
  featured?: boolean;
};

function formatCredits(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function PricingPlanCreditsBlock({
  perPeriodCredits,
  poolCreditsPerPeriod,
  maxImages,
  maxVideos15s,
  imageAnchorLabel,
  videoAnchorLabel,
  isTeam,
  featured = false,
}: Props) {
  const [view, setView] = useState<CreditsView>(isTeam ? "pool" : "seat");
  const displayCredits =
    isTeam && view === "pool" ? poolCreditsPerPeriod : perPeriodCredits;

  const estimateForCredits = (credits: number) => {
    if (perPeriodCredits <= 0) return { images: 0, videos: 0 };
    const ratio = credits / perPeriodCredits;
    return {
      images: Math.floor(maxImages * ratio),
      videos: Math.floor(maxVideos15s * ratio),
    };
  };

  const { images, videos } = estimateForCredits(displayCredits);

  const tooltipText = `按平台内主流低成本模型示意换算（非最贵档）：生图 ${imageAnchorLabel}、视频 ${videoAnchorLabel} 每条 15 秒。每席每 31 天约 ${formatCredits(maxImages)} 张图 / ${formatCredits(maxVideos15s)} 条视频；实际模型与参数不同会有差异，同池互斥。`;

  const toggleShellClass = cn(
    "inline-flex max-w-full items-center rounded-full border p-0.5",
    featured
      ? "border-[#d1d9e0] bg-[#f6f8fa]"
      : "border-border bg-muted/40",
  );

  const toggleBtnClass = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
      "whitespace-nowrap",
      active
        ? featured
          ? "bg-white text-foreground shadow-sm"
          : "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "site-pricing-credits-block mt-5 rounded-xl border px-4 py-4 text-center",
          featured
            ? "border-[#d1d9e0] bg-[#f6f8fa]/80"
            : "border-border/70 bg-muted/20",
        )}
      >
        {isTeam ? (
          <div className="mb-3 flex justify-center">
            <div className={toggleShellClass}>
              <button
                type="button"
                className={toggleBtnClass(view === "seat")}
                onClick={() => setView("seat")}
              >
                {formatCredits(perPeriodCredits)} 积分/月
              </button>
              <button
                type="button"
                className={toggleBtnClass(view === "pool")}
                onClick={() => setView("pool")}
              >
                {formatCredits(poolCreditsPerPeriod)} 积分/月
              </button>
            </div>
          </div>
        ) : (
          <div className="site-pricing-credits-amount tabular-nums">
            {formatCredits(perPeriodCredits)}
            <span className="site-pricing-credits-suffix">积分/月</span>
          </div>
        )}

        <p className="site-pricing-credits-estimate mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
          <span>
            最多生成约 {formatCredits(images)} 张图片
            <span className="mx-1 text-border">|</span>
            {formatCredits(videos)} 个视频
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 rounded-full p-0.5 text-muted-foreground transition hover:text-foreground"
                aria-label="换算说明"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </p>

        {isTeam ? (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {view === "seat" ? "每席口径" : "团队合计"} · 积分每 31 天刷新一期
          </p>
        ) : (
          <p className="mt-1.5 text-[10px] text-muted-foreground">积分每 31 天刷新一期</p>
        )}
      </div>
    </TooltipProvider>
  );
}
