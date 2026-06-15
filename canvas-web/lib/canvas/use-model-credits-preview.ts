"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchModelCreditsPreview, type ModelCreditsPreview } from "./credits-preview-client";

/** 按模型 + 时长/张数估算本次生成消耗积分（主站 B 表 + 用户档位） */
export function useModelCreditsPreview(
  modelKey: string | undefined,
  durationSec: number,
  variantId?: string,
  imageCount?: number,
  resolution?: string,
): ModelCreditsPreview | null {
  const base = useBookMallBaseUrl();
  const [preview, setPreview] = useState<ModelCreditsPreview | null>(null);

  useEffect(() => {
    const key = modelKey?.trim();
    if (!key || !base) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void fetchModelCreditsPreview(base, {
      modelKey: key,
      durationSec,
      variantId,
      imageCount,
      resolution,
    }).then((r) => {
      if (!cancelled) setPreview(r);
    });
    return () => {
      cancelled = true;
    };
  }, [base, modelKey, durationSec, variantId, imageCount, resolution]);

  return preview;
}
