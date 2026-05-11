"use client";

import { useEffect } from "react";
import { AiToolsLoader } from "@/components/tools-open/ai-tools-loader";

/**
 * 新标签直接打开 `/api/sso/tools/re-enter` 时浏览器会先停在 `about:blank/favicon.ico`，体感很差。
 * 先落到本站 `/tools-open`（SSR 出加载动画），再在客户端 replace 到 re-enter。
 */
export function ToolsOpenClient({ reEnterPath }: { reEnterPath: string }) {
  useEffect(() => {
    window.location.replace(reEnterPath);
  }, [reEnterPath]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.09] via-transparent to-primary/[0.05] motion-reduce:hidden dark:from-primary/[0.14] dark:to-primary/[0.07]"
        aria-hidden
      />

      <AiToolsLoader />

      <div className="relative z-[1] flex flex-col items-center gap-2 text-center">
        <p className="bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_auto] bg-clip-text text-base font-semibold tracking-tight text-transparent motion-safe:animate-tools-text-shimmer motion-reduce:bg-none motion-reduce:text-foreground motion-reduce:bg-transparent">
          正在唤醒 AI 工具站…
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          齿轮传动校验链路 · 机器人已就位
          <span className="mx-1 text-muted-foreground/60">·</span>
          即将跳转安全签发
        </p>
        <p className="max-w-sm text-[0.7rem] leading-relaxed text-muted-foreground/85">
          若长时间停留在此页，请关闭标签从个人中心重试。
        </p>
      </div>
    </div>
  );
}
