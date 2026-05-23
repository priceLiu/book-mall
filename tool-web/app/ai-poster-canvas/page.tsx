import { AiPosterCanvasHomeClient } from "./ai-poster-canvas-home-client";

export const metadata = {
  title: "AI 海报画布 — AI 工具站",
};

export default function AiPosterCanvasHomePage() {
  return (
    <main className="tw-main fitting-room-main">
      <AiPosterCanvasHomeClient />
    </main>
  );
}
