"use client";

import { useCallback, useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listStoryProSceneAssets,
  type StoryProSceneAssetRecord,
} from "@/lib/canvas-api";

export const STORY_PRO_SCENE_ASSETS_CHANGED = "story-pro-scene-assets-changed";

export function notifyStoryProSceneAssetsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORY_PRO_SCENE_ASSETS_CHANGED));
}

export function useStoryProSceneAssets(projectId: string | null | undefined) {
  const base = useBookMallBaseUrl();
  const [assets, setAssets] = useState<StoryProSceneAssetRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!base?.trim()) {
      setAssets([]);
      return;
    }
    setLoading(true);
    try {
      setAssets(await listStoryProSceneAssets(base, projectId ?? null));
    } finally {
      setLoading(false);
    }
  }, [base, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(STORY_PRO_SCENE_ASSETS_CHANGED, onChange);
    return () =>
      window.removeEventListener(STORY_PRO_SCENE_ASSETS_CHANGED, onChange);
  }, [refresh]);

  return { assets, loading, refresh };
}
