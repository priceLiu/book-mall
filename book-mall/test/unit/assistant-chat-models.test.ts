import { describe, expect, it } from "vitest";

import {
  ASSISTANT_CHAT_FALLBACK_MODELS,
  resolveAssistantChatModels,
} from "@/lib/platform-assistant/config";

describe("resolveAssistantChatModels", () => {
  it("includes primary then fallbacks without duplicates", () => {
    const models = resolveAssistantChatModels("deepseek-chat");
    expect(models[0]).toBe("deepseek-chat");
    for (const fb of ASSISTANT_CHAT_FALLBACK_MODELS) {
      expect(models).toContain(fb);
    }
    expect(new Set(models).size).toBe(models.length);
  });

  it("does not duplicate when primary equals fallback", () => {
    const fb = ASSISTANT_CHAT_FALLBACK_MODELS[0];
    const models = resolveAssistantChatModels(fb);
    expect(models.filter((m) => m === fb).length).toBe(1);
  });
});
