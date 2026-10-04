import { describe, expect, it } from "vitest";

import type { WorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import { parseSimpleFusionI2vEnvelope } from "@/lib/ecom/video-workflow/templates/simple-fusion-i2v-v1/parser";
import { resolveSimpleFusionPrompts } from "@/lib/ecom/simple-fusion-video/prompts";

describe("simple-fusion-i2v-v1 parser", () => {
  it("parses compose_complete envelope", () => {
    const envelope: WorkflowEnvelope = {
      schemaVersion: "ecom-video-workflow/v1",
      templateId: "simple-fusion-i2v-v1",
      action: "compose_complete",
      taskStatus: "success",
      taskId: "t1",
      payload: {
        composeResult: { videoUrl: "https://example.com/v.mp4" },
      },
    };
    const parsed = parseSimpleFusionI2vEnvelope(envelope);
    expect(parsed.payload.composeResult?.videoUrl).toBe("https://example.com/v.mp4");
  });
});

describe("resolveSimpleFusionPrompts", () => {
  it("falls back to defaults when user prompts empty", () => {
    const p = resolveSimpleFusionPrompts("camera", {});
    expect(p.fusion).toContain("保留模特");
    expect(p.video).toContain("9:16");
  });

  it("prefers user fusion prompt", () => {
    const p = resolveSimpleFusionPrompts("camera", { fusion: "自定义融合" });
    expect(p.fusion).toBe("自定义融合");
  });
});
