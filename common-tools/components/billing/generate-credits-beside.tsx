"use client";

import { useEffect, useState } from "react";

import { formatCreditsDisplay } from "@/lib/format-credits-display";
import {
  commonToolsCreditsUnitLabel,
  fetchCommonToolsCreditsPreview,
  type CommonToolsCreditsPreview,
} from "@/lib/credits-preview";
import { cn } from "@/lib/utils";

/** 生成钮旁积分预估（浅色底金色，文案与画布一致：≈ N积分） */
export function CommonToolsGenerateCreditsLabel({
  credits,
  title,
  className,
}: {
  credits: number | null | undefined;
  title?: string;
  className?: string;
}) {
  if (credits == null || !Number.isFinite(credits) || credits <= 0) return null;
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap tabular-nums text-[13px] font-medium text-[#ca8a04]",
        className,
      )}
      title={title}
    >
      ≈ {formatCreditsDisplay(credits)}积分
    </span>
  );
}

function useCommonToolsCreditsPreview(opts: {
  modelKey?: string | null;
  durationSec?: number;
  imageCount?: number;
  resolution?: string;
  enabled?: boolean;
}): CommonToolsCreditsPreview | null {
  const { modelKey, durationSec, imageCount, resolution, enabled = true } = opts;
  const [preview, setPreview] = useState<CommonToolsCreditsPreview | null>(null);

  useEffect(() => {
    const key = modelKey?.trim() ?? "";
    if (!enabled || !key) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void fetchCommonToolsCreditsPreview({
      modelKey: key,
      durationSec,
      imageCount,
      resolution,
    }).then((row) => {
      if (!cancelled) setPreview(row);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, modelKey, durationSec, imageCount, resolution]);

  return preview;
}

export function CommonToolsGenerateCreditsBeside({
  modelKey,
  durationSec,
  imageCount,
  resolution,
  enabled = true,
  className,
}: {
  modelKey?: string | null;
  durationSec?: number;
  imageCount?: number;
  resolution?: string;
  enabled?: boolean;
  className?: string;
}) {
  const preview = useCommonToolsCreditsPreview({
    modelKey,
    durationSec,
    imageCount,
    resolution,
    enabled,
  });
  const title =
    preview && preview.credits != null
      ? `${preview.canonicalModelKey} · 挂牌 ${formatCreditsDisplay(preview.creditsPerUnit)} 积分/${commonToolsCreditsUnitLabel(preview.unit)}`
      : undefined;
  return (
    <CommonToolsGenerateCreditsLabel
      credits={preview?.credits}
      title={title}
      className={className}
    />
  );
}
