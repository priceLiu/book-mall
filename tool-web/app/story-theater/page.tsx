import { StoryTheaterHomeClient } from "./story-theater-home-client";

export const metadata = {
  title: "漫剧剧场 — AI 工具站",
};

export default function StoryTheaterHomePage() {
  return (
    <main className="tw-main fitting-room-main">
      <StoryTheaterHomeClient />
    </main>
  );
}
