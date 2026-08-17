/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const tasks = await prisma.aiSpaceComposeTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      errorMessage: true,
      gatewayLogId: true,
      gatewayTaskId: true,
      tempHumanVideoUrl: true,
      finalVideoUrl: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true } },
    },
  });

  console.log("== recent compose tasks ==");
  for (const t of tasks) {
    console.log("---");
    console.log(t.createdAt.toISOString(), t.user.email, t.status);
    console.log("id", t.id);
    if (t.errorMessage) console.log("err", t.errorMessage.slice(0, 400));
    if (t.gatewayLogId) console.log("log", t.gatewayLogId, "vendor", t.gatewayTaskId ?? "-");
    if (t.tempHumanVideoUrl) console.log("temp", t.tempHumanVideoUrl.slice(0, 80));
    if (t.finalVideoUrl) console.log("final", t.finalVideoUrl.slice(0, 80));
  }

  const stuck = await prisma.aiSpaceComposeTask.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("\n== status counts ==");
  for (const row of stuck) console.log(row.status, row._count);

  const creds = await prisma.gatewayVendorCredential.findMany({
    where: {
      active: true,
      OR: [
        { alias: { contains: "S2V", mode: "insensitive" } },
        { alias: { contains: "北京", mode: "insensitive" } },
        { providerKind: "DASHSCOPE" },
      ],
    },
    select: {
      id: true,
      alias: true,
      baseUrl: true,
      providerKind: true,
      isDefaultForProvider: true,
    },
    orderBy: [{ providerKind: "asc" }, { alias: "asc" }],
  });
  console.log("\n== dashscope / beijing credentials ==");
  for (const c of creds) {
    console.log(
      `${c.providerKind} | ${c.alias} | base=${c.baseUrl ?? "(null)"} | default=${c.isDefaultForProvider}`,
    );
  }

  for (const t of tasks.slice(0, 3)) {
    if (!t.gatewayLogId) continue;
    const log = await prisma.gatewayRequestLog.findUnique({
      where: { id: t.gatewayLogId },
      select: {
        model: true,
        status: true,
        failCode: true,
        failMessage: true,
        externalTaskId: true,
        durationMs: true,
        credentialId: true,
      },
    });
    if (!log) continue;
    console.log("\n== gateway log", t.gatewayLogId, "==");
    console.log(log);
    if (log.credentialId) {
      const cred = await prisma.gatewayVendorCredential.findUnique({
        where: { id: log.credentialId },
        select: { alias: true, baseUrl: true },
      });
      console.log("credential", cred);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
