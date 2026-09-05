import { describe, expect, it } from "vitest";

import {
  ECOM_DEFAULT_ASSISTANT_CHAT_MODEL,
  resolveEcomAssistantChatParams,
} from "@/lib/gateway/ecom-storyboard-chat-models";

describe("ecom assistant chat defaults", () => {
  it("defaults to deepseek-v4-pro", () => {
    expect(ECOM_DEFAULT_ASSISTANT_CHAT_MODEL).toBe("deepseek-v4-pro");
  });

  it("returns deepseek params for deepseek models", () => {
    expect(resolveEcomAssistantChatParams("deepseek-v4-pro")).toEqual({
      max_tokens: 24000,
      temperature: 0.7,
    });
  });

  it("returns empty params for non-deepseek models", () => {
    expect(resolveEcomAssistantChatParams("qwen3.5-flash")).toEqual({});
  });
});
