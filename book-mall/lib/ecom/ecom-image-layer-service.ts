import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildBatchEditPrompt,
  buildDecomposePrompt,
  validateDecomposeBboxes,
} from "@/lib/ecom/ecom-image-layer-prompt";
import {
  ensureSeedreamLayerDecomposeImageUrl,
  mapSeedreamLayerDecomposeError,
} from "@/lib/ecom/ecom-image-layer-source-normalize";
import { createOssClientFrom, ossGetBuffer, readOssEnv } from "@/lib/oss-client";
import { ecomGwVolcengineImageEdit } from "@/lib/gateway/ecom-tool-gateway-client";
import type { SeedreamLayerItem } from "@/lib/gateway/volcengine-image-generations-proxy";

export const ECOM_IMAGE_LAYER_MODEL = "doubao-seedream-5-0-pro";
export const ECOM_IMAGE_LAYER_TOOL_KEY = "ecom-toolkit__image-layer";
/** 与 Seedream 物体层上限一致 */
export const ECOM_IMAGE_LAYER_MAX_BBOXES = 16;

export type ImageLayerBbox = {
  normalized?: [number, number, number, number];
  absolute?: [number, number, number, number];
};

function asBboxQuad(raw?: number[]): [number, number, number, number] | undefined {
  if (!raw || raw.length < 4) return undefined;
  return [Number(raw[0]), Number(raw[1]), Number(raw[2]), Number(raw[3])];
}

function toSeedreamLayers(
  layers: Array<{
    url: string;
    zIndex: number;
    bbox?: { normalized?: number[]; absolute?: number[] };
    name?: string;
    isBackground: boolean;
  }>,
): SeedreamLayerItem[] {
  return layers.map((layer) => ({
    url: layer.url,
    zIndex: layer.zIndex,
    name: layer.name,
    isBackground: layer.isBackground,
    bbox: layer.bbox
      ? {
          normalized: asBboxQuad(layer.bbox.normalized),
          absolute: asBboxQuad(layer.bbox.absolute),
        }
      : undefined,
  }));
}

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
    return { layers: toSeedreamLayers(layers), images, logId };
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
  if (opts.bboxes && opts.bboxes.length > ECOM_IMAGE_LAYER_MAX_BBOXES) {
    throw new Error(`最多 ${ECOM_IMAGE_LAYER_MAX_BBOXES} 个拆分框`);
  }
  if (opts.bboxes?.length) {
    validateDecomposeBboxes(opts.bboxes);
  }
  let publicUrl: string;
  try {
    publicUrl = await ensureSeedreamLayerDecomposeImageUrl({
      userId: opts.userId,
      imageUrl: opts.sourceImageUrl,
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "原图预处理失败");
  }
  const prompt = buildDecomposePrompt(opts.bboxes ?? []);
  const size = opts.size?.trim() || "auto";

  let layers: SeedreamLayerItem[];
  let logId: string;
  try {
    const result = await callSeedreamLayerGenerations({
      userId: opts.userId,
      prompt,
      image: publicUrl,
      size,
      outputFormat: "jpeg",
      clientPage: "ecom/image-layer/decompose",
    });
    layers = result.layers;
    logId = result.logId;
  } catch (e) {
    const raw = e instanceof Error ? e.message : "图层拆分失败";
    throw new Error(
      mapSeedreamLayerDecomposeError(raw, { bboxCount: opts.bboxes?.length ?? 0 }),
    );
  }

  const persisted = await persistLayerStack(opts.userId, layers);
  return buildStackFromLayers(persisted, logId, publicUrl);
}

export type ImageLayerEditJob = {
  bbox: [number, number, number, number];
  prompt: string;
};

/**
 * 批量改层：一次交互编辑（多 bbox prompt）→ 一次重拆（优先沿用原框坐标）。
 */
export async function editImageLayerRegions(opts: {
  userId: string;
  compositeImageUrl: string;
  edits: ImageLayerEditJob[];
  /** 重拆时沿用的框选坐标（与初次拆分一致时成功率更高） */
  redecomposeBboxes?: Array<[number, number, number, number]>;
  size?: string;
}): Promise<ImageLayerStack> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  if (opts.edits.length === 0) {
    throw new Error("缺少编辑区域");
  }
  if (opts.edits.length > ECOM_IMAGE_LAYER_MAX_BBOXES) {
    throw new Error(`最多 ${ECOM_IMAGE_LAYER_MAX_BBOXES} 个改层区域`);
  }

  let publicUrl: string;
  try {
    publicUrl = await ensureSeedreamLayerDecomposeImageUrl({
      userId: opts.userId,
      imageUrl: opts.compositeImageUrl,
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "改层底图预处理失败");
  }

  const editPrompt = buildBatchEditPrompt(opts.edits);

  const { images, logId: editLogId } = await ecomGwVolcengineImageEdit(opts.userId, {
    model: ECOM_IMAGE_LAYER_MODEL,
    prompt: editPrompt,
    image: publicUrl,
    parameters: { size: "auto", output_format: "png" },
    clientPage: "ecom/image-layer/edit",
  });

  const editedUrl = await persistVendorImage(opts.userId, images[0] ?? {}, "png");

  let stack: ImageLayerStack;
  try {
    stack = await decomposeImageLayer({
      userId: opts.userId,
      sourceImageUrl: editedUrl,
      bboxes: opts.redecomposeBboxes,
      size: opts.size?.trim() || "auto",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "图层重拆失败";
    throw new Error(
      mapSeedreamLayerDecomposeError(raw, {
        bboxCount: opts.redecomposeBboxes?.length ?? 0,
        afterEdit: true,
      }),
    );
  }

  return { ...stack, logId: editLogId || stack.logId };
}

/** @deprecated 请用 editImageLayerRegions；保留单区域签名供兼容 */
export async function editImageLayerRegion(opts: {
  userId: string;
  compositeImageUrl: string;
  bbox: [number, number, number, number];
  prompt: string;
  redecomposeBboxes?: Array<[number, number, number, number]>;
  size?: string;
}): Promise<ImageLayerStack> {
  return editImageLayerRegions({
    userId: opts.userId,
    compositeImageUrl: opts.compositeImageUrl,
    edits: [{ bbox: opts.bbox, prompt: opts.prompt }],
    redecomposeBboxes: opts.redecomposeBboxes,
    size: opts.size,
  });
}
