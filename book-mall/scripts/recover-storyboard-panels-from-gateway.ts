/**
 * One-off: recover storyboard panel images from succeeded Gateway logs
 * when OSS upload / sheet write failed after vendor success.
 *
 * Usage:
 *   pnpm exec dotenv -e .env.local -- tsx scripts/recover-storyboard-panels-from-gateway.ts
 */
import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import { clearStoryboardPanelImagesPending } from "@/lib/ecom/ecom-storyboard-pending-images";
import {
  ECOM_STORYBOARD_MODULE,
  parseStoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import { ecomExtractMediaUrl } from "@/lib/gateway/ecom-tool-gateway-client";

const userId = "cmplfp85q0000r03ut03lft88";
const projectId = "cmtfih2750026ifcfr1lzfl29";

const recoveries = [
  { logId: "cmtfl1dmz003lr0ukgdz8h3ox", panelIndex: 1 },
  { logId: "cmtfl1imj003pr0ukjdsgsryx", panelIndex: 2 },
  { logId: "cmtfl1dxt003nr0ukgxxo0k93", panelIndex: 3 },
] as const;

async function downloadAndUpload(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download failed HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`  downloaded ${buf.length} bytes`);
  return uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });
}

async function main() {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project?.sheet) throw new Error("no sheet");

  const panelOss = new Map<number, string>();

  for (const { logId, panelIndex } of recoveries) {
    const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
    if (!log?.resultSummary) throw new Error(`missing log ${logId}`);
    const vendorUrl = ecomExtractMediaUrl(
      (log.resultSummary as { output?: unknown }).output,
    );
    if (!vendorUrl) throw new Error(`no vendor url for ${logId}`);
    console.log(`Panel ${panelIndex} <= ${logId}`);
    const ossUrl = await downloadAndUpload(vendorUrl);
    console.log(`  oss ${ossUrl}`);
    panelOss.set(panelIndex, ossUrl);

    const panel = project.sheet.panels.find((p) => p.index === panelIndex);
    await prisma.ecomAsset.create({
      data: {
        userId,
        module: ECOM_STORYBOARD_MODULE,
        kind: "image",
        title: `${project.sheet.overview.title} · 镜头${panelIndex}`.slice(0, 80),
        prompt: panel?.imagePrompt ?? panel?.scene ?? "",
        ossUrl,
        thumbnailUrl: ossUrl,
        meta: {
          projectId,
          modelKey: log.model ?? "wan2.7-image-pro",
          kind: "storyboard_panel",
          panelIndex,
          recoveredFromGatewayLogId: logId,
        },
      },
    });
  }

  const panels = project.sheet.panels.map((p) => {
    const ossUrl = panelOss.get(p.index);
    return ossUrl ? { ...p, imageUrl: ossUrl } : p;
  });
  const nextSheet = parseStoryboardSheet({ ...project.sheet, panels });
  await updateEcomStoryboardProject(userId, projectId, {
    sheet: nextSheet,
    status: "image_partial",
  });
  await clearStoryboardPanelImagesPending(projectId, [1, 2, 3]);

  const refreshed = await getEcomStoryboardProject(userId, projectId);
  console.log(
    "result",
    refreshed?.sheet?.panels.map((p) => ({
      i: p.index,
      hasImg: Boolean(p.imageUrl?.trim()),
    })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
