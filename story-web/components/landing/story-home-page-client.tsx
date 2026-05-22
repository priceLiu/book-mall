"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_SPACE } from "@/lib/site-config";
import type { LandingShowcase } from "@/lib/landing-showcase";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { LandingHome } from "@/components/landing/landing-home";
import { StorySpaceHome } from "@/components/landing/story-space-home";
import { fetchMyStorySpace, publishStorySpace, type StorySpaceData } from "@/lib/story-api";
import { fetchStoryViewerUser } from "@/lib/story-viewer-session";

export function StoryHomePageClient({ showcase }: { showcase: LandingShowcase }) {
  const base = useBookMallBaseUrl();
  const [space, setSpace] = useState<StorySpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const user = await fetchStoryViewerUser(base);
      if (cancelled) return;
      if (!user) {
        setSpace(null);
        setLoading(false);
        return;
      }
      try {
        const s = await fetchMyStorySpace(base);
        if (!cancelled) setSpace(s);
      } catch {
        if (!cancelled) setSpace(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  const onPublish = useCallback(async () => {
    if (!base) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const s = await publishStorySpace(base);
      setSpace(s);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }, [base]);

  if (loading) {
    return (
      <div className="story-container py-24 text-center text-[var(--story-muted)]">
        加载个人空间…
      </div>
    );
  }

  if (space) {
    return (
      <StorySpaceHome
        space={space}
        showcase={showcase}
        onPublish={onPublish}
        publishing={publishing}
        publishError={publishError}
      />
    );
  }

  return <LandingHome demo={DEMO_SPACE} showcase={showcase} />;
}
