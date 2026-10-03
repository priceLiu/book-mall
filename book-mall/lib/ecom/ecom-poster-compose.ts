import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";
import { prisma } from "@/lib/prisma";

import { applyCopyImageArtifactCompose } from "@/lib/ecom/copy-overlay/apply-artifact-compose";
import { ECOM_POSTER_MODULE } from "@/lib/ecom/ecom-poster-types";

export async function composePosterArtifact(opts: {
  userId: string;
  projectId: string;
  artifact: EcomCopyImageArtifact;
  slotCopy?: string;
  title?: string;
}): Promise<{ url: string; artifact: EcomCopyImageArtifact; assetId: string }> {
  const { url, artifact } = await applyCopyImageArtifactCompose({
    userId: opts.userId,
    artifact: opts.artifact,
    syncText: opts.slotCopy,
  });

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_POSTER_MODULE,
      kind: "image",
      title: (opts.title ?? "营销海报").slice(0, 80),
      prompt: artifact.image.imagePrompt,
      ossUrl: url,
      thumbnailUrl: url,
      meta: {
        projectId: opts.projectId,
        source: ECOM_POSTER_MODULE,
        composedCopyOverlay: true,
      },
    },
  });

  return { url, artifact, assetId: asset.id };
}
