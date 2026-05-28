"use client";

import { useEffect } from "react";
import { StoryOpenLoader } from "@/components/app-open/story-open-loader";

export function StoryOpenClient({ reEnterPath }: { reEnterPath: string }) {
  useEffect(() => {
    window.location.replace(reEnterPath);
  }, [reEnterPath]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <StoryOpenLoader />
      <p className="text-sm text-muted-foreground">正在通过 Book SSO 打开漫剧剧场…</p>
    </div>
  );
}
