import { MediaRenderSourceApp } from "@prisma/client";

export async function onMediaRenderJobSucceeded(job: {
  userId: string;
  sourceApp: MediaRenderSourceApp;
  sourceRef: unknown;
  id: string;
  resultOssUrl: string | null;
  expiresAt: Date;
}): Promise<void> {
  if (job.sourceApp !== MediaRenderSourceApp.ecom || !job.resultOssUrl) return;
  const ref = job.sourceRef as { projectId?: string } | null;
  const projectId = ref?.projectId?.trim();
  if (!projectId) return;

  const { persistStoryboardDeliverableSnapshot } = await import(
    "@/lib/ecom/ecom-storyboard-snapshot"
  );
  const { prisma: db } = await import("@/lib/prisma");

  await db.ecomStoryboardProject.update({
    where: { id: projectId },
    data: { status: "done" },
  });

  await persistStoryboardDeliverableSnapshot({
    userId: job.userId,
    projectId,
    videoUrl: job.resultOssUrl,
    videoMode: "merged_panels",
    renderJobId: job.id,
    renderExpiresAt: job.expiresAt.toISOString(),
  });
}
