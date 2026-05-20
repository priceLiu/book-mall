"use client";

import { GradientText } from "@/components/ui/gradient-text";

/** 首页主标题：两侧纯色 + 中间 GradientText（见图 Design without Limits） */
export function HeroSparklesHeadline() {
  return (
    <h1 className="relative z-20 flex flex-nowrap items-center justify-center gap-x-2 px-2 text-center text-2xl font-bold tracking-tighter text-foreground sm:gap-x-3 sm:text-3xl md:gap-x-4 md:text-4xl lg:text-5xl xl:text-6xl">
      <span className="whitespace-nowrap">一人公司,</span>
      <GradientText className="whitespace-nowrap px-0.5 text-black dark:text-white">
        AI  变身打工仔
      </GradientText>
    </h1>
  );
}
