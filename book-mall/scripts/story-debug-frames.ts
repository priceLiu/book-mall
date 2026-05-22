/* eslint-disable no-console */
/** PROJECT_ID=xxx pnpm dotenv -e .env.local -- tsx scripts/story-debug-frames.ts */
import { prisma } from "../lib/prisma";

async function main() {
  const projectId =
    process.env.PROJECT_ID?.trim() || "cmpgyqo7j0003r08ocyzxnea8";

  const frames = await prisma.storyStoryboardFrame.findMany({
    where: { projectId },
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      sceneText: true,
      imageUrl: true,
      videoUrl: true,
      imageTaskId: true,
      videoTaskId: true,
    },
  });
  for (const f of frames) {
    console.log(JSON.stringify(f));
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
