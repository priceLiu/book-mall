"use client";

import { useEffect } from "react";
import { CanvasOpenLoader } from "@/components/app-open/canvas-open-loader";

export function CanvasOpenClient({ reEnterPath }: { reEnterPath: string }) {
  useEffect(() => {
    window.location.replace(reEnterPath);
  }, [reEnterPath]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <CanvasOpenLoader />
      <p className="text-sm text-muted-foreground">正在通过 Book SSO 打开 AI 画布…</p>
    </div>
  );
}
