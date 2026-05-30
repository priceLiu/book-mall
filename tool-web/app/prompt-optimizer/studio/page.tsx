import { PromptOptimizerStudioClient } from "./prompt-optimizer-studio-client";

export const metadata = {
  title: "优化工作台 — 提示词优化器 — AI 工具站",
};

export default function PromptOptimizerStudioPage() {
  return (
    <main className="tw-main fitting-room-main">
      <PromptOptimizerStudioClient />
    </main>
  );
}
