/* eslint-disable no-console */
/**
 * 「我的 AI 空间」合成队列 worker（本地/运维用）。
 *
 * 线上由合成台前台轮询驱动 `pumpAiSpaceComposeQueue`；无前端时用本脚本推进：
 *
 *   pnpm gateway:ai-space-worker                    # 循环推进直到无在途任务
 *   pnpm gateway:ai-space-worker -- --resume <id>   # 把误判失败但厂商仍在跑的任务放回队列
 *   pnpm gateway:ai-space-worker -- --cancel <id>   # 人工取消一条排队中的任务
 */
import { pumpAiSpaceComposeQueue } from "../lib/ai-space/ai-space-compose-service";
import { prisma } from "../lib/prisma";

const TICK_MS = 15_000;

function argValue(flag: string): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  return i >= 0 ? (args[i + 1]?.trim() ?? null) : null;
}

async function main() {
  const resumeId = argValue("--resume");
  if (resumeId) {
    const task = await prisma.aiSpaceComposeTask.findUnique({
      where: { id: resumeId },
      select: { status: true, gatewayTaskId: true },
    });
    if (!task) throw new Error(`任务不存在：${resumeId}`);
    if (!task.gatewayTaskId) throw new Error("该任务没有厂商 taskId，无法恢复");
    await prisma.aiSpaceComposeTask.update({
      where: { id: resumeId },
      data: { status: "generating_human", errorMessage: null },
    });
    console.log(`[resume] ${resumeId} ${task.status} → generating_human`);
  }

  const cancelId = argValue("--cancel");
  if (cancelId) {
    await prisma.aiSpaceComposeTask.update({
      where: { id: cancelId },
      data: { status: "failed", errorMessage: "人工取消" },
    });
    console.log(`[cancel] ${cancelId} → failed`);
  }

  // 连接池会回收空闲连接（"Server has closed the connection"），单 tick 失败不退出
  while (true) {
    try {
      await pumpAiSpaceComposeQueue();

      const active = await prisma.aiSpaceComposeTask.findMany({
        where: { status: { in: ["pending", "generating_human", "composing"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, gatewayTaskId: true },
      });
      const stamp = new Date().toLocaleTimeString("zh-CN");
      if (active.length === 0) {
        console.log(`[${stamp}] 无在途任务，退出`);
        return;
      }
      console.log(
        `[${stamp}] 在途 ${active.length}：` +
          active.map((t) => `${t.id.slice(-6)}=${t.status}`).join(" "),
      );
    } catch (e) {
      console.warn(
        `[${new Date().toLocaleTimeString("zh-CN")}] tick 失败，稍后重试：`,
        e instanceof Error ? e.message : e,
      );
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
