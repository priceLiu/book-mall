import { StoryTheaterCreatorClient } from "./story-theater-creator-client";
import { pickRandomStoryVideos } from "@/lib/story-theater-videos";

export const metadata = {
  title: "创作幻想家 — 漫剧剧场 — AI 工具站",
};

export default function StoryTheaterCreatorPage() {
  const videos = pickRandomStoryVideos(3);
  return (
    <main className="tw-main fitting-room-main">
      <StoryTheaterCreatorClient videos={videos} />
    </main>
  );
}
