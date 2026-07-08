/**
 * 百炼 / DashScope · Qwen-Image-Edit 同步图像编辑（multimodal-generation）
 * @see https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-guide
 */

const QWEN_IMAGE_EDIT_PATH =
  "/api/v1/services/aigc/multimodal-generation/generation";

export type QwenImageEditContentItem =
  | { image: string }
  | { text: string };

export type QwenImageEditParams = {
  negative_prompt?: string;
  prompt_extend?: boolean;
  watermark?: boolean;
  seed?: number;
  n?: number;
  size?: string;
};

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
  const parameters: Record<string, unknown> = {};
  const p = req.parameters ?? {};
  if (p.negative_prompt?.trim()) parameters.negative_prompt = p.negative_prompt.trim();
  if (p.prompt_extend !== undefined) parameters.prompt_extend = p.prompt_extend;
  if (p.watermark !== undefined) parameters.watermark = p.watermark;
  if (p.seed !== undefined && Number.isFinite(p.seed)) parameters.seed = p.seed;
  if (p.n !== undefined && p.n >= 1) parameters.n = Math.min(6, Math.floor(p.n));
  if (p.size?.trim()) parameters.size = p.size.trim();

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
