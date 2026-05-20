"use client";

import { AUTH_BRANDING_TITLE_GRADIENT } from "@/components/auth/animated-auth-ui";
import { cn } from "@/lib/utils";

type Props = {
  brandingText?: string;
};

/** 注册页品牌标题：左侧区域内、单行、偏大、略偏上 */
export function AuthRegisterBranding({ brandingText = "智选 AI MALL" }: Props) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-[34%] z-[5] hidden w-1/2 px-6 text-center lg:block xl:px-10"
      aria-hidden
    >
      <span
        className={cn(
          "inline-block whitespace-nowrap font-semibold leading-none tracking-tight",
          "text-6xl xl:text-7xl 2xl:text-8xl",
          AUTH_BRANDING_TITLE_GRADIENT
        )}
      >
        {brandingText}
      </span>
    </div>
  );
}
