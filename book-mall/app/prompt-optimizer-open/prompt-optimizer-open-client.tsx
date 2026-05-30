"use client";

import { useEffect } from "react";
import { PromptOptimizerOpenLoader } from "@/components/app-open/prompt-optimizer-open-loader";

export function PromptOptimizerOpenClient({
  reEnterPath,
}: {
  reEnterPath: string;
}) {
  useEffect(() => {
    window.location.replace(reEnterPath);
  }, [reEnterPath]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <PromptOptimizerOpenLoader />
      <p className="text-sm text-muted-foreground">
        正在通过 Book SSO 打开提示词优化器…
      </p>
    </div>
  );
}
