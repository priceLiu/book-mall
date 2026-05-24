"use client";

import { useEffect, type ReactNode } from "react";

/** 子站过渡页：先展示动画，再 replace 到目标 URL */
export function AppOpenTransitionShell({
  targetUrl,
  loader,
  title,
  subtitle,
  hint,
  gradientClassName,
}: {
  targetUrl: string;
  loader: ReactNode;
  title: string;
  subtitle: string;
  hint?: string;
  gradientClassName: string;
}) {
  useEffect(() => {
    window.location.replace(targetUrl);
  }, [targetUrl]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-none absolute inset-0 motion-reduce:hidden ${gradientClassName}`}
        aria-hidden
      />
      {loader}
      <div className="relative z-[1] flex flex-col items-center gap-2 text-center">
        <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        {hint ? (
          <p className="max-w-sm text-[0.7rem] leading-relaxed text-muted-foreground/85">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
