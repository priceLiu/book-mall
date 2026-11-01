import { pickHomeV2QuickReplicaShowcase } from "@/lib/site-home-v2/pick-showcase-templates";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";
import { getQuickReplicaGallerySnapshotForApi } from "@/lib/static-snapshots/quick-replica-gallery-snapshot-service";

const GALLERY_TIMEOUT_MS = 8_000;

/** 首页 V2 广场：超时或失败时不阻塞整页渲染 */
export async function loadHomeV2ShowcaseTemplates(): Promise<QrTemplateJson[]> {
  try {
    const gallery = await Promise.race([
      getQuickReplicaGallerySnapshotForApi(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("gallery-timeout")), GALLERY_TIMEOUT_MS);
      }),
    ]);
    return pickHomeV2QuickReplicaShowcase(gallery.payload);
  } catch {
    return [];
  }
}
