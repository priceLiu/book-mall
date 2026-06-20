"use client";

import { useEffect } from "react";

import { QuickReplicaOpenLoader } from "@/components/app-open/quick-replica-open-loader";

export function QuickReplicaOpenClient({
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
      <QuickReplicaOpenLoader />
      <p className="text-sm text-muted-foreground">正在通过 Book SSO 打开快速复制…</p>
    </div>
  );
}
