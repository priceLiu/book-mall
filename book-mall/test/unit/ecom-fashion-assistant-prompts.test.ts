import { describe, expect, it } from "vitest";

import { buildFashionAssistantSystemPrompt } from "@/lib/ecom/ecom-fashion-assistant-prompts";

describe("buildFashionAssistantSystemPrompt", () => {
  it("ops phase uses ops-only JSON shape and forbids storyboard regen", () => {
    const prompt = buildFashionAssistantSystemPrompt("ops");
    expect(prompt).toContain("opsPack");
    expect(prompt).toContain("禁止");
    expect(prompt).toContain("storyboardVersions");
    expect(prompt).not.toContain("storyboardVersions A/B/C/D/E");
    expect(prompt).not.toContain('"storyboardVersions": {');
  });

  it("storyboards phase still includes full deliverable shape", () => {
    const prompt = buildFashionAssistantSystemPrompt("storyboards");
    expect(prompt).toContain('"storyboardVersions": {');
  });
});
