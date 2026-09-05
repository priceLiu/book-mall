/* eslint-disable no-console */
/**
 * 对数字人库存量形象跑一遍 wan2.2-s2v-detect 预检（0.004 元/张，经 Gateway 记账）。
 *
 *   cd book-mall && pnpm gateway:detect-digital-humans -- [bookUserEmail]
 */
import { detectAiSpaceDigitalHumanImage } from "../lib/ai-space/ai-space-s2v-detect-service";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv.slice(2).find((a) => a.trim() && a !== "--")?.trim();

  const rows = await prisma.aiSpaceDigitalHuman.findMany({
    where: email ? { user: { email } } : {},
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, name: true, status: true },
    take: 200,
  });
  if (rows.length === 0) {
    console.log("数字人库为空");
    return;
  }

  for (const row of rows) {
    try {
      const detect = await detectAiSpaceDigitalHumanImage({
        userId: row.userId,
        digitalHumanId: row.id,
      });
      console.log(
        `[${detect.checkPass ? "pass" : "fail"}] ${row.name}` +
          ` humanoid=${detect.humanoid ?? "-"}${detect.message ? ` msg=${detect.message}` : ""}`,
      );
    } catch (e) {
      console.error(`[error] ${row.name}`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
