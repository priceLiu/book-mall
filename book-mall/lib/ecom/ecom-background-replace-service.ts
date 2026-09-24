import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildBackgroundReplaceRequest,
  hasMeaningfulTransparency,
  knockOutFakeBackdrop,
  toRgbaPngBuffer,
  WANX_BACKGROUND_GENERATION_MODEL,
  type BackgroundReplaceInput,
} from "@/lib/ecom/ecom-background-replace";
import { ecomImageProcessingBgRemove } from "@/lib/ecom/ecom-image-processing";
import {
  GatewayRequiredError,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { gatewayV1BackgroundGeneration } from "@/lib/gateway/gateway-v1-http-client";
import { gatewayV1ClientMetaForBookUser } from "@/lib/gateway/gateway-log-meta-for-user";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { ensurePublicImageUrl } from "@/lib/image-local-edit/image-url";
import { prisma } from "@/lib/prisma";

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

/**
 * 万相只在透明区域画新场景。这里在换背景内部准备主体，不走拆层。
 * 生图抠图常把透明画成白底或棋盘格；必须打成真 alpha 再交给万相。
 */
async function publicizeBaseAsRgbaPng(userId: string, url: string): Promise<string> {
  const reachable = await ensurePublicImageUrl(userId, url);
  let buf = await toRgbaPngBuffer(await downloadImageBuffer(reachable));
  if (!(await hasMeaningfulTransparency(buf))) {
    const cut = await ecomImageProcessingBgRemove({
      userId,
      sourceImageDataUrl: reachable,
      bgMode: "transparent",
    });
    const cutUrl = cut.results[0]?.ossUrl;
    if (!cutUrl) throw new Error("未能抠出主体，换背景中止");
    buf = await toRgbaPngBuffer(await downloadImageBuffer(cutUrl));
  }
  if (!(await hasMeaningfulTransparency(buf))) {
    buf = await knockOutFakeBackdrop(buf);
  }
  if (!(await hasMeaningfulTransparency(buf))) {
    throw new Error("主体图没有透明区域，万相无法换背景。请换一张主体更清晰的图后重试。");
  }
  return uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });
}

export async function runEcomBackgroundReplace(opts: {
  userId: string;
  input: BackgroundReplaceInput;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string; creditsCharged?: number | null }> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const auth = await resolveGatewayAuthForBookUser(opts.userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  routeGatewayModel(WANX_BACKGROUND_GENERATION_MODEL);
  if (!pickCredentialForKind(auth.credentials, "BAILIAN")) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼 / DashScope 凭证");
  }

  const baseImageUrl = await publicizeBaseAsRgbaPng(
    opts.userId,
    opts.input.baseImageUrl,
  );
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

  const gatewayResult = await gatewayV1BackgroundGeneration({
    apiKeyId: auth.id,
    body: { input: request.input, parameters: request.parameters },
    meta: await gatewayV1ClientMetaForBookUser("ECOM", opts.userId, {
      clientPage: opts.clientPage ?? "ecom/background-replace",
    }),
  });

  const imageUrls = await Promise.all(
    gatewayResult.imageUrls.map((u) => rehostResultUrl(opts.userId, u)),
  );
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayResult.logId },
    select: { creditsCharged: true },
  });
  return {
    imageUrls,
    logId: gatewayResult.logId,
    creditsCharged: log?.creditsCharged == null ? null : Number(log.creditsCharged),
  };
}
