import { describe, expect, it } from "vitest";

import {
  buildCanvasVideoMinimaxInput,
  buildMinimaxVideoSubmitBody,
  minimaxResolutionFromEcom,
} from "@/lib/gateway/minimax-video-body";
import { minimaxH3BillingCanonicalFromInput } from "@/lib/gateway/minimax-video-models";

describe("minimaxResolutionFromEcom", () => {
  it("maps 720p to 768P and 1080p to 2K", () => {
    expect(minimaxResolutionFromEcom("720p")).toBe("768P");
    expect(minimaxResolutionFromEcom("1080p")).toBe("2K");
  });
});

describe("buildMinimaxVideoSubmitBody", () => {
  it("t2v uses text only", () => {
    const body = buildMinimaxVideoSubmitBody({
      modelKey: "MiniMax/MiniMax-H3-t2v",
      input: { prompt: "一只猫在草地上", resolution: "2K", duration: 5 },
    });
    expect(body.model).toBe("MiniMax-H3");
    const content = body.content as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0]?.type).toBe("text");
  });

  it("i2v adds first_frame image when no reference images", () => {
    const body = buildMinimaxVideoSubmitBody({
      modelKey: "MiniMax/MiniMax-H3-i2v",
      input: {
        prompt: "动起来",
        image_url: "https://example.com/a.png",
        resolution: "768P",
        duration: 6,
      },
    });
    const content = body.content as Array<{ type: string; role?: string }>;
    expect(content.some((c) => c.type === "image_url" && c.role === "first_frame")).toBe(
      true,
    );
    expect(body.resolution).toBe("768P");
  });

  it("i2v merges first_frame into reference_image when refs present", () => {
    const body = buildMinimaxVideoSubmitBody({
      modelKey: "MiniMax/MiniMax-H3-i2v",
      input: {
        prompt: "动起来",
        image_url: "https://example.com/sheet.png",
        reference_image_urls: ["https://example.com/product.png"],
        resolution: "768P",
        duration: 6,
      },
    });
    const content = body.content as Array<{ type: string; role?: string }>;
    const images = content.filter((c) => c.type === "image_url");
    expect(images).toHaveLength(2);
    expect(images.every((c) => c.role === "reference_image")).toBe(true);
    expect(
      content.some((c) => c.type === "image_url" && c.role === "first_frame"),
    ).toBe(false);
  });
});

describe("minimaxH3BillingCanonicalFromInput", () => {
  it("uses list-price canonical by resolution", () => {
    expect(
      minimaxH3BillingCanonicalFromInput({
        modelKey: "MiniMax/MiniMax-H3-i2v",
        resolution: "768P",
      }),
    ).toBe("minimax-h3-768p");
    expect(
      minimaxH3BillingCanonicalFromInput({
        modelKey: "MiniMax/MiniMax-H3-regeneration",
      }),
    ).toBe("minimax-h3-regeneration-2k");
  });
});

describe("buildCanvasVideoMinimaxInput", () => {
  it("passes ratio and duration", () => {
    const { input } = buildCanvasVideoMinimaxInput({
      modelKey: "MiniMax/MiniMax-H3-t2v",
      prompt: "test",
      options: { ratio: "9:16", duration: 8, resolution: "2K" },
    });
    expect(input.ratio).toBe("9:16");
    expect(input.duration).toBe(8);
    expect(input.resolution).toBe("2K");
  });
});
