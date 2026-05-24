"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { CanvasOpenLoader } from "@/components/app-open/canvas-open-loader";

export function CanvasOpenClient({ targetUrl }: { targetUrl: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={targetUrl}
      loader={<CanvasOpenLoader />}
      title="正在打开 AI 画布…"
      subtitle="节点连线 · 工作流唤醒 · 即将进入 canvas-web"
      hint="若长时间停留在此页，请关闭标签后从工具站或开发导航重试。"
      gradientClassName="bg-gradient-to-br from-violet-500/[0.1] via-transparent to-cyan-500/[0.08] dark:from-violet-500/[0.14] dark:to-cyan-500/[0.1]"
    />
  );
}
