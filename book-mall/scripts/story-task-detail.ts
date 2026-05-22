/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const taskId = process.env.TASK_ID || "cmph1bhj0000ur0e3n593dhth";
  const t = await prisma.storyGenerationTask.findUnique({
    where: { id: taskId },
  });
  console.log(JSON.stringify(t, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
