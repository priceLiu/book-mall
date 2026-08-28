import { describe, expect, it } from "vitest";

import { resolveLogDisplayDurationMs, extractLogInputImages } from "@/lib/gateway-log-params";

describe("resolveLogDisplayDurationMs", () => {
  it("in-progress uses phase sum (not gateway wall clock)", () => {
    const submittedAt = new Date(1_000_000).toISOString();
    const nowMs = 1_000_000 + 80_000;
    const ms = resolveLogDisplayDurationMs({
      durationMs: null,
      submittedAt,
      completedAt: null,
      isInProgress: true,
      nowMs,
      queueMs: 1_000,
      generateMs: 233_000,
      pollDelayMs: 73_000,
      liveTotalMs: 80_000,
    });
    expect(ms).toBe(307_000);
  });

  it("in-progress with generate pending uses queue + poll only", () => {
    const submittedAt = new Date(1_000_000).toISOString();
    const ms = resolveLogDisplayDurationMs({
      durationMs: null,
      submittedAt,
      completedAt: null,
      isInProgress: true,
      nowMs: 1_000_000 + 900_000,
      queueMs: 5_000,
      generateMs: null,
      pollDelayMs: 800_000,
    });
    expect(ms).toBe(805_000);
  });

  it("terminal uses stored durationMs", () => {
    const ms = resolveLogDisplayDurationMs({
      durationMs: 295_000,
      submittedAt: new Date(0).toISOString(),
      completedAt: new Date(295_000).toISOString(),
      isInProgress: false,
      nowMs: null,
    });
    expect(ms).toBe(295_000);
  });
});

describe("extractLogInputImages", () => {
  it("reads KIE image_input reference URLs", () => {
    const images = extractLogInputImages({
      model: "nano-banana-pro",
      input: {
        prompt: "scene",
        image_input: [
          "https://cdn.example/a.png",
          "https://cdn.example/b.png",
        ],
      },
    });
    expect(images).toHaveLength(2);
    expect(images[0]?.url).toBe("https://cdn.example/a.png");
    expect(images[0]?.previewable).toBe(true);
  });

  it("reads DashScope multimodal content image blocks", () => {
    const images = extractLogInputImages({
      model: "qwen-image-edit",
      input: {
        jobKind: "multimodal-image-sync",
        content: [
          { image: "https://cdn.example/ref-a.png" },
          { image: "https://cdn.example/ref-b.png" },
          { text: "edit prompt" },
        ],
      },
    });
    expect(images).toHaveLength(2);
    expect(images[0]?.url).toBe("https://cdn.example/ref-a.png");
    expect(images[1]?.url).toBe("https://cdn.example/ref-b.png");
  });
});
