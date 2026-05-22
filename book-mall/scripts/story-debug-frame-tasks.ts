/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const frameId =
    process.env.FRAME_ID?.trim() || "cmpgzqi5d000kr0e3t49a585k";

  const tasks = await prisma.storyGenerationTask.findMany({
    where: { frameId, kind: "FRAME_VIDEO" },
    select: {
      id: true,
      status: true,
      kieTaskId: true,
      failCode: true,
      failMessage: true,
      model: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  for (const t of tasks) console.log(JSON.stringify(t));
  console.log(`total: ${tasks.length}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
