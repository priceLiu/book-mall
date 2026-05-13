import { ImageToVideoLibraryClient } from "./video-library-client";

export const metadata = {
  title: "我的视频库 — AI 工具站",
};

export default function ImageToVideoLibraryPage() {
  return (
    <main className="tw-main fitting-room-main">
      <ImageToVideoLibraryClient />
    </main>
  );
}
