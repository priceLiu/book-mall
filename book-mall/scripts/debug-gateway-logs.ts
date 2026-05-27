import { prisma } from "../lib/prisma";

const email = "13808816802@126.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, gatewayApiKeyId: true, role: true },
  });
  const gwUser = user
    ? await prisma.gatewayUser.findFirst({ where: { bookUserId: user.id } })
    : null;
  const logs = await prisma.gatewayRequestLog.findMany({
    orderBy: { submittedAt: "desc" },
    take: 15,
    select: {
      id: true,
      clientSource: true,
      providerKind: true,
      status: true,
      model: true,
      submittedAt: true,
      userId: true,
    },
  });
  const canvasLogs = await prisma.gatewayRequestLog.count({
    where: { clientSource: "CANVAS" },
  });
  const recentTasks = user
    ? await prisma.canvasGenerationTask.findMany({
        where: { project: { userId: user.id } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          model: true,
          createdAt: true,
          inputPayload: true,
        },
      })
    : [];
  console.log(
    JSON.stringify(
      {
        user,
        gwUserId: gwUser?.id,
        gwUserEmail: gwUser?.email,
        canvasLogCount: canvasLogs,
        totalLogCount: logs.length,
        recentLogs: logs,
        recentTasks: recentTasks.map((t) => ({
          ...t,
          providerId:
            t.inputPayload &&
            typeof t.inputPayload === "object" &&
            "providerId" in (t.inputPayload as object)
              ? (t.inputPayload as { providerId?: string }).providerId
              : null,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
