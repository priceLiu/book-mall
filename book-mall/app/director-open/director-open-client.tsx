"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { DirectorOpenLoader } from "@/components/app-open/director-open-loader";

export function DirectorOpenClient({ reEnterPath }: { reEnterPath: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<DirectorOpenLoader />}
      title="正在打开 3D导演台"
      subtitle="正在通过 Book SSO 完成登录，请稍候…"
      gradientClassName="bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(139,92,246,0.12),transparent_70%)]"
    />
  );
}
