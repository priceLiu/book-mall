/* eslint-disable no-console */
/** 用法：CHAR_ID=xxx pnpm dotenv -e .env.local -- tsx scripts/story-debug-character.ts */
import { prisma } from "../lib/prisma";

async function main() {
  const characterId =
    process.env.CHAR_ID?.trim() || "cmpgyyeem0007r0e3b5oz90i7";

  const character = await prisma.storyCharacter.findUnique({
    where: { id: characterId },
  });
  console.log("== character ==");
  console.log(JSON.stringify(character, null, 2));

  const tasks = await prisma.storyGenerationTask.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      status: true,
      kieTaskId: true,
      ossUrl: true,
      ephemeralUrl: true,
      failCode: true,
      failMessage: true,
      createdAt: true,
      submittedAt: true,
      completedAt: true,
      lastPolledAt: true,
      pollCount: true,
    },
  });
  console.log(`== tasks for character (${tasks.length}) ==`);
  for (const t of tasks) console.log(JSON.stringify(t));
}

main().finally(async () => {
  await prisma.$disconnect();
});
