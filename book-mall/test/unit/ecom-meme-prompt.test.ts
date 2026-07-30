import { describe, expect, it } from "vitest";

import { buildMemePrompt } from "@/lib/ecom/ecom-image-processing-presets";

describe("buildMemePrompt", () => {
  it("includes caption text in prompt by default", () => {
    const prompt = buildMemePrompt({
      memeFormat: "classic",
      sceneDescription: "dog at laptop",
      topText: "WHEN YOU",
      bottomText: "FIX THE BUG",
    });
    expect(prompt).toContain("Top caption text");
    expect(prompt).toContain("WHEN YOU");
    expect(prompt).not.toContain("WITHOUT any text");
  });

  it("omits caption from prompt when overlay will be applied", () => {
    const prompt = buildMemePrompt({
      memeFormat: "classic",
      sceneDescription: "dog at laptop",
      topText: "WHEN YOU",
      bottomText: "FIX THE BUG",
      omitCaptionText: true,
    });
    expect(prompt).toContain("WITHOUT any text");
    expect(prompt).not.toContain("Top caption text");
    expect(prompt).not.toContain("WHEN YOU");
  });
});
