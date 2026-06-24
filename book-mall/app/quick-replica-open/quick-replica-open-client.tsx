"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { QuickReplicaOpenLoader } from "@/components/app-open/quick-replica-open-loader";

export function QuickReplicaOpenClient({
  reEnterPath,
}: {
  reEnterPath: string;
}) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<QuickReplicaOpenLoader />}
      title="正在打开快速复制"
      subtitle="正在通过 Book SSO 完成登录，请稍候…"
      gradientClassName="bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(236,72,153,0.12),transparent_70%)]"
    />
  );
}
