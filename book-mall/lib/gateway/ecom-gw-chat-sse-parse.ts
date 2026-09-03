/** OpenAI 兼容 SSE chunk · content / reasoning_content 解析（GLM 思考模式） */

export type OpenAiChatSseDelta = {
  content: string;
  reasoningContent: string;
};

export function parseOpenAiChatSsePayload(payload: string): OpenAiChatSseDelta {
  try {
    const chunk = JSON.parse(payload) as {
      choices?: Array<{
        delta?: {
          content?: string | null;
          reasoning_content?: string | null;
        };
      }>;
    };
    const delta = chunk.choices?.[0]?.delta;
    return {
      content: typeof delta?.content === "string" ? delta.content : "",
      reasoningContent:
        typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "",
    };
  } catch {
    return { content: "", reasoningContent: "" };
  }
}
