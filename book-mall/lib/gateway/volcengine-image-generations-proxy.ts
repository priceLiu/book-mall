/**
 * 火山方舟 · Seedream 图像生成/编辑（OpenAI 兼容 /images/generations）
 */

import { resolveVolcengineArkApiRoot } from "@/lib/gateway/model-router";

export type VolcengineImageGenerationsParams = {
  size?: string;
  seed?: number;
  guidance_scale?: number;
  watermark?: boolean;
  stream?: boolean;
};

export type VolcengineImageGenerationsRequest = {
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
  image?: string;
  parameters?: VolcengineImageGenerationsParams;
};

export type VolcengineImageGenerationsResult = {
  ok: true;
  images: Array<{ url?: string; b64?: string }>;
  usage?: unknown;
} | {
  ok: false;
  error: string;
};

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
  const p = req.parameters ?? {};
  const body: Record<string, unknown> = {
    model: req.model.trim(),
    prompt: req.prompt.trim(),
    response_format: "url",
    sequential_image_generation: "disabled",
    stream: false,
    watermark: false,
  };
  if (req.image?.trim()) body.image = req.image.trim();
  if (p.size?.trim()) body.size = p.size.trim();
  if (p.seed !== undefined && Number.isFinite(p.seed)) body.seed = p.seed;
  if (p.guidance_scale !== undefined && Number.isFinite(p.guidance_scale)) {
    body.guidance_scale = p.guidance_scale;
  }
  if (p.watermark !== undefined) body.watermark = p.watermark;
  if (p.stream !== undefined) body.stream = p.stream;

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

  const rows = (data.data ?? []) as Array<{ url?: string; b64_json?: string }>;
  const images = rows.map((row) => ({
    url: row.url,
    b64: row.b64_json,
  }));
  if (images.length === 0) {
    return { ok: false, error: "未返回图像" };
  }
  return { ok: true, images, usage: data.usage };
}
