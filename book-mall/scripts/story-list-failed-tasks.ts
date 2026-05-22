/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.storyGenerationTask.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      failCode: true,
      failMessage: true,
      createdAt: true,
      kieTaskId: true,
      characterId: true,
      frameId: true,
      projectId: true,
    },
    take: 10,
  });
  for (const r of rows) console.log(JSON.stringify(r));
  if (rows.length === 0) console.log("(no FAILED tasks)");
}

main().finally(async () => {
  await prisma.$disconnect();
});
