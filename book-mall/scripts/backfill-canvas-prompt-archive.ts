/**
 * 一次性回填 CanvasGenerationTask.archivePromptText / archiveMediaKind。
 * 用法（book-mall 目录）：pnpm exec tsx scripts/backfill-canvas-prompt-archive.ts
 */
import { prisma } from "../lib/prisma";
import { promptArchiveFieldsForTaskUpdate } from "../lib/canvas/canvas-task-prompt-archive";

const BATCH = 200;

async function main() {
  let cursor: string | undefined;
  let updated = 0;
  let scanned = 0;

  for (;;) {
    const rows = await prisma.canvasGenerationTask.findMany({
      where: {
        deletedAt: null,
        archivePromptText: null,
        status: { in: ["SUCCEEDED", "FAILED"] },
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        kind: true,
        inputPayload: true,
        textOutput: true,
        ossUrl: true,
        ephemeralUrl: true,
      },
    });
    if (!rows.length) break;

    for (const row of rows) {
      scanned += 1;
      const fields = promptArchiveFieldsForTaskUpdate(row);
      if (!fields.archivePromptText) continue;
      await prisma.canvasGenerationTask.update({
        where: { id: row.id },
        data: fields,
      });
      updated += 1;
    }

    cursor = rows[rows.length - 1]!.id;
    console.log(`scanned=${scanned} updated=${updated}`);
  }

  console.log(`done scanned=${scanned} updated=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
