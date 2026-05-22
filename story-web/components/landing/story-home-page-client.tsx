"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LandingShowcase } from "@/lib/landing-showcase";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { StorySpaceHome } from "@/components/landing/story-space-home";
import { fetchMyStorySpace, publishStorySpace, type StorySpaceData } from "@/lib/story-api";
import { fetchStoryViewerUser } from "@/lib/story-viewer-session";

type LoadState = "pending" | "guest" | "ready";

export function StoryHomePageClient({ showcase }: { showcase: LandingShowcase }) {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("pending");
  const [space, setSpace] = useState<StorySpaceData | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    (async () => {
      const user = await fetchStoryViewerUser(base);
      if (cancelled) return;
      if (!user) {
        setLoadState("guest");
        return;
      }
      try {
        const s = await fetchMyStorySpace(base);
        if (cancelled) return;
        setSpace(s);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("guest");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  useEffect(() => {
    if (loadState === "guest") router.replace("/projects");
  }, [loadState, router]);

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

  if (loadState !== "ready" || !space) return null;

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
