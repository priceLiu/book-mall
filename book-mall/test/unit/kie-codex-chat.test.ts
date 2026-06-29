import { describe, expect, it } from "vitest";

import {
  buildKieCodexResponsesBody,
  isKieCodexChatModel,
  kieCodexResponseToChatCompletions,
} from "@/lib/gateway/kie-codex-chat";

describe("kie-codex-chat", () => {
  it("detects gpt-5-5 model keys", () => {
    expect(isKieCodexChatModel("gpt-5-5")).toBe(true);
    expect(isKieCodexChatModel("GPT-5.5")).toBe(true);
    expect(isKieCodexChatModel("gemini-3-flash")).toBe(false);
  });

  it("maps chat/completions messages to codex input", () => {
    const body = buildKieCodexResponsesBody({
      model: "gpt-5-5",
      messages: [
        { role: "system", content: "你是编剧助手" },
        { role: "user", content: "写一集大纲" },
      ],
      reasoning_effort: "medium",
    });
    expect(body.model).toBe("gpt-5-5");
    expect(body.stream).toBe(false);
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(body.input).toEqual([
      {
        role: "system",
        content: [{ type: "input_text", text: "你是编剧助手" }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: "写一集大纲" }],
      },
    ]);
  });

  it("converts codex response to chat/completions", () => {
    const chat = kieCodexResponseToChatCompletions(
      {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "第一集大纲…" }],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      },
      "gpt-5-5",
    );
    expect(chat.choices).toHaveLength(1);
    expect(
      (chat.choices as { message?: { content?: string } }[])[0]?.message
        ?.content,
    ).toBe("第一集大纲…");
    expect(chat.usage).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    });
  });
});
