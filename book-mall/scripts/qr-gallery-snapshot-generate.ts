/**
 * QuickReplica 浏览 gallery 静态快照生成
 *
 *   pnpm --dir book-mall qr:gallery-snapshot-generate
 */
import { runQuickReplicaGallerySnapshotGeneration } from "@/lib/static-snapshots/quick-replica-gallery-snapshot-service";
import {
  isQuickReplicaGallerySnapshotPayload,
  summarizeQuickReplicaGalleryPayload,
} from "@/lib/static-snapshots/quick-replica-gallery-payload";

async function main() {
  console.log("[qr:gallery-snapshot-generate] starting…");
  const result = await runQuickReplicaGallerySnapshotGeneration({ trigger: "CLI" });
  const raw = result.snapshot.payload;
  if (!isQuickReplicaGallerySnapshotPayload(raw)) {
    throw new Error("invalid_snapshot_payload");
  }
  const summary = summarizeQuickReplicaGalleryPayload(raw);
  console.log(
    `[qr:gallery-snapshot-generate] ok dateKey=${result.dateKey} templates=${JSON.stringify(summary.templateCounts)} kinds=${JSON.stringify(summary.kindCounts)}`,
  );
}

main()
  .catch((e) => {
    console.error("[qr:gallery-snapshot-generate] failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  });
