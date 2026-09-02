import { describe, expect, it } from "vitest";

import {
  resolveRecognizeProductModel,
  resolveReplicaTextChatModel,
  resolveReplicaVisionChatModel,
} from "@/lib/ecom/ecom-media-decompose-replica";
import { ECOM_RECOGNIZE_PRODUCT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import {
  formatProductBriefFromRecognition,
  parseProductRecognitionResult,
} from "@/lib/ecom/ecom-media-decompose-replica-script";

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

describe("resolveRecognizeProductModel", () => {
  it("always uses qwen3-vl-flash for AI 识产品", () => {
    expect(resolveRecognizeProductModel()).toBe(ECOM_RECOGNIZE_PRODUCT_MODEL);
    expect(resolveRecognizeProductModel()).toBe("qwen3-vl-flash");
  });
});

describe("resolveReplicaTextChatModel", () => {
  it("skips vision models and defaults to deepseek for voiceover text", () => {
    expect(resolveReplicaTextChatModel("qwen3.8-max", "qwen3.8-max")).toBe("deepseek-v4-pro");
  });

  it("uses explicit text model when provided", () => {
    expect(resolveReplicaTextChatModel("deepseek-v4-pro", "qwen3.8-max")).toBe("deepseek-v4-pro");
  });
});

describe("parseProductRecognitionResult", () => {
  it("parses fenced JSON and separates selling points from product brief", () => {
    const { productBrief, sellingPoints } = parseProductRecognitionResult(
      '说明\n```json\n{"productName":"开衫","category":"女装","sellingPoints":"轻薄","materialOrCraft":"针织","displayTips":"lookbook"}\n```',
    );
    expect(productBrief).toContain("产品：开衫");
    expect(productBrief).not.toContain("卖点：");
    expect(sellingPoints).toBe("轻薄");
  });
});

describe("formatProductBriefFromRecognition", () => {
  it("returns product brief without selling points line", () => {
    const brief = formatProductBriefFromRecognition(
      '说明\n```json\n{"productName":"开衫","category":"女装","sellingPoints":"轻薄","materialOrCraft":"针织","displayTips":"lookbook"}\n```',
    );
    expect(brief).toContain("产品：开衫");
    expect(brief).not.toContain("卖点：");
  });
});
