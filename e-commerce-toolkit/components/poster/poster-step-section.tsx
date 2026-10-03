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
        "rounded-2xl border border-[#e8e8ed] bg-white p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[#6e6e73]">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
