"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  bookMallLoginHref,
  fetchStoryViewerUser,
  type StoryViewerUser,
} from "@/lib/story-viewer-session";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const base = useBookMallBaseUrl();
  const [user, setUser] = useState<StoryViewerUser | null | undefined>(undefined);

  useEffect(() => {
    if (!base) {
      setUser(null);
      return;
    }
    let cancelled = false;
    void fetchStoryViewerUser(base).then((u) => {
      if (cancelled) return;
      if (!u) {
        const returnTo =
          typeof window !== "undefined" ? window.location.href : `${base}/login`;
        window.location.href = bookMallLoginHref(base, returnTo);
        return;
      }
      setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, [base]);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--story-bg)] text-[var(--story-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        校验登录态…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--story-bg)] text-[var(--story-muted)]">
        正在跳转登录…
      </div>
    );
  }

  return <>{children}</>;
}
