import { describe, expect, it } from "vitest";

import { marketingHomeSectionUrl } from "@/lib/portal-nav";

describe("marketingHomeSectionUrl", () => {
  it("builds origin + hash without invalid path segment", () => {
    expect(marketingHomeSectionUrl("http://localhost:3000", "#hero-video")).toBe(
      "http://localhost:3000#hero-video",
    );
    expect(marketingHomeSectionUrl("https://book.ai-code8.com/", "hero-video")).toBe(
      "https://book.ai-code8.com#hero-video",
    );
  });
});
