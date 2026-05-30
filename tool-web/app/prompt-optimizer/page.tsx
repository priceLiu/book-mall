import { PromptOptimizerHomeClient } from "./prompt-optimizer-home-client";

export const metadata = {
  title: "提示词优化器 — AI 工具站",
};

export default function PromptOptimizerHomePage() {
  return (
    <main className="tw-main fitting-room-main">
      <PromptOptimizerHomeClient />
    </main>
  );
}
