"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { CanvasOpenLoader } from "@/components/app-open/canvas-open-loader";

export function CanvasOpenClient({ reEnterPath }: { reEnterPath: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<CanvasOpenLoader />}
      title="正在打开 AI 画布"
      subtitle="正在通过 Book SSO 完成登录，请稍候…"
      gradientClassName="bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(139,92,246,0.12),transparent_70%)]"
    />
  );
}
