/**
 * 诊断用户 Canvas 视频 / 生成记录
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/diagnose-canvas-user.ts 13711366726
 */
import { prisma } from "@/lib/prisma";
import {
  findCanvasVideoTasksNeedingRecovery,
  recoverCanvasVideoProjectDisplay,
} from "@/lib/canvas/canvas-video-display-recover";
import { listProjectGenerationRecords } from "@/lib/canvas/canvas-task-service";

const phone = process.argv[2]?.trim() ?? "";
const apply = process.argv.includes("--apply");

async function main() {
  if (!phone) throw new Error("用法: tsx scripts/diagnose-canvas-user.ts <手机号> [--apply]");

  const user = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, phone: true, name: true, email: true },
  });
  if (!user) {
    console.log("user_not_found", phone);
    process.exit(1);
  }
  console.log("user", user);

  const projects = await prisma.canvasProject.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  console.log("projects", projects.length);

  for (const p of projects) {
    const taskCounts = await prisma.canvasGenerationTask.groupBy({
      by: ["status", "kind"],
      where: { projectId: p.id, deletedAt: null },
      _count: true,
    });
    const videoRecent = await prisma.canvasGenerationTask.findMany({
      where: {
        projectId: p.id,
        deletedAt: null,
        model: { contains: "video", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        nodeId: true,
        status: true,
        ossUrl: true,
        ephemeralUrl: true,
        failCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const genRecords = await listProjectGenerationRecords({
      userId: user.id,
      projectId: p.id,
      limit: 5,
    });
    const needRecovery = await findCanvasVideoTasksNeedingRecovery({
      projectId: p.id,
      limit: 50,
    });

    console.log("---", p.id, p.name);
    console.log("taskCounts", taskCounts);
    console.log("videoRecent", videoRecent);
    console.log("generationRecordsTop5", genRecords.items.length, genRecords.items.map((i) => ({
      id: i.id,
      status: i.status,
      kind: i.kind,
      hasMedia: Boolean(i.ossUrl || i.ephemeralUrl),
    })));
    console.log("needRecovery", needRecovery.length, needRecovery.slice(0, 5));

    const canvasRow = await prisma.canvasProject.findUnique({
      where: { id: p.id },
      select: { canvas: true },
    });
    const nodes =
      (canvasRow?.canvas as { nodes?: Array<{ id: string; type?: string; data?: unknown }> } | null)
        ?.nodes ?? [];
    const nodeIds = [...new Set(needRecovery.map((c) => c.nodeId))];
    console.log(
      "nodeRuntime",
      nodeIds.map((nid) => {
        const n = nodes.find((x) => x.id === nid);
        const rt = (n?.data as { runtime?: Record<string, unknown> })?.runtime;
        return {
          nodeId: nid,
          type: n?.type,
          runtime: rt,
        };
      }),
    );

    if (apply && needRecovery.length > 0) {
      const results = await recoverCanvasVideoProjectDisplay(p.id);
      console.log(
        "recoverResults",
        results.filter((r) => r.action !== "noop"),
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
