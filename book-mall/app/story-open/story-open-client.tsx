"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { StoryOpenLoader } from "@/components/app-open/story-open-loader";

export function StoryOpenClient({ reEnterPath }: { reEnterPath: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<StoryOpenLoader />}
      title="正在打开漫剧剧场"
      subtitle="正在通过 Book SSO 完成登录，请稍候…"
      gradientClassName="bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(245,158,11,0.14),transparent_70%)]"
    />
  );
}
