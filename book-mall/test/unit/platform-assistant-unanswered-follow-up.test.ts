import { describe, expect, it } from "vitest";

import {
  appendAssistantUnansweredFollowUp,
  assistantUnansweredFollowUp,
  needsAssistantUnansweredFollowUp,
} from "@/lib/platform-assistant/unanswered-follow-up";

describe("assistant unanswered follow-up", () => {
  it("appends suffix after existing reply", () => {
    const base = "关于该功能，暂未收录该信息。";
    const out = appendAssistantUnansweredFollowUp(base);
    expect(out.startsWith(base)).toBe(true);
    expect(out.endsWith(assistantUnansweredFollowUp())).toBe(true);
  });

  it("does not duplicate suffix", () => {
    const once = appendAssistantUnansweredFollowUp("暂未收录");
    const twice = appendAssistantUnansweredFollowUp(once);
    expect(twice).toBe(once);
    expect(needsAssistantUnansweredFollowUp(once)).toBe(false);
  });
});
