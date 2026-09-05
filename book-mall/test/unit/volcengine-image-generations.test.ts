import { describe, expect, it } from "vitest";

import {
  buildVolcengineImageLogResultSummary,
  extractVolcengineImageGenerationImages,
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
