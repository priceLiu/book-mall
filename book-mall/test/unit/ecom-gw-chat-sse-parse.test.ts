import { describe, expect, it } from "vitest";

import { parseOpenAiChatSsePayload } from "@/lib/gateway/ecom-gw-chat-sse-parse";

describe("parseOpenAiChatSsePayload", () => {
  it("extracts delta content", () => {
    const payload = JSON.stringify({
      choices: [{ delta: { content: "hello" } }],
    });
    expect(parseOpenAiChatSsePayload(payload)).toEqual({
      content: "hello",
      reasoningContent: "",
    });
  });

  it("extracts reasoning_content for GLM thinking mode", () => {
    const payload = JSON.stringify({
      choices: [{ delta: { reasoning_content: "step 1" } }],
    });
    expect(parseOpenAiChatSsePayload(payload)).toEqual({
      content: "",
      reasoningContent: "step 1",
    });
  });

  it("returns empty strings for invalid JSON", () => {
    expect(parseOpenAiChatSsePayload("not-json")).toEqual({
      content: "",
      reasoningContent: "",
    });
  });
});
