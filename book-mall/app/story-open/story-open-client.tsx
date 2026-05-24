"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { StoryOpenLoader } from "@/components/app-open/story-open-loader";

export function StoryOpenClient({ targetUrl }: { targetUrl: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={targetUrl}
      loader={<StoryOpenLoader />}
      title="正在打开漫剧剧场…"
      subtitle="场记就绪 · 胶片入槽 · 即将进入 story-web"
      hint="若长时间停留在此页，请关闭标签后从工具站或开发导航重试。"
      gradientClassName="bg-gradient-to-b from-amber-500/[0.08] via-transparent to-orange-500/[0.06] dark:from-amber-500/[0.12] dark:to-orange-500/[0.08]"
    />
  );
}
