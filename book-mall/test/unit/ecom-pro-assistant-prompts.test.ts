import { describe, expect, it } from "vitest";

import {
  buildProAssistantSystemPrompt,
  resolveProPromptPhase,
} from "@/lib/ecom/ecom-pro-assistant-prompts";

describe("ecom-pro-assistant-prompts · bags", () => {
  it("sellpoints phase prompt includes vertical, fence and mirror roles", () => {
    const prompt = buildProAssistantSystemPrompt("bags", "sellpoints");
    expect(prompt).toContain('"pro-v1"');
    expect(prompt).toContain('"bags"');
    expect(prompt).toContain("pro-deliverable");
    expect(prompt).toContain("五金");
    expect(prompt).toContain("六镜职能");
  });

  it("storyboards phase includes five version titles", () => {
    const prompt = buildProAssistantSystemPrompt("bags", "storyboards");
    expect(prompt).toContain("A版");
    expect(prompt).toContain("固定 6 镜");
  });

  it("resolveProPromptPhase maps internal triggers", () => {
    expect(resolveProPromptPhase("pro-step:sellpoints-generate")).toBe("sellpoints");
    expect(resolveProPromptPhase("pro-step:ops-generate")).toBe("ops");
  });
});
