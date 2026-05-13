import { ImageToVideoLabClient } from "./image-to-video-lab-client";

export const metadata = {
  title: "图生视频 · 实验室 — AI 工具站",
};

export default function ImageToVideoLabPage() {
  return (
    <main className="tw-main fitting-room-main image-to-video-lab-main">
      <ImageToVideoLabClient />
    </main>
  );
}
