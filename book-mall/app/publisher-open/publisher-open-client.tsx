"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { CanvasOpenLoader } from "@/components/app-open/canvas-open-loader";

export function PublisherOpenClient({ reEnterPath }: { reEnterPath: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<CanvasOpenLoader />}
      title="正在打开一键发布"
      subtitle="正在通过 Book SSO 完成登录，请稍候…"
      gradientClassName="bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(99,102,241,0.16),transparent_70%)]"
    />
  );
}
