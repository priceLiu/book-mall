import { describe, expect, it } from "vitest";

import {
  UPSTREAM_STORY_CHAT_MAX_TOKENS_THRESHOLD,
  resolveUpstreamChatTimeoutMs,
} from "@/lib/gateway/format-fetch-error";

describe("resolveUpstreamChatTimeoutMs", () => {
  it("uses story timeout when max_tokens is large", () => {
    const ms = resolveUpstreamChatTimeoutMs("https://api.deepseek.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({ max_tokens: 24_000 }),
    });
    expect(ms).toBeGreaterThanOrEqual(600_000);
  });

  it("uses default chat timeout for small max_tokens", () => {
    const ms = resolveUpstreamChatTimeoutMs("https://api.deepseek.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({ max_tokens: 4_000 }),
    });
    expect(ms).toBe(180_000);
  });

  it("uses createTask timeout for createTask endpoint", () => {
    const ms = resolveUpstreamChatTimeoutMs("https://api.kie.ai/api/v1/createTask", {
      method: "POST",
      body: JSON.stringify({ max_tokens: 24_000 }),
    });
    expect(ms).toBe(120_000);
  });

  it("uses story timeout for KIE codex responses (GPT-5.5 剧本)", () => {
    const ms = resolveUpstreamChatTimeoutMs("https://api.kie.ai/codex/v1/responses", {
      method: "POST",
      body: JSON.stringify({ model: "gpt-5-5", input: [] }),
    });
    expect(ms).toBeGreaterThanOrEqual(600_000);
  });

  it("exports story threshold at 8000", () => {
    expect(UPSTREAM_STORY_CHAT_MAX_TOKENS_THRESHOLD).toBe(8_000);
  });
});
