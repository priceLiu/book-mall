"use client";

import { GradientText } from "@/components/ui/gradient-text";
import { cn } from "@/lib/utils";

type HeroSparklesHeadlineProps = {
  align?: "center" | "left";
};

/** 首页主标题：两侧纯色 + 中间 GradientText（见图 Design without Limits） */
export function HeroSparklesHeadline({ align = "center" }: HeroSparklesHeadlineProps) {
  const isLeft = align === "left";

  return (
    <h1
      className={cn(
        "relative z-20 flex flex-wrap items-center gap-x-2 gap-y-1 px-0 text-2xl font-bold tracking-tighter text-foreground sm:gap-x-3 sm:text-3xl md:gap-x-4 md:text-4xl lg:text-5xl xl:text-[3.25rem] xl:leading-[1.1]",
        isLeft
          ? "flex-col items-start gap-y-2 text-left"
          : "flex-nowrap justify-center px-2 text-center",
      )}
    >
      <span className="whitespace-nowrap">一人公司,</span>
      <GradientText className="whitespace-nowrap px-0.5 text-black dark:text-white">
        AI  变身打工仔
      </GradientText>
    </h1>
  );
}
