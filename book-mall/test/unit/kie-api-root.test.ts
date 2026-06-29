import { describe, expect, it } from "vitest";
import { resolveKieApiRoot } from "@/lib/gateway/model-router";

describe("resolveKieApiRoot", () => {
  it("defaults to api.kie.ai", () => {
    expect(resolveKieApiRoot(null)).toBe("https://api.kie.ai");
  });

  it("strips gemini chat path suffix from credential baseUrl", () => {
    expect(
      resolveKieApiRoot("https://api.kie.ai/gemini-3-flash/v1/chat/completions"),
    ).toBe("https://api.kie.ai");
  });

  it("strips codex path suffix", () => {
    expect(resolveKieApiRoot("https://api.kie.ai/codex/v1/responses")).toBe(
      "https://api.kie.ai",
    );
  });
});
