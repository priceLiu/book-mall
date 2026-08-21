import { describe, expect, it } from "vitest";

import { planDeferredCommitOnSourceSwitch } from "@/lib/canvas/use-deferred-text-commit";

describe("planDeferredCommitOnSourceSwitch", () => {
  it("does nothing when the dock stays on the same node", () => {
    expect(
      planDeferredCommitOnSourceSwitch({
        prevSourceKey: "n1",
        nextSourceKey: "n1",
        pendingValue: "hello",
      }),
    ).toEqual({ flushValue: null, resetDraft: false });
  });

  it("flushes the pending draft to the previous node when switching", () => {
    expect(
      planDeferredCommitOnSourceSwitch({
        prevSourceKey: "n1",
        nextSourceKey: "n2",
        pendingValue: "from-n1",
      }),
    ).toEqual({ flushValue: "from-n1", resetDraft: true });
  });

  it("still resets draft when switching with no pending debounce", () => {
    expect(
      planDeferredCommitOnSourceSwitch({
        prevSourceKey: "n1",
        nextSourceKey: "n2",
        pendingValue: null,
      }),
    ).toEqual({ flushValue: null, resetDraft: true });
  });
});
