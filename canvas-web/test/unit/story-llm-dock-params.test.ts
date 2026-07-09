import { describe, expect, it } from "vitest";
import {
  buildStoryLlmDockParams,
  storyLlmParamsNeedSanitize,
  volcengineDoubaoLlmParamsFromModel,
} from "@/lib/canvas/story-llm-dock-params";

describe("story-llm-dock-params", () => {
  it("doubao model uses volcengine defaults not story 16k", () => {
    expect(
      buildStoryLlmDockParams(
        {
          modelKey: "doubao-seed-2.1-pro",
          defaultParams: { temperature: 0.7, max_tokens: 8000 },
          paramsSchema: [],
        },
        { reasoning_effort: "low", max_tokens: 16000, temperature: 0.7 },
      ),
    ).toEqual({ temperature: 0.7, max_tokens: 8000 });
  });

  it("gemini keeps story defaults merge", () => {
    const out = buildStoryLlmDockParams(
      {
        modelKey: "google/gemini-3-flash-preview",
        defaultParams: {},
        paramsSchema: [],
      },
      { max_tokens: 4000 },
    );
    expect(out.max_tokens).toBe(16000);
    expect(out.reasoning_effort).toBe("low");
  });

  it("detects leaked story params on doubao nodes", () => {
    expect(
      storyLlmParamsNeedSanitize("doubao-seed-2.1-pro", {
        max_tokens: 16000,
        temperature: 0.7,
      }),
    ).toBe(true);
    expect(
      storyLlmParamsNeedSanitize("doubao-seed-2.1-pro", {
        max_tokens: 8000,
        temperature: 0.7,
      }),
    ).toBe(false);
  });

  it("volcengineDoubaoLlmParamsFromModel falls back to 8k", () => {
    expect(volcengineDoubaoLlmParamsFromModel(null)).toEqual({
      temperature: 0.7,
      max_tokens: 8000,
    });
  });
});
