"use client";

import { useCallback, useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listStoryProStyleProfiles,
  type StoryProStyleProfileRecord,
} from "@/lib/canvas-api";

export const STORY_PRO_STYLE_PROFILES_CHANGED =
  "story-pro-style-profiles-changed";

export function notifyStoryProStyleProfilesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORY_PRO_STYLE_PROFILES_CHANGED));
}

export function useStoryProStyleProfiles(projectId: string | null | undefined) {
  const base = useBookMallBaseUrl();
  const [profiles, setProfiles] = useState<StoryProStyleProfileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base?.trim()) {
      setProfiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listStoryProStyleProfiles(base, projectId ?? null);
      setProfiles(list);
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
    window.addEventListener(STORY_PRO_STYLE_PROFILES_CHANGED, onChange);
    return () =>
      window.removeEventListener(STORY_PRO_STYLE_PROFILES_CHANGED, onChange);
  }, [refresh]);

  return { profiles, loading, error, refresh };
}
