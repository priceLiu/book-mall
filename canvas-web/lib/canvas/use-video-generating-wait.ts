"use client";

import { useEffect, useMemo, useState } from "react";

import {
  VIDEO_BACKGROUND_UI_MS,
  resolveVideoGeneratingLabel,
  VIDEO_BACKGROUND_WAIT_HINT,
} from "@/lib/canvas/video-task-wait-policy";

export function useVideoGeneratingWait(
  active: boolean,
  sinceIso: string | null | undefined,
  isPending: boolean,
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !sinceIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [active, sinceIso]);

  return useMemo(() => {
    if (!active || !sinceIso) {
      return {
        waitMinutes: null as number | null,
        isBackground: false,
        generatingLabel: resolveVideoGeneratingLabel(isPending, false),
        waitHint: null as string | null,
      };
    }
    const sinceMs = Date.parse(sinceIso);
    if (!Number.isFinite(sinceMs)) {
      return {
        waitMinutes: null,
        isBackground: false,
        generatingLabel: resolveVideoGeneratingLabel(isPending, false),
        waitHint: null,
      };
    }
    const elapsedMs = Math.max(0, now - sinceMs);
    const isBackground = elapsedMs >= VIDEO_BACKGROUND_UI_MS;
    const waitMinutes = Math.floor(elapsedMs / 60_000);
    const generatingLabel = resolveVideoGeneratingLabel(isPending, isBackground);
    const waitHint = isBackground
      ? VIDEO_BACKGROUND_WAIT_HINT
      : `已等待 ${waitMinutes} 分钟`;

    return { waitMinutes, isBackground, generatingLabel, waitHint };
  }, [active, sinceIso, isPending, now]);
}
