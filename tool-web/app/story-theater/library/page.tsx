import { StoryTheaterLibraryClient } from "./story-theater-library-client";

export const metadata = {
  title: "我的剧场 — 漫剧剧场 — AI 工具站",
};

export default function StoryTheaterLibraryPage() {
  return (
    <main className="tw-main fitting-room-main">
      <StoryTheaterLibraryClient />
    </main>
  );
}
