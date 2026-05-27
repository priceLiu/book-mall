import { expireStaleGatewayLogs } from "../lib/gateway/poll-service";
import { prisma } from "../lib/prisma";

async function main() {
  const n = await expireStaleGatewayLogs();
  console.log("expired", n);
  const logs = await prisma.gatewayRequestLog.findMany({
    orderBy: { submittedAt: "desc" },
    take: 3,
    select: { id: true, status: true, endpoint: true },
  });
  console.log(logs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
