/**
 * 百炼 / DashScope · Qwen-Image-Edit 同步图像编辑（multimodal-generation）
 * @see https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-guide
 */

const QWEN_IMAGE_EDIT_PATH =
  "/api/v1/services/aigc/multimodal-generation/generation";

export type QwenImageEditParams = {
  negative_prompt?: string;
  prompt_extend?: boolean;
  /** qwen-image-3.0 系列 · direct | agent（仅 T2I） */
  prompt_extend_mode?: "direct" | "agent";
  /** qwen-image-3.0 系列 · 思考模式（prompt_extend=true 时生效） */
  enable_thinking?: boolean;
  watermark?: boolean;
  seed?: number;
  n?: number;
  size?: string;
};

export type QwenImageEditContentItem =
  | { image: string }
  | { text: string };

export const QWEN_IMAGE_EDIT_MODELS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
] as const;

export const DASHSCOPE_MULTIMODAL_IMAGE_GEN_MODELS = [
  "qwen-image-3.0-pro",
  "z-image-turbo",
  "qwen-image-edit",
  "qwen-image-edit-max",
] as const;

export function isQwenImageEditModel(model: string): boolean {
  const k = model.trim().toLowerCase();
  return (
    k === "qwen-image-edit" ||
    k === "qwen-image-edit-max" ||
    k.startsWith("qwen-image-edit")
  );
}

export function isQwenImage30ProModel(model: string): boolean {
  return model.trim().toLowerCase() === "qwen-image-3.0-pro";
}

export function isZImageTurboModel(model: string): boolean {
  return model.trim().toLowerCase() === "z-image-turbo";
}

/** 百炼 multimodal-generation · 文生图 / 图生图（含 qwen-image-3.0-pro · z-image-turbo） */
export function isDashscopeMultimodalImageGenModel(model: string): boolean {
  const k = model.trim().toLowerCase();
  return (
    isQwenImage30ProModel(k) ||
    isZImageTurboModel(k) ||
    isQwenImageEditModel(k)
  );
}

function buildMultimodalImageParameters(
  model: string,
  p?: QwenImageEditParams,
): Record<string, unknown> {
  const k = model.trim().toLowerCase();
  const parameters: Record<string, unknown> = {};

  if (isZImageTurboModel(k)) {
    parameters.size = p?.size?.trim() || "1024*1024";
    parameters.prompt_extend = p?.prompt_extend ?? false;
    parameters.watermark = p?.watermark ?? false;
    if (p?.seed !== undefined && Number.isFinite(p.seed)) {
      parameters.seed = p.seed;
    }
    return parameters;
  }

  if (isQwenImage30ProModel(k)) {
    parameters.prompt_extend = p?.prompt_extend ?? true;
    if (p?.prompt_extend_mode) {
      parameters.prompt_extend_mode = p.prompt_extend_mode;
    }
    if (p?.enable_thinking !== undefined) {
      parameters.enable_thinking = p.enable_thinking;
    }
    if (p?.n !== undefined && p.n >= 1) {
      parameters.n = Math.min(6, Math.floor(p.n));
    }
    if (p?.size?.trim()) parameters.size = p.size.trim();
    if (p?.negative_prompt?.trim()) {
      parameters.negative_prompt = p.negative_prompt.trim();
    }
    parameters.watermark = p?.watermark ?? false;
    if (p?.seed !== undefined && Number.isFinite(p.seed)) {
      parameters.seed = p.seed;
    }
    return parameters;
  }

  if (p?.negative_prompt?.trim()) parameters.negative_prompt = p.negative_prompt.trim();
  if (p?.prompt_extend !== undefined) parameters.prompt_extend = p.prompt_extend;
  if (p?.watermark !== undefined) parameters.watermark = p.watermark;
  if (p?.seed !== undefined && Number.isFinite(p.seed)) parameters.seed = p.seed;
  if (p?.n !== undefined && p.n >= 1) parameters.n = Math.min(6, Math.floor(p.n));
  if (p?.size?.trim()) parameters.size = p.size.trim();
  return parameters;
}

export function validateDashscopeMultimodalImageContent(
  model: string,
  content: QwenImageEditContentItem[],
): string | null {
  const items = content.filter(
    (c) =>
      ("text" in c && c.text.trim()) ||
      ("image" in c && String(c.image).trim()),
  );
  const hasText = items.some(
    (c) => "text" in c && String(c.text).trim(),
  );
  if (!hasText) return "content 须包含 text 提示词";

  if (isZImageTurboModel(model)) {
    const hasImage = items.some((c) => "image" in c && String(c.image).trim());
    if (hasImage) return "z-image-turbo 仅支持文生图，不可传入参考图";
    return null;
  }

  if (isQwenImageEditModel(model)) {
    const hasImage = items.some((c) => "image" in c && String(c.image).trim());
    if (!hasImage) return "qwen-image-edit 须至少一张参考图";
    return null;
  }

  if (isQwenImage30ProModel(model)) {
    const imageCount = items.filter(
      (c) => "image" in c && String(c.image).trim(),
    ).length;
    if (imageCount > 3) return "qwen-image-3.0-pro 最多 3 张参考图";
    return null;
  }

  return null;
}

export type QwenImageEditRequest = {
  apiKey: string;
  baseUrl?: string;
  model: string;
  content: QwenImageEditContentItem[];
  parameters?: QwenImageEditParams;
};

export type QwenImageEditResult = {
  ok: true;
  imageUrls: string[];
  usage?: unknown;
} | {
  ok: false;
  error: string;
};

function resolveDashscopeApiRoot(baseUrl?: string): string {
  const fallback = "https://dashscope.aliyuncs.com";
  let raw = (baseUrl?.trim() || fallback).replace(/\/$/, "");
  raw = raw.replace(/\/compatible-mode\/v1$/i, "");
  if (raw.includes("/api/v1/services")) {
    return raw.replace(/\/api\/v1\/services.*$/, "");
  }
  return raw || fallback;
}

export async function qwenImageEditGenerate(
  req: QwenImageEditRequest,
): Promise<QwenImageEditResult> {
  const root = resolveDashscopeApiRoot(req.baseUrl);
  const url = `${root}${QWEN_IMAGE_EDIT_PATH}`;
  const parameters = buildMultimodalImageParameters(req.model, req.parameters);

  const payload = {
    model: req.model.trim(),
    input: {
      messages: [
        {
          role: "user",
          content: req.content,
        },
      ],
    },
    parameters,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `DashScope 响应非 JSON (${response.status})`,
    };
  }

  if (!response.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `DashScope HTTP ${response.status}`;
    return { ok: false, error: msg };
  }

  if (typeof data.code === "string" && data.code) {
    return {
      ok: false,
      error: typeof data.message === "string" ? data.message : data.code,
    };
  }

  const output = data.output as Record<string, unknown> | undefined;
  const choices = (output?.choices ?? []) as Array<{
    message?: { content?: Array<{ image?: string }> };
  }>;
  const imageUrls: string[] = [];
  for (const choice of choices) {
    for (const item of choice.message?.content ?? []) {
      if (item.image?.trim()) imageUrls.push(item.image.trim());
    }
  }
  if (imageUrls.length === 0) {
    return { ok: false, error: "未返回图像 URL" };
  }
  return { ok: true, imageUrls, usage: data.usage };
}
