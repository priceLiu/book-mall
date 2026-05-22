/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const tasks = await prisma.storyGenerationTask.findMany({
    where: {
      OR: [
        { model: "wan/2-7-image-pro" },
        { model: "wan/2-7-text-to-video" },
      ],
    },
    select: { id: true, model: true, status: true, kind: true, frameId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`found ${tasks.length} task(s) using deprecated wan model ids:`);
  for (const t of tasks) console.log(JSON.stringify(t));
}

main().finally(async () => {
  await prisma.$disconnect();
});
