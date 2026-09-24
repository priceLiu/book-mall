import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildBackgroundReplaceRequest,
  buildSeedreamBackgroundReplacePrompt,
  fillTransparentHolesFromNeighbors,
  hasMeaningfulTransparency,
  knockOutFakeBackdrop,
  resolveBackgroundReplaceModel,
  sealWanxBackgroundResult,
  SEEDREAM_BACKGROUND_REPLACE_MODEL,
  toRgbaPngBuffer,
  WANX_BACKGROUND_GENERATION_MODEL,
  WANX_CUTOUT_MIN_ALPHA_RATIO,
  type BackgroundReplaceInput,
} from "@/lib/ecom/ecom-background-replace";
import { ecomImageProcessingBgRemove } from "@/lib/ecom/ecom-image-processing";
import {
  GatewayRequiredError,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { ecomGwVolcengineImageEdit } from "@/lib/gateway/ecom-tool-gateway-client";
import { gatewayV1BackgroundGeneration } from "@/lib/gateway/gateway-v1-http-client";
import { gatewayV1ClientMetaForBookUser } from "@/lib/gateway/gateway-log-meta-for-user";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { ensurePublicImageUrl } from "@/lib/image-local-edit/image-url";
import { prisma } from "@/lib/prisma";

export type BackgroundReplaceResult = {
  imageUrls: string[];
  logId: string;
  creditsCharged?: number | null;
  modelKey: string;
};

async function rehostResultUrl(userId: string, url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载换背景结果失败 HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (!bytes || bytes.byteLength === 0) throw new Error("换背景结果下载为空");
  const buf = Buffer.from(bytes);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg") ? "jpg" : "png";
  return uploadCanvasUserBuffer({
    userId,
    ext,
    buf,
    contentType: ext === "jpg" ? "image/jpeg" : "image/png",
  });
}

async function persistVendorImage(
  userId: string,
  image: { url?: string; b64?: string },
): Promise<string> {
  if (image.b64?.trim()) {
    const buf = Buffer.from(image.b64.trim(), "base64");
    return uploadCanvasUserBuffer({
      userId,
      ext: "png",
      buf,
      contentType: "image/png",
    });
  }
  const url = image.url?.trim();
  if (!url) throw new Error("厂商未返回图像 URL");
  return rehostResultUrl(userId, url);
}

async function publicize(userId: string, url?: string): Promise<string | undefined> {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return undefined;
  return ensurePublicImageUrl(userId, trimmed);
}

async function downloadImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`主体图下载失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.byteLength) throw new Error("主体图为空");
  return buf;
}

async function creditsForLog(logId: string): Promise<number | null> {
  if (!logId) return null;
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { creditsCharged: true },
  });
  return log?.creditsCharged == null ? null : Number(log.creditsCharged);
}

/**
 * 万相第一步：抠出真透明主体。不走拆层。
 * 生图抠图常把透明画成白底或棋盘格，这里再打成真 alpha。
 */
export async function prepareWanxSubjectCutout(
  userId: string,
  url: string,
): Promise<string> {
  await assertEcomToolkitGatewayAccess(userId);
  const reachable = await ensurePublicImageUrl(userId, url);
  let buf = await toRgbaPngBuffer(await downloadImageBuffer(reachable));
  if (!(await hasMeaningfulTransparency(buf, WANX_CUTOUT_MIN_ALPHA_RATIO))) {
    const cut = await ecomImageProcessingBgRemove({
      userId,
      sourceImageDataUrl: reachable,
      bgMode: "transparent",
    });
    const cutUrl = cut.results[0]?.ossUrl;
    if (!cutUrl) throw new Error("未能抠出主体，换背景中止");
    buf = await toRgbaPngBuffer(await downloadImageBuffer(cutUrl));
  }
  buf = await knockOutFakeBackdrop(buf);
  if (!(await hasMeaningfulTransparency(buf, WANX_CUTOUT_MIN_ALPHA_RATIO))) {
    throw new Error(
      "主体图没有足够的透明区域，万相无法换背景。请换一张主体更清晰的图后重试。",
    );
  }
  return uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });
}

/** 万相第二步：透明底主体换场景。入参必须已是 RGBA。 */
export async function runWanxBackgroundGeneration(opts: {
  userId: string;
  input: BackgroundReplaceInput;
  clientPage?: string;
}): Promise<BackgroundReplaceResult> {
  const auth = await resolveGatewayAuthForBookUser(opts.userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  routeGatewayModel(WANX_BACKGROUND_GENERATION_MODEL);
  if (!pickCredentialForKind(auth.credentials, "BAILIAN")) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼 / DashScope 凭证");
  }

  const baseImageUrl = opts.input.baseImageUrl.trim();
  if (!baseImageUrl) throw new Error("主体图不可用");
  const refImageUrl = await publicize(opts.userId, opts.input.refImageUrl);
  const foregroundEdges = await Promise.all(
    (opts.input.foregroundEdges ?? []).map(async (e) => ({
      url: (await publicize(opts.userId, e.url)) ?? "",
      prompt: e.prompt,
    })),
  );
  const backgroundEdges = await Promise.all(
    (opts.input.backgroundEdges ?? []).map(async (e) => ({
      url: (await publicize(opts.userId, e.url)) ?? "",
      prompt: e.prompt,
    })),
  );

  const request = buildBackgroundReplaceRequest({
    ...opts.input,
    baseImageUrl,
    refImageUrl,
    foregroundEdges: foregroundEdges.filter((e) => e.url),
    backgroundEdges: backgroundEdges.filter((e) => e.url),
  });

  const meta = await gatewayV1ClientMetaForBookUser("ECOM", opts.userId, {
    clientPage: opts.clientPage ?? "ecom/background-replace",
  });
  const gatewayResult = await gatewayV1BackgroundGeneration({
    apiKeyId: auth.id,
    body: { input: request.input, parameters: request.parameters },
    meta,
  });

  const imageUrls: string[] = [];
  for (const url of gatewayResult.imageUrls) {
    let buf = await downloadImageBuffer(url);
    let sealed = await sealWanxBackgroundResult(buf);
    if (sealed.needsSecondPass) {
      const holeUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "png",
        buf: sealed.buf,
        contentType: "image/png",
      });
      const second = await gatewayV1BackgroundGeneration({
        apiKeyId: auth.id,
        body: {
          input: { ...request.input, base_image_url: holeUrl },
          parameters: request.parameters,
        },
        meta,
      });
      const secondUrl = second.imageUrls[0] ?? url;
      buf = await downloadImageBuffer(secondUrl);
      sealed = await sealWanxBackgroundResult(buf);
      if (sealed.needsSecondPass) {
        sealed = {
          buf: await fillTransparentHolesFromNeighbors(sealed.buf),
          needsSecondPass: false,
        };
      }
    }
    imageUrls.push(
      await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "png",
        buf: sealed.buf,
        contentType: "image/png",
      }),
    );
  }

  return {
    imageUrls,
    logId: gatewayResult.logId,
    creditsCharged: await creditsForLog(gatewayResult.logId),
    modelKey: WANX_BACKGROUND_GENERATION_MODEL,
  };
}

async function runSeedreamBackgroundReplace(opts: {
  userId: string;
  input: BackgroundReplaceInput;
  clientPage?: string;
}): Promise<BackgroundReplaceResult> {
  const image = await ensurePublicImageUrl(opts.userId, opts.input.baseImageUrl);
  const refImage = opts.input.refImageUrl?.trim()
    ? await ensurePublicImageUrl(opts.userId, opts.input.refImageUrl)
    : "";
  const prompt = buildSeedreamBackgroundReplacePrompt({
    scene: opts.input.refPrompt ?? "",
    bbox: opts.input.bbox,
    hasRefImage: Boolean(refImage),
    refBbox: opts.input.refBbox,
  });
  const { images, logId } = await ecomGwVolcengineImageEdit(opts.userId, {
    model: SEEDREAM_BACKGROUND_REPLACE_MODEL,
    prompt,
    image: refImage ? [image, refImage] : image,
    parameters: {
      size: "2K",
      output_format: "png",
      watermark: false,
    },
    clientPage: opts.clientPage ?? "ecom/background-replace",
  });
  const first = images[0];
  if (!first) throw new Error("Seedream 未返回换背景结果");
  const ossUrl = await persistVendorImage(opts.userId, first);
  return {
    imageUrls: [ossUrl],
    logId,
    creditsCharged: await creditsForLog(logId),
    modelKey: SEEDREAM_BACKGROUND_REPLACE_MODEL,
  };
}

export async function runEcomBackgroundReplace(opts: {
  userId: string;
  input: BackgroundReplaceInput;
  clientPage?: string;
}): Promise<BackgroundReplaceResult> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  resolveBackgroundReplaceModel(opts.input.modelKey);
  return runSeedreamBackgroundReplace({
    userId: opts.userId,
    input: opts.input,
    clientPage: opts.clientPage,
  });
}
