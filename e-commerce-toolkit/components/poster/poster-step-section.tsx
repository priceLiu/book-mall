"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function PosterStepSection({ step, title, description, children, className }: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--ecom-divider)] bg-white p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ecom-ink)] text-xs font-bold text-white">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--ecom-ink)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--ecom-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
