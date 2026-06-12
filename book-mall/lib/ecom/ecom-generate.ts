import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  ecomGwCreateDashscopeJob,
  ecomGwPollDashscope,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ecomCreateAndPollVolcengineVideo,
  resolveEcomVideoGenerationPlan,
} from "@/lib/ecom/ecom-video-generate-routing";

const DEFAULT_WANX_MODEL = "wanx2.1-t2i-turbo";

export async function ecomGenerateImage(opts: {
  userId: string;
  toolKey: string;
  action: string;
  module: string;
  prompt: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wanx",
    model: DEFAULT_WANX_MODEL,
    prompt: opts.prompt,
    n: 1,
    clientPage,
  });

  let imageUrl: string | null = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const polled = await ecomGwPollDashscope(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      imageUrl = polled.outputUrl;
      break;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "生图任务失败");
    }
  }
  if (!imageUrl) {
    throw new Error("生图超时，请稍后重试");
  }

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`下载生成图失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: opts.module,
      kind: "image",
      title: opts.prompt.slice(0, 80),
      prompt: opts.prompt,
      ossUrl,
      thumbnailUrl: ossUrl,
      meta: { taskId, logId, model: DEFAULT_WANX_MODEL },
    },
  });

  return { asset, chargePoints: null, taskId };
}

export async function ecomGenerateVideo(opts: {
  userId: string;
  toolKey: string;
  action: string;
  module: string;
  prompt: string;
  durationSec?: number;
  referenceImageUrl?: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const workspaceId = randomUUID().slice(0, 8);
  const durationSec = Math.max(5, Math.min(15, opts.durationSec ?? 5));
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);
  const plan = resolveEcomVideoGenerationPlan({
    action: opts.action,
    referenceImageUrl: opts.referenceImageUrl,
  });

  const { taskId, logId, videoUrl } = await ecomCreateAndPollVolcengineVideo({
    userId: opts.userId,
    modelKey: plan.modelKey,
    prompt: opts.prompt,
    durationSec,
    aspectRatio: plan.aspectRatio,
    generateAudio: plan.generateAudio,
    referenceImageUrl: opts.referenceImageUrl,
    clientPage,
  });

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`下载生成视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: opts.module,
      kind: "video",
      title: opts.prompt.slice(0, 80),
      prompt: opts.prompt,
      ossUrl,
      thumbnailUrl: ossUrl,
      meta: {
        taskId,
        logId,
        model: plan.modelKey,
        durationSec,
        aspectRatio: plan.aspectRatio,
        generateAudio: plan.generateAudio,
      },
    },
  });

  return { asset, chargePoints: null, taskId };
}
