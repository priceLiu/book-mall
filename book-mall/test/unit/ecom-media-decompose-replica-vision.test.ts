import { describe, expect, it } from "vitest";

import { resolveReplicaVisionChatModel } from "@/lib/ecom/ecom-media-decompose-replica";
import { formatProductBriefFromRecognition } from "@/lib/ecom/ecom-media-decompose-replica-script";

describe("resolveReplicaVisionChatModel", () => {
  it("uses explicit vision model when valid", () => {
    expect(resolveReplicaVisionChatModel("qwen3.8-max", "deepseek-v4-pro")).toBe("qwen3.8-max");
  });

  it("falls back to project vision model", () => {
    expect(resolveReplicaVisionChatModel(undefined, "qwen3-vl-plus")).toBe("qwen3-vl-plus");
  });

  it("falls back to default vision when both are non-vision", () => {
    expect(resolveReplicaVisionChatModel("deepseek-v4-pro", "deepseek-v4-pro")).toBe("qwen3.8-max");
  });
});

describe("formatProductBriefFromRecognition", () => {
  it("parses fenced JSON", () => {
    const brief = formatProductBriefFromRecognition(
      '说明\n```json\n{"productName":"开衫","category":"女装","sellingPoints":"轻薄","materialOrCraft":"针织","displayTips":"lookbook"}\n```',
    );
    expect(brief).toContain("产品：开衫");
    expect(brief).toContain("卖点：轻薄");
  });
});
