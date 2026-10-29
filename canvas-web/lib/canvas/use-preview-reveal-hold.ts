"use client";

import { useCallback, useEffect, useState } from "react";
import { isMediaSrcLoaded } from "@/lib/canvas/loaded-media-src-cache";
import {
  nextPreviewRevealHold,
  PREVIEW_REVEAL_RUNNING,
  previewRevealHolding,
} from "@/lib/canvas/preview-reveal-hold";

const REVEAL_URL_WAIT_MS = 8_000;

/** 生成结束后继续盖住卡片，直到当前预览图 onLoad */
export function usePreviewRevealHold(
  isGenerating: boolean,
  previewUrl: string | undefined,
  failed = false,
): {
  holdGenerating: boolean;
  onPreviewPaint: () => void;
  abandonPreviewHold: () => void;
} {
  const [holdUrl, setHoldUrl] = useState<string | null>(null);
  const [paintedUrl, setPaintedUrl] = useState<string | null>(null);
  const previewReady =
    Boolean(previewUrl) &&
    (paintedUrl === previewUrl || isMediaSrcLoaded(previewUrl));
  const next = nextPreviewRevealHold(
    holdUrl,
    isGenerating,
    failed,
    previewUrl,
    previewReady,
  );
  if (next !== holdUrl) setHoldUrl(next);

  useEffect(() => {
    if (holdUrl !== PREVIEW_REVEAL_RUNNING) return;
    const timer = setTimeout(() => setHoldUrl(null), REVEAL_URL_WAIT_MS);
    return () => clearTimeout(timer);
  }, [holdUrl]);

  const onPreviewPaint = useCallback(() => {
    if (previewUrl) setPaintedUrl(previewUrl);
  }, [previewUrl]);

  const abandonPreviewHold = useCallback(() => {
    if (previewUrl) setPaintedUrl(previewUrl);
    setHoldUrl(null);
  }, [previewUrl]);

  return {
    holdGenerating: previewRevealHolding(next, previewUrl),
    onPreviewPaint,
    abandonPreviewHold,
  };
}
