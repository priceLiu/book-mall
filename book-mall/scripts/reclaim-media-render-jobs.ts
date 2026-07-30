import {
  reclaimStaleMediaRenderJobsForUser,
  supersedeInFlightMediaRenderJobsForProject,
} from "../lib/media/media-render-concurrency";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2]?.trim() || "13808816802@126.com";
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error("user not found:", email);
    process.exit(1);
  }

  const before = await prisma.mediaRenderJob.findMany({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: {
      id: true,
      status: true,
      progress: true,
      progressLabel: true,
      sourceRef: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("before", before.length);
  for (const row of before) {
    console.log(
      row.id.slice(0, 12),
      row.status,
      row.progress,
      row.progressLabel,
      JSON.stringify(row.sourceRef),
    );
  }

  const projectIds = [
    ...new Set(
      before
        .map((row) => {
          const ref = row.sourceRef as { projectId?: string } | null;
          return ref?.projectId?.trim() || "";
        })
        .filter(Boolean),
    ),
  ];

  let superseded = 0;
  for (const projectId of projectIds) {
    superseded += await supersedeInFlightMediaRenderJobsForProject({
      userId: user.id,
      projectId,
    });
  }
  const reclaimed = await reclaimStaleMediaRenderJobsForUser(user.id);

  const after = await prisma.mediaRenderJob.count({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });

  console.log({ email: user.email, superseded, reclaimed, activeAfter: after });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
