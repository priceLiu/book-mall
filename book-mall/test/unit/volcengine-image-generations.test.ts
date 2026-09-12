import { describe, expect, it } from "vitest";

import {
  buildVolcengineImageGenerationsBody,
  buildVolcengineImageLogResultSummary,
  extractVolcengineImageGenerationImages,
  resolveSeedreamSequentialImageGeneration,
} from "@/lib/gateway/volcengine-image-generations-proxy";

describe("extractVolcengineImageGenerationImages", () => {
  it("reads OpenAI-style data[].url", () => {
    expect(
      extractVolcengineImageGenerationImages({
        data: [{ url: "https://cdn.example/out.png", size: "2048x2048" }],
      }),
    ).toEqual([{ url: "https://cdn.example/out.png" }]);
  });

  it("reads results[].url (DashScope-shaped payload)", () => {
    expect(
      extractVolcengineImageGenerationImages({
        results: [{ url: "https://cdn.example/from-results.png" }],
      }),
    ).toEqual([{ url: "https://cdn.example/from-results.png" }]);
  });

  it("reads nested output.results", () => {
    expect(
      extractVolcengineImageGenerationImages({
        output: {
          task_status: "SUCCEEDED",
          results: [{ url: "https://cdn.example/nested.png" }],
        },
      }),
    ).toEqual([{ url: "https://cdn.example/nested.png" }]);
  });

  it("skips empty data rows that only have size", () => {
    expect(
      extractVolcengineImageGenerationImages({
        data: [{ size: "2048x2048" }],
      }),
    ).toEqual([]);
  });

  it("reads b64_json when url is absent", () => {
    expect(
      extractVolcengineImageGenerationImages({
        data: [{ b64_json: "iVBORw0KGgo=" }],
      }),
    ).toEqual([{ b64: "iVBORw0KGgo=" }]);
  });
});

describe("resolveSeedreamSequentialImageGeneration", () => {
  it("omits sequential mode for Seedream 5.0 Pro (layer split)", () => {
    expect(resolveSeedreamSequentialImageGeneration("doubao-seedream-5-0-pro")).toBeNull();
    expect(
      resolveSeedreamSequentialImageGeneration("doubao-seedream-5-0-pro-260628", 4),
    ).toBeNull();
  });

  it("uses disabled/auto for Seedream Lite batch", () => {
    expect(resolveSeedreamSequentialImageGeneration("doubao-seedream-5-0-lite")).toBe(
      "disabled",
    );
    expect(resolveSeedreamSequentialImageGeneration("doubao-seedream-5-0-lite", 3)).toBe(
      "auto",
    );
  });
});

describe("buildVolcengineImageGenerationsBody", () => {
  it("does not send sequential_image_generation for Pro layer decompose", () => {
    const body = buildVolcengineImageGenerationsBody({
      model: "doubao-seedream-5-0-pro",
      prompt: "将图片进行精确图层分离",
      image: "https://cdn.example/in.jpg",
      parameters: { size: "auto", output_format: "jpeg", layer_decomposition: true },
    });
    expect(body.model).toBe("doubao-seedream-5-0-pro-260628");
    expect(body).not.toHaveProperty("sequential_image_generation");
    expect(body.output_format).toBe("jpeg");
    expect(body.layer_decomposition).toBe(true);
  });
});

describe("buildVolcengineImageLogResultSummary", () => {
  it("keeps vendor data urls instead of only imageCount", () => {
    const raw = {
      model: "doubao-seedream-5-0-260128",
      data: [{ url: "https://cdn.example/out.png", size: "2048x2048" }],
      usage: { generated_images: 1 },
    };
    const images = extractVolcengineImageGenerationImages(raw);
    expect(buildVolcengineImageLogResultSummary(raw, images)).toEqual({
      model: "doubao-seedream-5-0-260128",
      data: [{ url: "https://cdn.example/out.png", size: "2048x2048" }],
      usage: { generated_images: 1 },
      imageCount: 1,
      imageUrls: ["https://cdn.example/out.png"],
    });
  });
});
