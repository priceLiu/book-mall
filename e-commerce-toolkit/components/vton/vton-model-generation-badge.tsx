"use client";

import { cn } from "@/lib/utils";
import type { ModelGenerationBodyBadge } from "@/lib/vton-model-generation-body-check";

const TONE_CLASS: Record<ModelGenerationBodyBadge["tone"], string> = {
  success: "bg-[#248a3d] text-white",
  warn: "bg-[#b45309] text-white",
  muted: "bg-[#86868b] text-white",
  pending: "bg-[#0071e3]/90 text-white",
};

export function VtonModelGenerationBadge({
  badge,
  className,
}: {
  badge: ModelGenerationBodyBadge;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-medium leading-none",
        TONE_CLASS[badge.tone],
        className,
      )}
    >
      {badge.label}
    </span>
  );
}

export function VtonModelGenerationBadgeStack({
  badges,
  className,
}: {
  badges: ModelGenerationBodyBadge[];
  className?: string;
}) {
  if (badges.length < 1) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((badge) => (
        <VtonModelGenerationBadge key={badge.label} badge={badge} />
      ))}
    </div>
  );
}
