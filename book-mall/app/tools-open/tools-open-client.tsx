"use client";

import { AppOpenTransitionShell } from "@/components/app-open/app-open-transition-shell";
import { AiToolsLoader } from "@/components/tools-open/ai-tools-loader";

export function ToolsOpenClient({ reEnterPath }: { reEnterPath: string }) {
  return (
    <AppOpenTransitionShell
      targetUrl={reEnterPath}
      loader={<AiToolsLoader />}
      title="正在唤醒 AI 工具站…"
      subtitle="齿轮传动校验链路 · 机器人已就位 · 即将跳转安全签发"
      hint="若长时间停留在此页，请关闭标签从个人中心重试。"
      gradientClassName="bg-[radial-gradient(ellipse_80%_55%_at_50%_38%,rgba(251,191,36,0.18),rgba(34,211,238,0.08)_55%,transparent_72%)]"
    />
  );
}
