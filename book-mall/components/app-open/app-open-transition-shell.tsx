"use client";

import { useEffect, type ReactNode } from "react";

const OPEN_GRADIENT =
  "bg-[radial-gradient(ellipse_80%_55%_at_50%_38%,rgba(208,215,222,0.45),transparent_72%)]";

/** 子站过渡页：浅色营销壳 + 动效，再 replace 到目标 URL */
export function AppOpenTransitionShell({
  targetUrl,
  loader,
  title,
  subtitle,
  hint,
  gradientClassName = OPEN_GRADIENT,
}: {
  targetUrl: string;
  loader: ReactNode;
  title: string;
  subtitle: string;
  hint?: string;
  gradientClassName?: string;
}) {
  useEffect(() => {
    window.location.replace(targetUrl);
  }, [targetUrl]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-[#ffffff] px-4 text-[#1f2328]"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-none absolute inset-0 motion-reduce:hidden ${gradientClassName}`}
        aria-hidden
      />
      {loader}
      <div className="relative z-[1] flex flex-col items-center gap-2 text-center">
        <p className="text-base font-semibold tracking-tight text-[#1f2328]">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-[#656d76]">{subtitle}</p>
        {hint ? (
          <p className="max-w-sm text-[0.7rem] leading-relaxed text-[#656d76]/90">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
