"use client";

import { cn } from "@/lib/utils";

type Props = {
  brandingText?: string;
};

/** 注册页全屏粒子上的左侧品牌标题（大屏显示） */
export function AuthRegisterBranding({ brandingText = "智选 AI MALL" }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-[5] hidden w-1/2 items-center justify-center px-8 lg:flex"
      aria-hidden
    >
      <span
        className={cn(
          "whitespace-pre-wrap bg-gradient-to-b from-zinc-900 to-zinc-500/90 bg-clip-text text-center font-semibold leading-none tracking-tight text-transparent",
          "text-5xl xl:text-6xl 2xl:text-7xl dark:from-white dark:to-slate-400/50"
        )}
      >
        {brandingText}
      </span>
    </div>
  );
}
