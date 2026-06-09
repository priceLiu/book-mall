import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  ecomGwCreateDashscopeJob,
  ecomGwPollDashscope,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { shouldMeterEcomToolkitUsage } from "@/lib/ecom/ecom-billing-mode";
import { reserveWalletHold } from "@/lib/wallet-holds";
import { recordToolUsageAndConsumeWallet } from "@/lib/wallet-record-tool-usage-consume";
import { resolveBillableSnapshot } from "@/lib/tool-billable-price";
import type { ToolUsagePricingSnapshot } from "@/lib/finance/tool-usage-billing-line";

const DEFAULT_WANX_MODEL = "wanx2.1-t2i-turbo";

function snapToPricing(snap: NonNullable<Awaited<ReturnType<typeof resolveBillableSnapshot>>>): ToolUsagePricingSnapshot {
  return {
    unitCostYuan: snap.unitCostYuan,
    retailMultiplier: snap.retailMultiplier,
    ourUnitYuan: snap.ourUnitYuan,
    schemeARefModelKey: snap.schemeARefModelKey,
    billablePriceId: snap.billablePriceId,
    cloudBillingKind: snap.billingKind ?? null,
    billedQty: snap.billedImageCount ?? snap.billedVideoSec ?? null,
    billedUnit:
      snap.billingKind === "VIDEO_MODEL_SPEC"
        ? "秒"
        : snap.billingKind === "OUTPUT_IMAGE" ||
            snap.billingKind === "COST_PER_IMAGE"
          ? "张"
          : null,
  };
}

async function settleMetered(opts: {
  userId: string;
  toolKey: string;
  action: string;
  taskKey: string;
  holdId: string | null;
  snap: NonNullable<Awaited<ReturnType<typeof resolveBillableSnapshot>>>;
  meta: Prisma.InputJsonValue;
}): Promise<number | null> {
  const outcome = await recordToolUsageAndConsumeWallet({
    userId: opts.userId,
    toolKey: opts.toolKey,
    action: opts.action,
    costPoints: opts.snap.points,
    meta: opts.meta,
    pricingSnapshot: snapToPricing(opts.snap),
    billedVideoSec: opts.snap.billedVideoSec,
    walletHoldId: opts.holdId,
  });
  return outcome.ok ? opts.snap.points : null;
}

export async function ecomGenerateImage(opts: {
  userId: string;
  toolKey: string;
  action: string;
  module: string;
  prompt: string;
  estimatedMaxPoints?: number;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);
  const taskKey = `ecom-img:${workspaceId}`;

  let holdId: string | null = null;
  const metered = await shouldMeterEcomToolkitUsage(opts.userId, opts.toolKey);
  const snap = await resolveBillableSnapshot(opts.toolKey, opts.action, {
    userId: opts.userId,
    actuals: { imageCount: 1 },
  });

  if (metered && snap && snap.points > 0) {
    const est = opts.estimatedMaxPoints ?? Math.ceil(snap.points * 1.2);
    const hold = await reserveWalletHold({
      userId: opts.userId,
      toolKey: opts.toolKey,
      action: opts.action,
      estimatedMaxPoints: est,
      taskKey,
      meta: { module: opts.module },
    });
    if (!hold.ok) {
      throw new Error(
        hold.reason === "insufficient_balance" ? "积分不足" : "积分不足",
      );
    }
    holdId = hold.holdId;
  }

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

  let chargePoints: number | null = null;
  if (metered && snap && snap.points > 0) {
    chargePoints = await settleMetered({
      userId: opts.userId,
      toolKey: opts.toolKey,
      action: opts.action,
      taskKey,
      holdId,
      snap,
      meta: { imageCount: 1, modelId: DEFAULT_WANX_MODEL, taskKey } as Prisma.InputJsonValue,
    });
  }

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

  return { asset, chargePoints, taskId };
}

export async function ecomGenerateVideo(opts: {
  userId: string;
  toolKey: string;
  action: string;
  module: string;
  prompt: string;
  durationSec?: number;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const workspaceId = randomUUID().slice(0, 8);
  const durationSec = Math.max(5, Math.min(15, opts.durationSec ?? 5));
  const taskKey = `ecom-vid:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);
  const videoModel = "wan2.2-i2v-flash";

  let holdId: string | null = null;
  const metered = await shouldMeterEcomToolkitUsage(opts.userId, opts.toolKey);
  const snap = await resolveBillableSnapshot(opts.toolKey, opts.action, {
    userId: opts.userId,
    schemeARefModelKey: "doubao-seedance-1.5-pro",
    actuals: { durationSec, videoSr: 1080 },
  });

  if (metered && snap && snap.points > 0) {
    const est = Math.ceil(snap.points * 1.2);
    const hold = await reserveWalletHold({
      userId: opts.userId,
      toolKey: opts.toolKey,
      action: opts.action,
      estimatedMaxPoints: est,
      taskKey,
      meta: { module: opts.module, videoDurationSec: durationSec },
    });
    if (!hold.ok) {
      throw new Error(
        hold.reason === "insufficient_balance" ? "积分不足" : "积分不足",
      );
    }
    holdId = hold.holdId;
  }

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "video",
    model: videoModel,
    body: { prompt: opts.prompt, duration: durationSec },
    clientPage,
  });

  let videoUrl: string | null = null;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollDashscope(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      videoUrl = polled.outputUrl;
      break;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "视频任务失败");
    }
  }
  if (!videoUrl) {
    throw new Error("视频生成超时");
  }

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  let chargePoints: number | null = null;
  if (metered && snap && snap.points > 0) {
    chargePoints = await settleMetered({
      userId: opts.userId,
      toolKey: opts.toolKey,
      action: opts.action,
      taskKey,
      holdId,
      snap,
      meta: {
        videoDurationSec: durationSec,
        videoSr: 1080,
        modelId: videoModel,
        taskKey,
      } as Prisma.InputJsonValue,
    });
  }

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: opts.module,
      kind: "video",
      title: opts.prompt.slice(0, 80),
      prompt: opts.prompt,
      ossUrl,
      meta: { taskId, logId, durationSec },
    },
  });

  return { asset, taskId, chargePoints };
}
