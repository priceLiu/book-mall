"use client";

import { useEffect, useState } from "react";

import { formatCreditsDisplay } from "@/lib/format-credits-display";
import {
  ecomCreditsUnitLabel,
  fetchEcomCreditsPreview,
  type EcomCreditsPreview,
} from "@/lib/ecom-credits-preview";
import { cn } from "@/lib/utils";

/** 生成钮左侧积分预估（浅色底上的金色，文案与画布 Dock 一致：≈ N积分） */
export function EcomGenerateCreditsLabel({
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

export function useEcomCreditsPreview(opts: {
  modelKey?: string | null;
  durationSec?: number;
  imageCount?: number;
  resolution?: string;
  enabled?: boolean;
}): EcomCreditsPreview | null {
  const { modelKey, durationSec, imageCount, resolution, enabled = true } = opts;
  const [preview, setPreview] = useState<EcomCreditsPreview | null>(null);

  useEffect(() => {
    const key = modelKey?.trim() ?? "";
    if (!enabled || !key) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void fetchEcomCreditsPreview({
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

/** 生成按钮旁：按当前模型拉统一积分价并展示 ≈ N积分 */
export function EcomGenerateCreditsBeside({
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
  const preview = useEcomCreditsPreview({
    modelKey,
    durationSec,
    imageCount,
    resolution,
    enabled,
  });
  const title =
    preview && preview.credits != null
      ? `${preview.canonicalModelKey} · 挂牌 ${formatCreditsDisplay(preview.creditsPerUnit)} 积分/${ecomCreditsUnitLabel(preview.unit)}`
      : undefined;
  return (
    <EcomGenerateCreditsLabel
      credits={preview?.credits}
      title={title}
      className={className}
    />
  );
}
