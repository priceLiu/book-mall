"use client";

import type { ReactNode } from "react";
import { AuthOrbitStage } from "@/components/auth/auth-orbit-stage";
import { AuthParticleField } from "@/components/auth/auth-particle-field";
import { AuthRegisterBranding } from "@/components/auth/auth-register-stage";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** 左侧大标题 */
  brandingText?: string;
  /** 左侧动效：登录轨道 / 注册粒子（全屏） */
  variant?: "login" | "register";
};

/**
 * 分屏登录/注册壳：左侧品牌动效 + 右侧表单；顶栏主题开关（浅色/深色）。
 * 注册页粒子铺满整屏，表单叠在右侧。
 */
export function AuthAnimatedScreen({
  children,
  brandingText = "智选 AI MALL",
  variant = "login",
}: Props) {
  if (variant === "register") {
    return (
      <div className="relative -mt-4 h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)] w-full overflow-hidden bg-neutral-50 text-foreground transition-colors duration-300 md:-mt-5 dark:bg-[#020617]">
        {/* 粒子铺满整屏（含原右侧表单区域） */}
        <AuthParticleField className="absolute inset-0 z-0" />
        <AuthRegisterBranding brandingText={brandingText} />

        <div className="absolute right-4 top-4 z-30">
          <ToggleTheme
            iconOnly
            className="border border-neutral-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/80"
          />
        </div>

        {/* 表单浮在粒子上；大屏左缘贴 50% 中线，小屏居中 */}
        <div
          className={cn(
            "absolute inset-0 z-20 flex items-center justify-center px-6 py-8",
            "lg:inset-y-0 lg:left-1/2 lg:right-0 lg:justify-start lg:px-10 lg:py-8 xl:px-12"
          )}
        >
          <div
            className={cn(
              "w-full max-w-sm rounded-2xl border border-sky-400/35 px-6 py-8 backdrop-blur-md",
              "bg-white/80 shadow-lg ring-1 ring-sky-400/15",
              "dark:border-sky-300/30 dark:bg-[#020617]/55 dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)] dark:ring-sky-300/10"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mt-4 flex h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)] w-full overflow-hidden bg-neutral-50 text-foreground transition-colors duration-300 md:-mt-5 dark:bg-[#020617]">
      <div className="absolute right-4 top-4 z-30">
        <ToggleTheme
          iconOnly
          className="border border-neutral-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-zinc-900/80"
        />
      </div>

      <div className="relative hidden h-full min-h-0 w-1/2 shrink-0 overflow-hidden lg:block">
        <AuthOrbitStage brandingText={brandingText} />
      </div>

      <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-50/80 px-6 py-8 sm:px-10 lg:w-1/2 lg:bg-neutral-100/50 dark:bg-[#030712]/90 dark:lg:bg-[#030712]">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
