"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchModelCreditsPreview, type ModelCreditsPreview } from "./credits-preview-client";

/** Gateway modelKey 归一化为字符串（batchImage / 旧数据可能非 string） */
export function normalizeModelKey(modelKey: unknown): string {
  if (typeof modelKey === "string") return modelKey.trim();
  if (modelKey == null) return "";
  return String(modelKey).trim();
}

/** 按模型 + 时长/张数估算本次生成消耗积分（主站 B 表 + 用户档位） */
export function useModelCreditsPreview(
  modelKey: unknown,
  durationSec: number,
  variantId?: string,
  imageCount?: number,
  resolution?: string,
): ModelCreditsPreview | null {
  const base = useBookMallBaseUrl();
  const [preview, setPreview] = useState<ModelCreditsPreview | null>(null);

  useEffect(() => {
    const key = normalizeModelKey(modelKey);
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
