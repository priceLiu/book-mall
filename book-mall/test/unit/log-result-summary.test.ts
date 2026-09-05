import { describe, expect, it } from "vitest";

import { buildGatewayTtsResultSummary } from "@/lib/gateway/log-result-summary";

describe("buildGatewayTtsResultSummary", () => {
  it("prefers vendor http audio url", () => {
    const url = "https://cdn.example/voice.mp3";
    expect(
      buildGatewayTtsResultSummary({
        audioUrl: url,
        buffer: Buffer.from("x"),
        contentType: "audio/mpeg",
      }),
    ).toMatchObject({ kind: "tts", audio_url: url, url });
  });

  it("embeds data url when only buffer is available", () => {
    const summary = buildGatewayTtsResultSummary({
      buffer: Buffer.from("abc"),
      contentType: "audio/mpeg",
    });
    expect(summary.audio_url).toMatch(/^data:audio\/mpeg;base64,/);
    expect(summary.url).toBe(summary.audio_url);
  });
});
