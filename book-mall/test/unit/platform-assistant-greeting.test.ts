import { describe, expect, it } from "vitest";

import { buildAssistantGreeting, pickRandomJoke } from "@private/platform-assistant";

describe("assistant greeting", () => {
  it("includes app links and no pricing disclaimer", () => {
    const g = buildAssistantGreeting("小明");
    expect(g.content).toContain("小明");
    expect(g.content).not.toContain("价格与计费");
    expect(g.content).not.toContain("报价体系");
    expect(g.appLinks.length).toBeGreaterThanOrEqual(8);
  });

  it("picks jokes from pool", () => {
    const jokes = new Set(Array.from({ length: 20 }, () => pickRandomJoke()));
    expect(jokes.size).toBeGreaterThan(1);
  });
});
