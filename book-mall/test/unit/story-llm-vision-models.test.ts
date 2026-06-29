import { describe, expect, it } from "vitest";
import {
  assertStoryLlmVisionModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";

describe("story-llm-vision-models", () => {
  it("gemini and gpt-5-5 support vision", () => {
    expect(isStoryLlmVisionModel("google/gemini-3-flash-preview")).toBe(true);
    expect(isStoryLlmVisionModel("gemini-3-flash")).toBe(true);
    expect(isStoryLlmVisionModel("gpt-5-5")).toBe(true);
  });

  it("deepseek and qwen are text-only", () => {
    expect(isStoryLlmVisionModel("deepseek-v4-flash")).toBe(false);
    expect(isStoryLlmVisionModel("qwen-plus")).toBe(false);
  });

  it("assert throws for non-vision model", () => {
    expect(() => assertStoryLlmVisionModel("deepseek-v4-flash")).toThrow(
      /不支持图片理解/,
    );
  });
});
