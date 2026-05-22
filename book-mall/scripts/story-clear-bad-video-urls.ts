/* eslint-disable no-console */
/**
 * 一次性脚本：清空所有 videoUrl 不是 mp4 的分镜（修复 Wan 2.7 误用为视频模型留下的脏数据）。
 *   pnpm dotenv -e .env.local -- tsx scripts/story-clear-bad-video-urls.ts
 *
 * 同时把这些分镜上残留的 FRAME_VIDEO 任务（无论状态）记号清掉，
 * 让用户在前端重新生成时不会被「已有视频」误导。
 */
import { prisma } from "../lib/prisma";

async function main() {
  const frames = await prisma.storyStoryboardFrame.findMany({
    where: { videoUrl: { not: "" } },
    select: { id: true, videoUrl: true, projectId: true },
  });
  const bad = frames.filter((f) => !f.videoUrl.toLowerCase().endsWith(".mp4"));
  console.log(`scanned ${frames.length} frames, ${bad.length} have non-mp4 videoUrl`);
  for (const f of bad) {
    console.log(`  - frame ${f.id} (project ${f.projectId}): ${f.videoUrl}`);
    await prisma.storyStoryboardFrame.update({
      where: { id: f.id },
      data: { videoUrl: "", videoTaskId: null },
    });
  }
  console.log("done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
