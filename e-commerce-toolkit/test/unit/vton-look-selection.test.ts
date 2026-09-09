import { describe, expect, it } from "vitest";

import { shouldClearVtonLookSelectionAfterBatch } from "@/lib/vton-look-selection";

describe("shouldClearVtonLookSelectionAfterBatch", () => {
  it("clears after successful or cancelled batch", () => {
    expect(shouldClearVtonLookSelectionAfterBatch("done")).toBe(true);
    expect(shouldClearVtonLookSelectionAfterBatch("cancelled")).toBe(true);
  });

  it("keeps selection while running or failed", () => {
    expect(shouldClearVtonLookSelectionAfterBatch("running")).toBe(false);
    expect(shouldClearVtonLookSelectionAfterBatch("failed")).toBe(false);
    expect(shouldClearVtonLookSelectionAfterBatch(undefined)).toBe(false);
  });
});
