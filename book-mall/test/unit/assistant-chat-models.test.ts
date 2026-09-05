import { describe, expect, it } from "vitest";

import {
  normalizeAssistantLlmModelKey,
  resolveModelChain,
} from "@/lib/platform-assistant/platform-assistant-model-config-service";

describe("resolveModelChain", () => {
  it("normalizes legacy deepseek-chat to deepseek-v4-flash", () => {
    expect(normalizeAssistantLlmModelKey("deepseek-chat")).toBe("deepseek-v4-flash");
    const models = resolveModelChain("deepseek-chat", ["qwen3.5-flash"]);
    expect(models[0]).toBe("deepseek-v4-flash");
    expect(models).toContain("qwen3.5-flash");
  });

  it("includes primary then fallbacks without duplicates", () => {
    const models = resolveModelChain("deepseek-v4-flash", ["qwen3.5-flash", "qwen-plus"]);
    expect(models[0]).toBe("deepseek-v4-flash");
    expect(models).toContain("qwen3.5-flash");
    expect(models).toContain("qwen-plus");
    expect(new Set(models).size).toBe(models.length);
  });

  it("does not duplicate when primary equals fallback", () => {
    const models = resolveModelChain("qwen3.5-flash", ["qwen3.5-flash", "qwen-plus"]);
    expect(models.filter((m) => m === "qwen3.5-flash").length).toBe(1);
  });
});
