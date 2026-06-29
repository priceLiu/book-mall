/** KIE GPT-5.5 · /codex/v1/responses ↔ OpenAI chat/completions 适配 */

export const KIE_CODEX_CHAT_MODEL_KEYS = new Set(["gpt-5-5", "gpt-5.5"]);

export function isKieCodexChatModel(modelKey: string): boolean {
  return KIE_CODEX_CHAT_MODEL_KEYS.has(modelKey.trim().toLowerCase());
}

export function resolveKieCodexUpstreamModel(_modelKey: string): string {
  return "gpt-5-5";
}

type OpenAiMessage = {
  role?: string;
  content?: unknown;
};

function mapContentPart(part: unknown): Record<string, unknown> | null {
  if (typeof part === "string" && part.trim()) {
    return { type: "input_text", text: part.trim() };
  }
  if (!part || typeof part !== "object") return null;
  const p = part as Record<string, unknown>;
  if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
    return { type: "input_text", text: p.text.trim() };
  }
  if (p.type === "image_url") {
    const url =
      typeof p.image_url === "string"
        ? p.image_url
        : (p.image_url as { url?: string } | undefined)?.url;
    if (typeof url === "string" && url.trim()) {
      return { type: "input_image", image_url: url.trim() };
    }
  }
  return null;
}

function mapOpenAiMessageContent(content: unknown): Record<string, unknown>[] {
  if (typeof content === "string" && content.trim()) {
    return [{ type: "input_text", text: content.trim() }];
  }
  if (!Array.isArray(content)) return [];
  const out: Record<string, unknown>[] = [];
  for (const part of content) {
    const mapped = mapContentPart(part);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** chat/completions body → KIE codex /responses body */
export function buildKieCodexResponsesBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const messages = Array.isArray(body.messages)
    ? (body.messages as OpenAiMessage[])
    : [];
  const input = messages
    .map((msg) => {
      const role = typeof msg.role === "string" ? msg.role : "user";
      const content = mapOpenAiMessageContent(msg.content);
      if (!content.length) return null;
      return { role, content };
    })
    .filter(Boolean);

  const effortRaw =
    (body.reasoning_effort as string | undefined) ??
    ((body.reasoning as { effort?: string } | undefined)?.effort);
  const effort =
    effortRaw === "medium" ||
    effortRaw === "high" ||
    effortRaw === "xhigh" ||
    effortRaw === "low"
      ? effortRaw
      : "low";

  return {
    model: resolveKieCodexUpstreamModel(String(body.model ?? "gpt-5-5")),
    stream: false,
    input: input.length ? input : [{ role: "user", content: [{ type: "input_text", text: "" }] }],
    reasoning: { effort },
  };
}

function extractCodexOutputText(parsed: Record<string, unknown>): string {
  const output = parsed.output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "message") continue;
    const content = o.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      const block = c as Record<string, unknown>;
      if (block.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }
  return parts.join("\n").trim();
}

/** KIE codex JSON → OpenAI chat/completions JSON（供 Gateway 与 Canvas 复用） */
export function kieCodexResponseToChatCompletions(
  parsed: unknown,
  modelKey: string,
): Record<string, unknown> {
  const obj =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  const text = extractCodexOutputText(obj);
  const usageRaw =
    obj.usage && typeof obj.usage === "object"
      ? (obj.usage as Record<string, unknown>)
      : {};
  const promptTokens =
    typeof usageRaw.input_tokens === "number"
      ? usageRaw.input_tokens
      : typeof usageRaw.prompt_tokens === "number"
        ? usageRaw.prompt_tokens
        : undefined;
  const completionTokens =
    typeof usageRaw.output_tokens === "number"
      ? usageRaw.output_tokens
      : typeof usageRaw.completion_tokens === "number"
        ? usageRaw.completion_tokens
        : undefined;
  const totalTokens =
    typeof usageRaw.total_tokens === "number"
      ? usageRaw.total_tokens
      : promptTokens != null && completionTokens != null
        ? promptTokens + completionTokens
        : undefined;

  return {
    id: typeof obj.id === "string" ? obj.id : `kie-codex-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modelKey,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: text ? "stop" : "length",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
  };
}
