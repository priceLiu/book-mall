import { AiPosterCanvasGalleryClient } from "./ai-poster-canvas-gallery-client";

export const metadata = {
  title: "画作 — AI 海报画布 — AI 工具站",
};

export default function AiPosterCanvasGalleryPage() {
  return (
    <main className="tw-main fitting-room-main">
      <AiPosterCanvasGalleryClient />
    </main>
  );
}
