import { prisma } from "../lib/prisma";

async function main() {
  const logs = await prisma.gatewayRequestLog.findMany({
    orderBy: { submittedAt: "desc" },
    take: 5,
  });
  console.log(JSON.stringify(logs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
