/**
 * 一次性脚本：把因 OSS 未配置而 FAILED(OSS_UPLOAD_FAILED) 的任务重置回 SUBMITTED，
 * 让下一次 `pnpm story:poll-once` 重新走一遍 KIE 结果 → OSS 落盘流程。
 *   pnpm tsx scripts/story-retry-oss-failed.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.storyGenerationTask.updateMany({
    where: { status: "FAILED", failCode: "OSS_UPLOAD_FAILED" },
    data: {
      status: "SUBMITTED",
      failCode: null,
      failMessage: null,
      completedAt: null,
    },
  });
  console.log(
    `[story-retry-oss-failed] reset ${result.count} task(s) to SUBMITTED`,
  );
}

main()
  .catch((e) => {
    console.error("[story-retry-oss-failed] error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
