import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { createOssClientFrom, ossGetBuffer, readOssEnv } from "@/lib/oss-client";
import { ecomGwVolcengineImageEdit } from "@/lib/gateway/ecom-tool-gateway-client";
import type { SeedreamLayerItem } from "@/lib/gateway/volcengine-image-generations-proxy";

export const ECOM_IMAGE_LAYER_MODEL = "doubao-seedream-5-0-pro";
export const ECOM_IMAGE_LAYER_TOOL_KEY = "ecom-toolkit__image-layer";

const AUTO_DECOMPOSE_PROMPT =
  "将图片进行精确图层分离，对图片做完整图层语义分离。";

export type ImageLayerBbox = {
  normalized?: [number, number, number, number];
  absolute?: [number, number, number, number];
};

export type ImageLayerStackItem = {
  id: string;
  url: string;
  zIndex: number;
  bbox?: ImageLayerBbox;
  name?: string;
  isBackground: boolean;
};

export type ImageLayerStack = {
  sourceImageUrl?: string;
  background: ImageLayerStackItem;
  layers: ImageLayerStackItem[];
  logId?: string;
};

function clamp999(n: number): number {
  return Math.max(0, Math.min(999, Math.round(n)));
}

export function buildDecomposePrompt(
  bboxes: Array<[number, number, number, number]>,
): string {
  if (bboxes.length === 0) return AUTO_DECOMPOSE_PROMPT;
  const tags = bboxes
    .map(
      (b) =>
        `<bbox>${clamp999(b[0])} ${clamp999(b[1])} ${clamp999(b[2])} ${clamp999(b[3])}</bbox>`,
    )
    .join("、");
  return `将图片进行精确图层分离，需分离的区域坐标为 ${tags}。`;
}

export function buildEditPrompt(
  bbox: [number, number, number, number],
  userText: string,
): string {
  const text = userText.trim();
  const tag = `<bbox>${clamp999(bbox[0])} ${clamp999(bbox[1])} ${clamp999(bbox[2])} ${clamp999(bbox[3])}</bbox>`;
  return `把图 1 ${tag} 区域${text}`;
}

function parseDataUrl(dataUrl: string): { buf: Buffer; contentType: string; ext: string } {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("无效的图片 data URL");
  const contentType = m[1] || "image/png";
  const buf = Buffer.from(m[2], "base64");
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  return { buf, contentType, ext };
}

function tryParseManagedOssObjectKey(url: string): string | null {
  const cfg = readOssEnv();
  if ("error" in cfg) return null;
  try {
    const u = new URL(url);
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
    if (u.hostname === `${cfg.bucket}.${cfg.region}.aliyuncs.com`) {
      return decodeURIComponent(u.pathname.replace(/^\//, ""));
    }
  } catch {
    return null;
  }
  return null;
}

async function isVendorFetchableHttpUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (r.ok) return true;
    if (r.status === 405) {
      const getRes = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
      });
      return getRes.ok || getRes.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

async function rehostImageForVendor(userId: string, url: string): Promise<string> {
  const ossKey = tryParseManagedOssObjectKey(url);
  if (ossKey) {
    const cfg = readOssEnv();
    if (!("error" in cfg)) {
      const client = await createOssClientFrom(cfg);
      const buf = await ossGetBuffer(client, { key: ossKey });
      if (buf?.byteLength) {
        const ext = ossKey.includes(".") ? ossKey.split(".").pop()! : "png";
        return uploadCanvasUserBuffer({
          userId,
          ext,
          buf,
          contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
        });
      }
    }
  }

  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`参考图不可被厂商拉取（HTTP ${res.status}），请重新上传后重试`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  return uploadCanvasUserBuffer({ userId, ext, buf, contentType });
}

async function ensurePublicImageUrl(userId: string, image: string): Promise<string> {
  const trimmed = image.trim();
  if (trimmed.startsWith("data:")) {
    const { buf, contentType, ext } = parseDataUrl(trimmed);
    return uploadCanvasUserBuffer({ userId, ext, buf, contentType });
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (await isVendorFetchableHttpUrl(trimmed)) return trimmed;
    return rehostImageForVendor(userId, trimmed);
  }
  throw new Error("不支持的图片格式");
}

async function persistVendorImage(
  userId: string,
  image: { url?: string; b64?: string },
  extHint: "png" | "jpg" = "png",
): Promise<string> {
  if (image.b64?.trim()) {
    const buf = Buffer.from(image.b64.trim(), "base64");
    return uploadCanvasUserBuffer({
      userId,
      ext: extHint,
      buf,
      contentType: extHint === "jpg" ? "image/jpeg" : "image/png",
    });
  }
  const url = image.url?.trim();
  if (!url) throw new Error("厂商未返回图像 URL");
  return rehostImageForVendor(userId, url);
}

function toStackItem(row: SeedreamLayerItem): ImageLayerStackItem {
  return {
    id: randomUUID(),
    url: row.url,
    zIndex: row.zIndex,
    ...(row.bbox
      ? {
          bbox: {
            ...(row.bbox.normalized
              ? { normalized: row.bbox.normalized }
              : {}),
            ...(row.bbox.absolute ? { absolute: row.bbox.absolute } : {}),
          } as ImageLayerBbox,
        }
      : {}),
    ...(row.name ? { name: row.name } : {}),
    isBackground: row.isBackground,
  };
}

function buildStackFromLayers(
  layers: SeedreamLayerItem[],
  logId?: string,
  sourceImageUrl?: string,
): ImageLayerStack {
  if (layers.length === 0) {
    throw new Error("图层拆分未返回有效图层");
  }
  const items = layers.map(toStackItem);
  const background =
    items.find((i) => i.isBackground) ??
    items.reduce((min, cur) => (cur.zIndex < min.zIndex ? cur : min), items[0]!);
  background.isBackground = true;
  const objectLayers = items
    .filter((i) => i.id !== background.id)
    .sort((a, b) => a.zIndex - b.zIndex);
  return {
    ...(sourceImageUrl ? { sourceImageUrl } : {}),
    background,
    layers: objectLayers,
    ...(logId ? { logId } : {}),
  };
}

async function callSeedreamLayerGenerations(opts: {
  userId: string;
  prompt: string;
  image: string;
  size: string;
  outputFormat?: "png" | "jpeg";
  clientPage: string;
}): Promise<{
  layers: SeedreamLayerItem[];
  images: Array<{ url?: string; b64?: string }>;
  logId: string;
}> {
  const { layers, images, logId } = await ecomGwVolcengineImageEdit(opts.userId, {
    model: ECOM_IMAGE_LAYER_MODEL,
    prompt: opts.prompt,
    image: opts.image,
    parameters: {
      size: opts.size,
      layer_decomposition: true,
      ...(opts.outputFormat ? { output_format: opts.outputFormat } : {}),
    },
    clientPage: opts.clientPage,
  });
  if (layers?.length) {
    return { layers, images, logId };
  }
  const persisted = await Promise.all(
    images.map((img) => persistVendorImage(opts.userId, img)),
  );
  const fallbackLayers: SeedreamLayerItem[] = persisted.map((url, idx) => ({
    url,
    zIndex: idx,
    isBackground: idx === 0,
  }));
  return { layers: fallbackLayers, images, logId };
}

async function persistLayerStack(
  userId: string,
  layers: SeedreamLayerItem[],
): Promise<SeedreamLayerItem[]> {
  const out: SeedreamLayerItem[] = [];
  for (const layer of layers) {
    const url = await persistVendorImage(
      userId,
      { url: layer.url },
      layer.isBackground ? "jpg" : "png",
    );
    out.push({ ...layer, url });
  }
  return out;
}

export async function uploadImageLayerSource(opts: {
  userId: string;
  buf: Buffer;
  contentType: string;
}): Promise<{ ossUrl: string }> {
  const ct = opts.contentType.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
  if (!ct.includes("jpeg") && !ct.includes("png")) {
    throw new Error("仅支持 png、jpeg 格式");
  }
  if (opts.buf.byteLength > 30 * 1024 * 1024) {
    throw new Error("图片过大（最大 30MB）");
  }
  const ext = ct.includes("jpeg") ? "jpg" : "png";
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: opts.buf,
    contentType: ct,
    ext,
  });
  return { ossUrl };
}

export async function decomposeImageLayer(opts: {
  userId: string;
  sourceImageUrl: string;
  bboxes?: Array<[number, number, number, number]>;
  size?: string;
}): Promise<ImageLayerStack> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const publicUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageUrl);
  const prompt = buildDecomposePrompt(opts.bboxes ?? []);
  const size = opts.size?.trim() || "auto";

  const { layers, logId } = await callSeedreamLayerGenerations({
    userId: opts.userId,
    prompt,
    image: publicUrl,
    size,
    outputFormat: "jpeg",
    clientPage: "ecom/image-layer/decompose",
  });

  const persisted = await persistLayerStack(opts.userId, layers);
  return buildStackFromLayers(persisted, logId, publicUrl);
}

export async function editImageLayerRegion(opts: {
  userId: string;
  compositeImageUrl: string;
  bbox: [number, number, number, number];
  prompt: string;
  /** 策略 A：编辑后自动重拆 */
  size?: string;
}): Promise<ImageLayerStack> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const publicUrl = await ensurePublicImageUrl(opts.userId, opts.compositeImageUrl);
  const editPrompt = buildEditPrompt(opts.bbox, opts.prompt);

  const { images, logId: editLogId } = await ecomGwVolcengineImageEdit(opts.userId, {
    model: ECOM_IMAGE_LAYER_MODEL,
    prompt: editPrompt,
    image: publicUrl,
    parameters: { size: "2K", output_format: "png" },
    clientPage: "ecom/image-layer/edit",
  });

  const editedUrl = await persistVendorImage(opts.userId, images[0] ?? {}, "png");

  const stack = await decomposeImageLayer({
    userId: opts.userId,
    sourceImageUrl: editedUrl,
    size: opts.size?.trim() || "auto",
  });

  return { ...stack, logId: editLogId || stack.logId };
}
