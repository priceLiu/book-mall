import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";
import { parseEcomCopyImageArtifact } from "@private/ecom-copy-overlay";

import { composeEcomCopyOverlayImage } from "@/lib/ecom/copy-overlay/compose-image";

export async function applyCopyImageArtifactCompose(opts: {
  userId: string;
  artifact: EcomCopyImageArtifact;
  syncText?: string;
}): Promise<{ url: string; artifact: EcomCopyImageArtifact }> {
  const parsed = parseEcomCopyImageArtifact(opts.artifact) ?? opts.artifact;
  const baseImageUrl = parsed.image.baseImageUrl?.trim();
  if (!baseImageUrl) throw new Error("缺少无字底图 baseImageUrl");

  const { url, overlay } = await composeEcomCopyOverlayImage({
    userId: opts.userId,
    baseImageUrl,
    overlay: parsed.layout,
    syncText: opts.syncText ?? parsed.copy.slotCopy,
    exportWidthPx: parsed.render.exportWidthPx,
  });

  const next: EcomCopyImageArtifact = {
    ...parsed,
    layout: overlay,
    image: { ...parsed.image, finalImageUrl: url },
    meta: {
      ...parsed.meta,
      composedAt: new Date().toISOString(),
    },
  };
  return { url, artifact: next };
}
