"use client";

import { cn } from "@/lib/utils";

export type EcomMediaSkeletonAspect = "square" | "3/4" | "9/16";

const ASPECT_CLASS: Record<EcomMediaSkeletonAspect, string> = {
  square: "aspect-square",
  "3/4": "aspect-[3/4]",
  "9/16": "aspect-[9/16]",
};

export function EcomMediaSkeletonTile({
  aspect = "square",
  className,
}: {
  aspect?: EcomMediaSkeletonAspect;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]",
        className,
      )}
      aria-hidden
    >
      <div className={cn("ecom-skeleton w-full", ASPECT_CLASS[aspect])} />
    </div>
  );
}

export function EcomMediaSkeletonGrid({
  count,
  gridClass,
  aspect = "square",
}: {
  count: number;
  gridClass: string;
  aspect?: EcomMediaSkeletonAspect;
}) {
  return (
    <ul className={gridClass} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <EcomMediaSkeletonTile aspect={aspect} />
        </li>
      ))}
    </ul>
  );
}
