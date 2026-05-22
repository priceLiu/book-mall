import { StoryTheaterCreatorClient } from "./story-theater-creator-client";

export const metadata = {
  title: "创作幻想家 — 漫剧剧场 — AI 工具站",
};

export default function StoryTheaterCreatorPage() {
  return (
    <main className="tw-main fitting-room-main">
      <StoryTheaterCreatorClient />
    </main>
  );
}
