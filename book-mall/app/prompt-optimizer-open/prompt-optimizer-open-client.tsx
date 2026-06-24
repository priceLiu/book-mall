"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { PromptOptimizerOpenLoader } from "@/components/app-open/prompt-optimizer-open-loader";

export function PromptOptimizerOpenClient({
  reEnterPath,
}: {
  reEnterPath: string;
}) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<PromptOptimizerOpenLoader />}
      title="正在打开提示词优化器"
      subtitle="正在通过 Book SSO 完成登录，请稍候…"
      gradientClassName="bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(99,102,241,0.12),transparent_70%)]"
    />
  );
}
