/**
 * 调试种草/复刻 pending 镜头与 Gateway 日志
 * pnpm exec dotenv -e .env.local -- tsx scripts/debug-seed-shot-log.ts <logId>
 */
import { prisma } from "../lib/prisma";
import { extractVideoUrlFromGatewayLogSummary } from "../lib/ecom/ecom-gateway-log-video-url";
import { readPendingShotVideos } from "../lib/ecom/ecom-seed-video-pending-shots";
import { resumePendingSeedVideoPanelShots } from "../lib/ecom/ecom-seed-video-panel-resume";
import type { SeedVideoPlan } from "../lib/ecom/ecom-seed-video-types";

const logId = process.argv[2]?.trim() ?? "cmtll3n3u001hifqd3hvdeips";

async function main() {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      status: true,
      providerKind: true,
      model: true,
      externalTaskId: true,
      resultSummary: true,
      failMessage: true,
      userId: true,
    },
  });
  if (!log) {
    console.log("log not found");
    return;
  }
  console.log("LOG", {
    id: log.id,
    status: log.status,
    providerKind: log.providerKind,
    model: log.model,
    externalTaskId: log.externalTaskId,
    failMessage: log.failMessage,
  });
  console.log("resultSummary", JSON.stringify(log.resultSummary, null, 2));
  const extracted = extractVideoUrlFromGatewayLogSummary(log.resultSummary, {
    providerKind: log.providerKind,
  });
  console.log("extractedUrl", extracted);

  const projectsByLog = await prisma.ecomSeedVideoProject.findMany({
    where: {
      meta: {
        path: [],
        string_contains: logId,
      },
    },
    select: { id: true, meta: true, plan: true, userId: true },
    take: 10,
  });
  console.log("projectsByLog", projectsByLog.length);

  const byTaskId = log.externalTaskId?.trim()
    ? await prisma.ecomSeedVideoProject.findMany({
        where: {
          userId: log.userId,
          plan: { string_contains: log.externalTaskId },
        },
        select: { id: true, meta: true, plan: true, userId: true },
        take: 5,
      })
    : [];
  if (byTaskId.length) {
    console.log("projectsByTaskId", byTaskId.map((p) => p.id));
  }

  const projects = projectsByLog.length
    ? projectsByLog
    : await prisma.ecomSeedVideoProject.findMany({
        where: { userId: log.userId },
        select: { id: true, meta: true, plan: true, userId: true },
        orderBy: { updatedAt: "desc" },
        take: 30,
      });

  for (const p of projects) {
    const meta = (p.meta ?? {}) as Record<string, unknown>;
    const pending = readPendingShotVideos(meta);
    const metaStr = JSON.stringify(meta);
    const planStr = JSON.stringify(p.plan ?? {});
    const hit =
      metaStr.includes(logId) ||
      (log.externalTaskId && planStr.includes(log.externalTaskId)) ||
      Object.values(pending).some((e) => e.logId === logId || e.taskId === log.externalTaskId) ||
      Boolean(pending["4"]);
    if (!hit) continue;

    const plan = p.plan as SeedVideoPlan | null;
    const shot4 = plan?.shots?.find((s) => s.index === 4);
    console.log("\nPROJECT", p.id);
    console.log("pending[4]", pending["4"]);
    console.log("shot4.videoUrl", shot4?.videoUrl?.slice(0, 120) ?? null);

    const resumed = await resumePendingSeedVideoPanelShots({
      userId: p.userId,
      projectId: p.id,
      meta,
      plan,
    });
    console.log("resume.changed", resumed.changed);
    if (resumed.changed) {
      const shot4After = resumed.plan?.shots?.find((s) => s.index === 4);
      console.log("shot4.videoUrl after", shot4After?.videoUrl?.slice(0, 120) ?? null);
      console.log("pending after", readPendingShotVideos(resumed.meta));
      await prisma.ecomSeedVideoProject.update({
        where: { id: p.id },
        data: {
          meta: resumed.meta as object,
          plan: resumed.plan as object,
          status: "production",
        },
      });
      console.log("persisted project update");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
