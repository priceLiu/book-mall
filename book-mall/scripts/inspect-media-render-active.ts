import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.mediaRenderJob.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      userId: true,
      status: true,
      progress: true,
      progressLabel: true,
      errorMessage: true,
      sourceApp: true,
      sourceRef: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });
  for (const row of rows) {
    const ageSec = Math.round((Date.now() - row.createdAt.getTime()) / 1000);
    console.log(
      [
        row.user.email,
        row.status,
        `${row.progress}%`,
        row.progressLabel ?? "-",
        `age=${ageSec}s`,
        row.id.slice(0, 12),
        JSON.stringify(row.sourceRef),
      ].join(" | "),
    );
  }
  console.log("active total:", rows.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
