import { describe, expect, it } from "vitest";

import { scanMentionTriggerBeforeCursor } from "@/lib/canvas/mention-editable-trigger";

const mentionables = [{ label: "ref.png", id: "n1" }];

describe("scanMentionTriggerBeforeCursor", () => {
  it("triggers at line start @", () => {
    expect(scanMentionTriggerBeforeCursor("@", mentionables)).toEqual({
      at: 0,
      filter: "",
    });
  });

  it("triggers when @ appended after text without leading space", () => {
    expect(scanMentionTriggerBeforeCursor("hello@", mentionables)).toEqual({
      at: 5,
      filter: "",
    });
  });

  it("triggers after whitespace-prefixed @", () => {
    expect(scanMentionTriggerBeforeCursor("hello @ref", mentionables)).toEqual({
      at: 6,
      filter: "ref",
    });
  });

  it("does not trigger when whitespace appears in filter tail", () => {
    expect(scanMentionTriggerBeforeCursor("hello @ref x", mentionables)).toBeNull();
  });

  it("does not trigger when filter already matches a full label", () => {
    expect(
      scanMentionTriggerBeforeCursor("hello @ref.png", mentionables),
    ).toBeNull();
  });

  it("does not trigger mid-token before earlier whitespace", () => {
    expect(scanMentionTriggerBeforeCursor("foo bar", mentionables)).toBeNull();
  });
});
