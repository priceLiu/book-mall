/**
 * 火山方舟 · Seedream 图像生成/编辑（OpenAI 兼容 /images/generations）
 */

import { resolveVolcengineArkApiRoot } from "@/lib/gateway/model-router";
import { resolveVolcengineModelKey } from "@/lib/gateway/volcengine-chat-models";

export type VolcengineImageGenerationsParams = {
  size?: string;
  seed?: number;
  guidance_scale?: number;
  watermark?: boolean;
  stream?: boolean;
  /** 输出张数；Seedream 须配合 sequential_image_generation */
  n?: number;
  /** 图层拆分：仅控制底图；物体层恒 PNG */
  output_format?: "png" | "jpeg";
  /** Seedream 5.0 Pro 图层拆分模式；`size: auto` 仅在此模式下合法 */
  layer_decomposition?: boolean;
};

export type SeedreamLayerBbox = {
  normalized?: [number, number, number, number];
  absolute?: [number, number, number, number];
};

export type SeedreamLayerItem = {
  url: string;
  zIndex: number;
  bbox?: SeedreamLayerBbox;
  name?: string;
  isBackground: boolean;
};

export type VolcengineImageGenerationsRequest = {
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
  image?: string | string[];
  parameters?: VolcengineImageGenerationsParams;
};

export type VolcengineImageGenerationImage = { url?: string; b64?: string };

export type VolcengineImageGenerationsResult = {
  ok: true;
  images: VolcengineImageGenerationImage[];
  usage?: unknown;
  raw: Record<string, unknown>;
} | {
  ok: false;
  error: string;
};

function pickNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickHttpOrDataUrl(value: unknown): string | undefined {
  const s = pickNonEmptyString(value);
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s) || s.startsWith("data:image/")) return s;
  return undefined;
}

function imageFromRow(row: unknown): VolcengineImageGenerationImage | null {
  if (typeof row === "string") {
    const url = pickHttpOrDataUrl(row);
    return url ? { url } : null;
  }
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const nested =
    r.image && typeof r.image === "object" && !Array.isArray(r.image)
      ? (r.image as Record<string, unknown>)
      : null;
  const url =
    pickHttpOrDataUrl(r.url) ??
    pickHttpOrDataUrl(r.image_url) ??
    pickHttpOrDataUrl(r.imageUrl) ??
    pickHttpOrDataUrl(nested?.url);
  const b64 =
    pickNonEmptyString(r.b64_json) ??
    pickNonEmptyString(r.b64) ??
    pickNonEmptyString(nested?.b64_json);
  if (!url && !b64) return null;
  return { ...(url ? { url } : {}), ...(b64 ? { b64 } : {}) };
}

function imagesFromUnknown(value: unknown): VolcengineImageGenerationImage[] {
  if (Array.isArray(value)) {
    return value
      .map(imageFromRow)
      .filter((x): x is VolcengineImageGenerationImage => x != null);
  }
  const one = imageFromRow(value);
  return one ? [one] : [];
}

/** 火山方舟 /images/generations · 从厂商 JSON 抽出可用图（data / results / output.results） */
export function extractVolcengineImageGenerationImages(
  payload: Record<string, unknown>,
): VolcengineImageGenerationImage[] {
  const output =
    payload.output && typeof payload.output === "object" && !Array.isArray(payload.output)
      ? (payload.output as Record<string, unknown>)
      : null;
  for (const bucket of [
    payload.data,
    payload.results,
    payload.images,
    output?.data,
    output?.results,
    output?.images,
  ]) {
    const imgs = imagesFromUnknown(bucket);
    if (imgs.length > 0) return imgs;
  }
  const top = imageFromRow(payload);
  return top ? [top] : [];
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pickBboxTuple(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const nums = value.slice(0, 4).map((v) => (typeof v === "number" ? v : Number(v)));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
}

function parseLayerBbox(value: unknown): SeedreamLayerBbox | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const normalized = pickBboxTuple(row.normalized ?? row.normalized_bbox);
  const absolute = pickBboxTuple(row.absolute ?? row.absolute_bbox);
  if (!normalized && !absolute) return undefined;
  return {
    ...(normalized ? { normalized } : {}),
    ...(absolute ? { absolute } : {}),
  };
}

function layerUrlFromRow(row: Record<string, unknown>): string | undefined {
  const img = imageFromRow(row);
  return img?.url;
}

/** Seedream 5.0 Pro 图层拆分：从厂商 raw JSON 的 data[] 解析 metadata */
export function parseSeedreamLayerDecomposeResponse(
  raw: Record<string, unknown>,
): SeedreamLayerItem[] {
  const bucket = raw.data;
  if (!Array.isArray(bucket)) return [];

  const items: SeedreamLayerItem[] = [];
  for (let idx = 0; idx < bucket.length; idx++) {
    const row = bucket[idx];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const url = layerUrlFromRow(r);
    if (!url) continue;
    const zIndex =
      pickNumber(r.z_index) ??
      pickNumber(r.zIndex) ??
      pickNumber(r.layer_index) ??
      idx;
    const bbox = parseLayerBbox(r.bounding_box ?? r.bbox ?? r.boundingBox);
    const name =
      typeof r.name === "string" && r.name.trim()
        ? r.name.trim()
        : typeof r.layer_name === "string" && r.layer_name.trim()
          ? r.layer_name.trim()
          : undefined;
    items.push({
      url,
      zIndex,
      ...(bbox ? { bbox } : {}),
      ...(name ? { name } : {}),
      isBackground: zIndex === 0,
    });
  }

  if (items.length === 0) return items;
  const hasBackground = items.some((i) => i.isBackground);
  if (!hasBackground) {
    const minZ = Math.min(...items.map((i) => i.zIndex));
    for (const item of items) {
      if (item.zIndex === minZ) item.isBackground = true;
    }
  }
  return items.sort((a, b) => a.zIndex - b.zIndex);
}

function stripB64ForLog(raw: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(
      JSON.stringify(raw, (_key, value) => {
        if (typeof value === "string" && value.length > 400 && !/^https?:\/\//i.test(value)) {
          return `[omitted ${value.length} chars]`;
        }
        return value;
      }),
    ) as Record<string, unknown>;
  } catch {
    return { model: raw.model, created: raw.created, usage: raw.usage };
  }
}

/** Gateway 日志 resultSummary：保留厂商 data/results URL，避免只写 imageCount */
export function buildVolcengineImageLogResultSummary(
  raw: Record<string, unknown>,
  images: VolcengineImageGenerationImage[],
): Record<string, unknown> {
  const imageUrls = images
    .map((i) => i.url?.trim())
    .filter((u): u is string => Boolean(u));
  return {
    ...stripB64ForLog(raw),
    imageCount: images.length,
    ...(imageUrls.length ? { imageUrls } : {}),
  };
}

/** Seedream 5.0 Pro 不支持 sequential_image_generation（组图）；Lite 等可传。 */
export function resolveSeedreamSequentialImageGeneration(
  model: string,
  outputCount?: number,
): "auto" | "disabled" | null {
  const resolved = resolveVolcengineModelKey(model.trim()).toLowerCase();
  const isSeedream = resolved.includes("seedream");
  if (!isSeedream) return null;

  const isPro = /seedream-5-0-pro|seedream-5\.0-pro/.test(resolved);
  if (isPro) return null;

  if (outputCount && outputCount > 1) return "auto";
  return "disabled";
}

export function buildVolcengineImageGenerationsBody(
  req: Pick<VolcengineImageGenerationsRequest, "model" | "prompt" | "image" | "parameters">,
): Record<string, unknown> {
  const p = req.parameters ?? {};
  const body: Record<string, unknown> = {
    model: resolveVolcengineModelKey(req.model.trim()),
    prompt: req.prompt.trim(),
    response_format: "url",
    stream: false,
    watermark: false,
  };
  const nRaw = p.n;
  const outputCount =
    typeof nRaw === "number" && Number.isFinite(nRaw) && nRaw > 1
      ? Math.min(15, Math.floor(nRaw))
      : undefined;
  const sequentialMode = resolveSeedreamSequentialImageGeneration(req.model, outputCount);
  if (sequentialMode === "auto" && outputCount) {
    body.sequential_image_generation = "auto";
    body.sequential_image_generation_options = { max_images: outputCount };
  } else if (sequentialMode === "disabled") {
    body.sequential_image_generation = "disabled";
  }
  if (req.image) {
    if (Array.isArray(req.image)) {
      const imgs = req.image.map((u) => u.trim()).filter(Boolean);
      if (imgs.length > 0) body.image = imgs.length === 1 ? imgs[0] : imgs;
    } else if (req.image.trim()) {
      body.image = req.image.trim();
    }
  }
  if (p.size?.trim()) body.size = p.size.trim();
  if (p.seed !== undefined && Number.isFinite(p.seed)) body.seed = p.seed;
  if (p.guidance_scale !== undefined && Number.isFinite(p.guidance_scale)) {
    body.guidance_scale = p.guidance_scale;
  }
  if (p.watermark !== undefined) body.watermark = p.watermark;
  if (p.stream !== undefined) body.stream = p.stream;
  if (p.output_format === "png" || p.output_format === "jpeg") {
    body.output_format = p.output_format;
  }
  if (p.layer_decomposition === true) {
    body.layer_decomposition = true;
  }
  return body;
}

function extractApiKey(credPlain: string): string {
  const trimmed = credPlain.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { apiKey?: string };
      if (parsed.apiKey?.trim()) return parsed.apiKey.trim();
    } catch {
      /* plain key */
    }
  }
  return trimmed;
}

export async function volcengineImageGenerations(
  req: VolcengineImageGenerationsRequest,
): Promise<VolcengineImageGenerationsResult> {
  const root = resolveVolcengineArkApiRoot(req.baseUrl);
  const url = `${root}/images/generations`;
  const body = buildVolcengineImageGenerationsBody(req);

  const apiKey = extractApiKey(req.apiKey);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `火山方舟响应非 JSON (${response.status})`,
    };
  }

  if (!response.ok) {
    const errObj = data.error as { message?: string } | undefined;
    const msg =
      errObj?.message ||
      (typeof data.message === "string" ? data.message : null) ||
      `火山方舟 HTTP ${response.status}`;
    return { ok: false, error: msg };
  }

  const images = extractVolcengineImageGenerationImages(data);
  if (images.length === 0) {
    return { ok: false, error: "未返回图像" };
  }
  return { ok: true, images, usage: data.usage, raw: data };
}
