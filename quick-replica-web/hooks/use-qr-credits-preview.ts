"use client";

import { useEffect, useRef, useState } from "react";

import {
  postQrCreditsPreview,
  type QrCreditsPreview,
} from "@/lib/qr-credits-preview";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

const DEBOUNCE_MS = 300;

function draftPreviewKey(draft: QrWorkspaceDraft): string {
  return JSON.stringify({
    category: draft.category,
    kind: draft.kind,
    toolKey: draft.toolKey,
    modelKey: draft.modelKey,
    duration: draft.duration,
    resolution: draft.resolution,
    mode: draft.mode,
    sfxDurationAuto: draft.sfxDurationAuto,
    sfxDurationSeconds: draft.sfxDurationSeconds,
    musicDurationAuto: draft.musicDurationAuto,
    musicDurationSeconds: draft.musicDurationSeconds,
    targetImageUrl: draft.targetImageUrl,
    referenceVideoUrl: draft.referenceVideoUrl,
    sceneImageUrls: draft.sceneImageUrls,
  });
}

export function useQrCreditsPreview(draft: QrWorkspaceDraft): {
  preview: QrCreditsPreview | null;
  loading: boolean;
} {
  const [preview, setPreview] = useState<QrCreditsPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const draftKey = draftPreviewKey(draft);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const timer = window.setTimeout(() => {
      void postQrCreditsPreview(draft).then((result) => {
        if (requestIdRef.current !== requestId) return;
        setPreview(result);
        setLoading(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, draftKey]);

  return { preview, loading };
}
