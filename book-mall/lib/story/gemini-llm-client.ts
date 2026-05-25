/**
 * KIE.AI 托管的 Gemini 3 Flash 客户端（OpenAI Chat Completions 兼容）。
 * 端点：POST {KIE_API_BASE}/gemini-3-flash/v1/chat/completions
 * 鉴权：Authorization: Bearer ${KIE_API_KEY}（与图像/视频任务共用同一把 key）
 *
 * 详见 story-web/docs/kie/gemini 3 Flash.md
 *
 * 仅暴露 chatJson —— 强制 JSON 响应；解析失败时一次重试（退而求其次按更稳的方式）。
 */
import { z, type ZodTypeAny } from "zod";

const DEFAULT_PATH = "/gemini-3-flash/v1/chat/completions";

export class GeminiLlmError extends Error {
  constructor(
    public code:
      | "LLM_NOT_CONFIGURED"
      | "LLM_QUOTA_EXCEEDED"
      | "LLM_MODEL_NOT_FOUND"
      | "LLM_INVALID_JSON"
      | "LLM_HTTP_ERROR",
    message: string,
    public httpStatus: number = 502,
  ) {
    super(message);
    this.name = "GeminiLlmError";
  }
}

function getApiKey(): string {
  const v = process.env.KIE_API_KEY?.trim();
  if (!v) {
    throw new GeminiLlmError(
      "LLM_NOT_CONFIGURED",
      "KIE_API_KEY missing",
      503,
    );
  }
  return v;
}

function getEndpoint(): string {
  const base =
    process.env.KIE_API_BASE?.trim().replace(/\/$/, "") || "https://api.kie.ai";
  // 允许整体覆盖（例如换成自部署的 OpenAI-compatible 网关）
  const override = process.env.STORY_AI_GEMINI_ENDPOINT?.trim();
  if (override) return override;
  return `${base}${DEFAULT_PATH}`;
}

type ChatJsonOptions<S extends ZodTypeAny> = {
  systemPrompt: string;
  userPrompt: string;
  schema: S;
  /** "low" 速度优先（默认）；"high" 推理更深，耗时更长 */
  reasoningEffort?: "low" | "high";
};

export async function chatJson<S extends ZodTypeAny>(
  opts: ChatJsonOptions<S>,
): Promise<z.infer<S>> {
  const url = getEndpoint();
  const apiKey = getApiKey();

  const body = {
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    // 必填：默认 true 会返回 SSE，对我们的「一次性 JSON」场景必须关闭
    stream: false,
    // 关闭 thoughts，避免污染 message.content
    include_thoughts: false,
    reasoning_effort: opts.reasoningEffort ?? "low",
    // 让上游强制吐 JSON（OpenAI 兼容字段；上游若未实现也只会被忽略）
    response_format: { type: "json_object" },
  } as const;

  const callOnce = async (): Promise<z.infer<S>> => {
    let r: Response;
    try {
      r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new GeminiLlmError(
        "LLM_HTTP_ERROR",
        `network error calling gemini-3-flash: ${detail}`,
        502,
      );
    }
    const text = await r.text();
    if (!r.ok) {
      if (r.status === 404 || /model_not_found|invalid model/i.test(text)) {
        throw new GeminiLlmError(
          "LLM_MODEL_NOT_FOUND",
          `gemini-3-flash endpoint not available: ${text.slice(0, 300)}`,
        );
      }
      if (r.status === 402 || /quota|insufficient|balance/i.test(text)) {
        throw new GeminiLlmError(
          "LLM_QUOTA_EXCEEDED",
          "KIE LLM quota exceeded",
        );
      }
      throw new GeminiLlmError(
        "LLM_HTTP_ERROR",
        `HTTP ${r.status}: ${text.slice(0, 500)}`,
      );
    }
    let parsedHttp: unknown;
    try {
      parsedHttp = text ? JSON.parse(text) : null;
    } catch {
      throw new GeminiLlmError(
        "LLM_HTTP_ERROR",
        `non-JSON HTTP body: ${text.slice(0, 200)}`,
      );
    }
    const raw = (
      parsedHttp as {
        choices?: { message?: { content?: string } }[];
      }
    ).choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      throw new GeminiLlmError(
        "LLM_INVALID_JSON",
        "empty response content",
      );
    }
    const cleaned = stripCodeFence(raw);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      throw new GeminiLlmError(
        "LLM_INVALID_JSON",
        `LLM returned non-JSON: ${cleaned.slice(0, 200)}`,
      );
    }
    const result = opts.schema.safeParse(parsedJson);
    if (!result.success) {
      throw new GeminiLlmError(
        "LLM_INVALID_JSON",
        `schema validation failed: ${result.error.message.slice(0, 300)}`,
      );
    }
    return result.data;
  };

  try {
    return await callOnce();
  } catch (e) {
    if (e instanceof GeminiLlmError && e.code === "LLM_INVALID_JSON") {
      console.warn("[gemini-llm] invalid JSON, retrying once", e.message);
      return await callOnce();
    }
    throw e;
  }
}

/** 清理 LLM 偶尔会包的 markdown 代码块 ```json ... ``` */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}
