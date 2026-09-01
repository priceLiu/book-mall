import { describe, expect, it } from "vitest";

import {
  UPSTREAM_STORY_CHAT_MAX_TOKENS_THRESHOLD,
  formatGatewayFetchError,
  isTransientUpstreamConnectError,
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

  it("uses long timeout for DashScope multimodal image sync", () => {
    const ms = resolveUpstreamChatTimeoutMs(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      { method: "POST", body: "{}" },
    );
    expect(ms).toBeGreaterThanOrEqual(600_000);
  });

  it("uses story timeout for KIE codex responses (GPT-5.5 剧本)", () => {
    const ms = resolveUpstreamChatTimeoutMs("https://api.kie.ai/codex/v1/responses", {
      method: "POST",
      body: JSON.stringify({ model: "gpt-5-5", input: [] }),
    });
    expect(ms).toBeGreaterThanOrEqual(600_000);
  });

  it("uses story timeout when body contains video_url multimodal chat", () => {
    const ms = resolveUpstreamChatTimeoutMs("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "qwen3.8-max",
        messages: [
          {
            role: "user",
            content: [
              { type: "video_url", video_url: { url: "https://example.com/a.mp4" } },
              { type: "text", text: "拉片" },
            ],
          },
        ],
      }),
    });
    expect(ms).toBeGreaterThanOrEqual(600_000);
  });

  it("exports story threshold at 8000", () => {
    expect(UPSTREAM_STORY_CHAT_MAX_TOKENS_THRESHOLD).toBe(8_000);
  });
});

describe("isTransientUpstreamConnectError", () => {
  it("treats DeepSeek TLS handshake disconnect as retryable", () => {
    const err = new Error("fetch failed", {
      cause: new Error(
        "Client network socket disconnected before secure TLS connection was established",
      ),
    });
    expect(isTransientUpstreamConnectError(err)).toBe(true);
  });

  it("treats connect timeout as retryable", () => {
    const err = new Error("fetch failed", {
      cause: Object.assign(new Error("Connect Timeout Error"), {
        code: "UND_ERR_CONNECT_TIMEOUT",
      }),
    });
    expect(isTransientUpstreamConnectError(err)).toBe(true);
  });

  it("does not treat HTTP 400 as retryable", () => {
    expect(isTransientUpstreamConnectError(new Error("400 invalid_request"))).toBe(
      false,
    );
  });
});

describe("formatGatewayFetchError", () => {
  it("maps TLS handshake disconnect to DeepSeek connect timeout copy", () => {
    const err = new Error("fetch failed", {
      cause: new Error(
        "Client network socket disconnected before secure TLS connection was established",
      ),
    });
    expect(
      formatGatewayFetchError("https://api.deepseek.com/chat/completions", err, {
        hop: "upstream",
        providerKind: "DEEPSEEK",
      }).message,
    ).toBe("DeepSeek API 连接超时，请稍后重试。");
  });
});
