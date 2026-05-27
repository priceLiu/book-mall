/**
 * KIE.AI 托管的 Gemini 3 Flash —— 经 Gateway 代理
 */
import { z, type ZodTypeAny } from "zod";
import { storyGwChat } from "./story-gateway-client";

export class GeminiLlmError extends Error {
  constructor(
    public code:
      | "LLM_NOT_CONFIGURED"
      | "LLM_QUOTA_EXCEEDED"
      | "LLM_MODEL_NOT_FOUND"
      | "LLM_INVALID_JSON"
      | "LLM_HTTP_ERROR"
      | "GATEWAY_KEY_REQUIRED",
    message: string,
    public httpStatus: number = 502,
  ) {
    super(message);
    this.name = "GeminiLlmError";
  }
}

type ChatJsonOptions<S extends ZodTypeAny> = {
  userId: string;
  storyProjectId?: string;
  systemPrompt: string;
  userPrompt: string;
  schema: S;
  reasoningEffort?: "low" | "high";
};

const GEMINI_MODEL = "gemini-3-flash";

export async function chatJson<S extends ZodTypeAny>(
  opts: ChatJsonOptions<S>,
): Promise<z.infer<S>> {
  const callOnce = async (): Promise<z.infer<S>> => {
    let result: { text: string };
    try {
      result = await storyGwChat(opts.userId, {
        modelKey: GEMINI_MODEL,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        params: {
          include_thoughts: false,
          reasoning_effort: opts.reasoningEffort ?? "low",
          response_format: { type: "json_object" },
        },
        storyProjectId: opts.storyProjectId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Gateway|sk-gw|凭证/.test(msg)) {
        throw new GeminiLlmError("GATEWAY_KEY_REQUIRED", msg, 403);
      }
      throw new GeminiLlmError(
        "LLM_HTTP_ERROR",
        `network error calling gemini-3-flash: ${msg}`,
        502,
      );
    }

    const raw = result.text;
    if (!raw?.trim()) {
      throw new GeminiLlmError("LLM_INVALID_JSON", "empty response content");
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
    const validated = opts.schema.safeParse(parsedJson);
    if (!validated.success) {
      throw new GeminiLlmError(
        "LLM_INVALID_JSON",
        `schema validation failed: ${validated.error.message.slice(0, 300)}`,
      );
    }
    return validated.data;
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

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}
