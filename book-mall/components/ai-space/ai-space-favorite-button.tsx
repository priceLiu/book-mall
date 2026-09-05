"use client";

import { Star } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import type { AiSpaceFavoriteTargetKind } from "@/lib/ai-space/ai-space-favorite-types";

const FAV_API = "/api/platform/v1/ai-space/favorites";

export function AiSpaceFavoriteButton({
  targetKind,
  targetId,
  initialFavorite,
  meta,
  className,
  size = "sm",
}: {
  targetKind: AiSpaceFavoriteTargetKind;
  targetId: string;
  initialFavorite?: boolean;
  meta?: Record<string, unknown> | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const [favorite, setFavorite] = useState(!!initialFavorite);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (favorite) {
        const qs = new URLSearchParams({ targetKind, targetId });
        const res = await fetch(`${FAV_API}?${qs}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) return;
        setFavorite(false);
      } else {
        const res = await fetch(FAV_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ targetKind, targetId, meta: meta ?? undefined }),
        });
        if (!res.ok) return;
        setFavorite(true);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, favorite, meta, targetId, targetKind]);

  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const btnClass = size === "md" ? "h-8 w-8" : "h-7 w-7";

  return (
    <button
      type="button"
      title={favorite ? "取消收藏" : "加入我的收藏"}
      aria-pressed={favorite}
      disabled={busy}
      onClick={() => void toggle()}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border transition",
        btnClass,
        favorite
          ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
          : "border-[#d0d7de] bg-white text-[#8c959f] hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600",
        className,
      )}
    >
      <Star className={cn(iconClass, favorite && "fill-current")} />
    </button>
  );
}
