import { AiPosterCanvasStudioClient } from "./ai-poster-canvas-studio-client";

export const metadata = {
  title: "创意画室 — AI 海报画布 — AI 工具站",
};

export default function AiPosterCanvasStudioPage() {
  return (
    <main className="tw-main fitting-room-main">
      <AiPosterCanvasStudioClient />
    </main>
  );
}
