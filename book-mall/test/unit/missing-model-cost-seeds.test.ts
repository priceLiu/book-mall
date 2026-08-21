import { describe, expect, it } from "vitest";

import { MISSING_MODEL_COST_SEEDS } from "@/lib/finance/missing-model-cost-seeds";
import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";

/** 已在 seed-platform-model-costs EXTRA_COSTS 或等价分档中维护成本的 canonical */
const ALREADY_SEEDED = new Set([
  "qwen-turbo",
  "deepseek-chat",
  "gemini-flash",
  "lib-nano-pro",
  "lib-nano-pro-1k",
  "lib-nano-pro-2k",
  "lib-nano-pro-4k",
  "qwen-image-3.0-pro",
  "z-image-turbo",
  "wan2.7-image",
  "wan2.7-image-pro",
  "wan2.6-image",
  "kling-3.0-image",
  "seedance-2.0",
  "wanxiang-video-2.7-i2v",
  "kling-3.0-video",
  "gpt-image-1",
  "gpt-image-2",
  "grok-imagine/text-to-image",
  "grok-imagine/image-to-video",
  "grok-imagine-video-1-5-preview",
  "wan/2-6-video-to-video",
  "kling-2.6/motion-control",
  "kling-3.0/motion-control",
  "topaz/video-upscale",
  "happyhorse-r2v",
  "wanxiang-video-2.7",
  "wanxiang-video-2.6",
  "aitryon",
  "aitryon-plus",
  "aitryon-parsing-v1",
  "qwen3-vl-plus",
  "qwen3-vl-flash",
  "qwen3-tts-flash",
  "qwen-image-edit",
  "qwen-image-edit-max",
  "doubao-seedream-5-0-lite",
  "image-out-painting",
  "wanx-x-painting",
  "wan2.5-i2i-preview",
]);

describe("MISSING_MODEL_COST_SEEDS", () => {
  it("覆盖注册表内原先缺成本的 81 个 canonical", () => {
    const registryKeys = new Set(GATEWAY_CANONICAL_REGISTRY.map((c) => c.canonicalModelKey));
    const covered = new Set([
      ...ALREADY_SEEDED,
      ...MISSING_MODEL_COST_SEEDS.map((r) => r.canonicalModelKey),
    ]);
    expect(MISSING_MODEL_COST_SEEDS).toHaveLength(92);
    for (const key of registryKeys) {
      expect(covered.has(key)).toBe(true);
    }
  });
});
