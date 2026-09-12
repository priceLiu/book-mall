import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertCommonToolsGatewayAccess } from "@/lib/common-tools/common-tools-gateway-auth";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  isQwenEditModelKey,
  isWanxPaintingModelKey,
} from "@/lib/ecom/ecom-image-processing-models";
import { prisma } from "@/lib/prisma";
import { runQwenLocalEditAdapter } from "./adapters/qwen-edit";
import { runWan27LocalEditAdapter } from "./adapters/wan27-edit";
import { runWanxPaintingLocalEditAdapter } from "./adapters/wanx-painting";
import {
  assertLocalEditSelection,
  isWan27LocalEditModel,
} from "./model-capabilities";
import { mergeLocalEditOutputSize } from "./output-size";
import type { LocalEditRequest, LocalEditResult } from "./types";

async function assertLocalEditGatewayAccess(
  userId: string,
  clientApp: LocalEditRequest["clientApp"],
): Promise<void> {
  if (clientApp === "canvas") return;
  if (clientApp === "common-tools") {
    await assertCommonToolsGatewayAccess(userId);
    return;
  }
  await assertEcomToolkitGatewayAccess(userId);
}

async function downloadToOss(opts: {
  userId: string;
  url: string;
  prompt: string;
  model: string;
  logId: string;
}) {
  const res = await fetch(opts.url);
  if (!res.ok) throw new Error(`下载生成图失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext,
    buf,
    contentType,
  });
  return ossUrl;
}

async function persistEcomAssets(opts: {
  userId: string;
  imageUrls: string[];
  prompt: string;
  model: string;
  logId: string;
}) {
  const results = [];
  for (const url of opts.imageUrls) {
    const ossUrl = await downloadToOss({
      userId: opts.userId,
      url,
      prompt: opts.prompt,
      model: opts.model,
      logId: opts.logId,
    });
    const asset = await prisma.ecomAsset.create({
      data: {
        userId: opts.userId,
        module: "image-processing",
        kind: "image",
        title: opts.prompt.slice(0, 80),
        prompt: opts.prompt,
        ossUrl,
        thumbnailUrl: ossUrl,
        meta: { model: opts.model, mode: "retouch", logId: opts.logId },
      },
    });
    results.push({ asset, ossUrl });
  }
  if (results.length === 0) throw new Error("未获得可保存的图像");
  return results;
}

async function rehostResultUrls(userId: string, urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    out.push(await downloadToOss({ userId, url, prompt: "", model: "", logId: "" }));
  }
  return out;
}

async function readCreditsCharged(logId: string): Promise<number | null> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { creditsCharged: true },
  });
  if (log?.creditsCharged == null) return null;
  return Number(log.creditsCharged);
}

export async function runLocalImageEdit(opts: LocalEditRequest): Promise<LocalEditResult> {
  await assertLocalEditGatewayAccess(opts.userId, opts.clientApp);
  assertLocalEditSelection(opts.modelKey, opts.selection);

  if (!opts.prompt.trim()) {
    throw new Error("prompt 必填");
  }
  if (opts.sourceImageUrls.length === 0) {
    throw new Error("请提供源图");
  }

  const clientPage =
    opts.clientPage ??
    (opts.clientApp === "canvas"
      ? `canvas/inpaint/${randomUUID().slice(0, 8)}`
      : undefined);

  const parameters = mergeLocalEditOutputSize(
    opts.parameters,
    opts.sourceImageSize,
  );

  let gatewayResult: { imageUrls: string[]; logId: string };

  if (isWanxPaintingModelKey(opts.modelKey)) {
    gatewayResult = await runWanxPaintingLocalEditAdapter({
      userId: opts.userId,
      clientApp: opts.clientApp,
      prompt: opts.prompt,
      sourceImageUrls: opts.sourceImageUrls,
      selection: opts.selection!,
      parameters,
      clientPage,
    });
  } else if (isWan27LocalEditModel(opts.modelKey)) {
    gatewayResult = await runWan27LocalEditAdapter({
      userId: opts.userId,
      clientApp: opts.clientApp,
      prompt: opts.prompt,
      sourceImageUrls: opts.sourceImageUrls,
      selection: opts.selection!,
      parameters,
      clientPage,
    });
  } else if (isQwenEditModelKey(opts.modelKey)) {
    gatewayResult = await runQwenLocalEditAdapter({
      userId: opts.userId,
      clientApp: opts.clientApp,
      modelKey: opts.modelKey,
      prompt: opts.prompt,
      sourceImageUrls: opts.sourceImageUrls,
      selection: opts.selection,
      parameters,
      clientPage,
    });
  } else {
    throw new Error("不支持的局部编辑模型");
  }

  const creditsCharged = await readCreditsCharged(gatewayResult.logId);

  if (opts.persistEcomAssets) {
    const ecomAssets = await persistEcomAssets({
      userId: opts.userId,
      imageUrls: gatewayResult.imageUrls,
      prompt: opts.prompt,
      model: opts.modelKey,
      logId: gatewayResult.logId,
    });
    return {
      imageUrls: ecomAssets.map((r) => r.ossUrl),
      logId: gatewayResult.logId,
      creditsCharged,
      ecomAssets,
    };
  }

  const imageUrls = await rehostResultUrls(opts.userId, gatewayResult.imageUrls);
  return {
    imageUrls,
    logId: gatewayResult.logId,
    creditsCharged,
  };
}
