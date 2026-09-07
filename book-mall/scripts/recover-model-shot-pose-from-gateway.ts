/**
 * One-off: recover model-shot pose image from succeeded Gateway log
 * when OSS upload / plan write failed after vendor success.
 *
 * Usage:
 *   pnpm exec tsx --env-file=.env.local scripts/recover-model-shot-pose-from-gateway.ts <logId> <projectId> <poseIndex>
 */
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { extractVideoUrlFromGatewayLogSummary } from "@/lib/ecom/ecom-gateway-log-video-url";
import { appendModelShotPoseImage } from "@/lib/ecom/model-shot/pose-image-history";
import {
  ECOM_MODEL_SHOT_MODULE,
  parseModelShotPlan,
} from "@/lib/ecom/ecom-model-shot-types";
import { prisma } from "@/lib/prisma";

async function main() {
  const logId = process.argv[2]?.trim();
  const projectId = process.argv[3]?.trim();
  const poseIndex = Number.parseInt(process.argv[4] ?? "", 10);
  if (!logId || !projectId || !Number.isFinite(poseIndex) || poseIndex <= 0) {
    throw new Error(
      "Usage: tsx scripts/recover-model-shot-pose-from-gateway.ts <logId> <projectId> <poseIndex>",
    );
  }

  const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
  if (!log || log.status !== "SUCCEEDED") {
    throw new Error(`Gateway log ${logId} missing or not SUCCEEDED`);
  }
  const userId = log.actorBookUserId?.trim() || log.userId;
  if (!userId) throw new Error("Cannot resolve book user id from log");

  const vendorUrl = extractVideoUrlFromGatewayLogSummary(log.resultSummary, {
    pollProvider: "dashscope",
    providerKind: log.providerKind,
  });
  if (!vendorUrl) throw new Error(`No vendor image URL in log ${logId}`);

  console.log(`Downloading vendor image for pose ${poseIndex}…`);
  const res = await fetch(vendorUrl);
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${buf.length} bytes`);

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });
  console.log(`Uploaded OSS: ${ossUrl}`);

  const row = await prisma.ecomModelShotProject.findFirst({
    where: { id: projectId, userId, module: ECOM_MODEL_SHOT_MODULE },
    select: { plan: true, updatedAt: true },
  });
  if (!row) throw new Error(`Project ${projectId} not found for user`);

  const plan = parseModelShotPlan(row.plan);
  const item = plan.items.find((i) => i.index === poseIndex);
  if (!item) throw new Error(`Pose index ${poseIndex} not in plan`);

  const asset = await prisma.ecomAsset.create({
    data: {
      userId,
      module: ECOM_MODEL_SHOT_MODULE,
      kind: "image",
      title: item.title ?? `模特图 ${poseIndex}`,
      prompt: item.prompt ?? "",
      ossUrl,
      thumbnailUrl: ossUrl,
      meta: {
        projectId,
        index: poseIndex,
        modelKey: log.model ?? "qwen-image-edit-max",
        recoveredFromGatewayLogId: logId,
      },
    },
  });

  const items = plan.items.map((i) => {
    if (i.index !== poseIndex) return i;
    const merged = appendModelShotPoseImage(i, { url: ossUrl, assetId: asset.id });
    return { ...merged, status: "ready" as const };
  });

  const updated = await prisma.ecomModelShotProject.updateMany({
    where: { id: projectId, updatedAt: row.updatedAt },
    data: { plan: { ...plan, items }, status: "completed" },
  });
  if (updated.count !== 1) throw new Error("Plan update conflict — refresh and retry");

  console.log(`Recovered pose ${poseIndex} · asset ${asset.id} · project ${projectId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
