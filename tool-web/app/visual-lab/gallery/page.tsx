import { VisualLabGalleryClient } from "./visual-lab-gallery-client";

export const metadata = {
  title: "成果展 — 视觉实验室 — AI 工具站",
};

export default function VisualLabGalleryPage() {
  return (
    <main className="tw-main fitting-room-main visual-lab-main">
      <VisualLabGalleryClient />
    </main>
  );
}
