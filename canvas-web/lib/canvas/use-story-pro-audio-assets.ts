"use client";

import { useCallback, useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listStoryProCharacterAudioAssets,
  type StoryProCharacterAudioAssetRecord,
} from "@/lib/canvas-api";

export const STORY_PRO_AUDIO_ASSETS_CHANGED = "story-pro-audio-assets-changed";

export function notifyStoryProAudioAssetsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORY_PRO_AUDIO_ASSETS_CHANGED));
}

export function useStoryProCharacterAudioAssets(
  projectId: string | null | undefined,
) {
  const base = useBookMallBaseUrl();
  const [assets, setAssets] = useState<StoryProCharacterAudioAssetRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base?.trim()) {
      setAssets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listStoryProCharacterAudioAssets(
        base,
        projectId ?? null,
      );
      setAssets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [base, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(STORY_PRO_AUDIO_ASSETS_CHANGED, onChange);
    return () =>
      window.removeEventListener(STORY_PRO_AUDIO_ASSETS_CHANGED, onChange);
  }, [refresh]);

  return { assets, loading, error, refresh };
}
