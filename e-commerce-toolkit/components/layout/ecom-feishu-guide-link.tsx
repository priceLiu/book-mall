"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  /** 默认「使用指南」 */
  label?: string;
  className?: string;
  variant?: "inline" | "button" | "chip";
};

export function EcomFeishuGuideLink({
  href,
  label = "使用指南",
  className,
  variant = "inline",
}: Props) {
  const base =
    variant === "button"
      ? "inline-flex items-center gap-1.5 rounded-lg border border-[var(--ecom-chrome-border-subtle)] px-3 py-2 text-xs font-medium text-[var(--ecom-chrome-text)] transition-colors hover:bg-[var(--ecom-chrome-hover)]"
      : variant === "chip"
        ? "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-[var(--ecom-primary)]/40 hover:bg-white hover:text-[var(--ecom-primary)]"
        : "inline-flex items-center gap-1 text-xs font-medium text-[var(--ecom-primary)] transition hover:underline";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, className)}
      title={`${label}（飞书知识库，新标签打开）`}
    >
      <BookOpen className="size-3.5 shrink-0 opacity-90" aria-hidden />
      <span>{label}</span>
      {variant !== "inline" ? (
        <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
      ) : null}
    </a>
  );
}

export function EcomFeishuGuideIconButton({
  href,
  title = "使用指南（飞书）",
  className,
  onClick,
}: {
  href: string;
  title?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--ecom-chrome-text-muted)] transition-colors hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <BookOpen className="size-3.5" />
    </a>
  );
}
