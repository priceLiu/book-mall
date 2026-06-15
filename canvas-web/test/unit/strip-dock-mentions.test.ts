import { describe, expect, it } from "vitest";

import {
  mentionIdsForRemovedCanvasNode,
  removeDockRefFromState,
  stripMentionTokensFromPrompt,
  stripStaleMentionTokensFromPrompt,
} from "@/lib/canvas/strip-dock-mentions";

describe("stripMentionTokensFromPrompt", () => {
  it("removes @<id> token", () => {
    const id = "up-style-n_abc";
    expect(
      stripMentionTokensFromPrompt(`一对情侣 @<${id}> 突然分手`, [id]),
    ).toBe("一对情侣 突然分手");
  });

  it("removes multiple tokens", () => {
    expect(
      stripMentionTokensFromPrompt("@<a> foo @<b> bar", ["a", "b"]),
    ).toBe("foo bar");
  });
});

describe("stripStaleMentionTokensFromPrompt", () => {
  it("drops refs not in catalog", () => {
    const prompt = "hello @<gone> world @<keep>";
    expect(stripStaleMentionTokensFromPrompt(prompt, ["keep"])).toBe(
      "hello world @<keep>",
    );
  });
});

describe("mentionIdsForRemovedCanvasNode", () => {
  it("includes upstream link id prefixes", () => {
    expect(mentionIdsForRemovedCanvasNode("n_x")).toContain("up-style-n_x");
  });
});

describe("removeDockRefFromState", () => {
  it("filters ref and strips mention", () => {
    const refs = [{ id: "ref-1", label: "a" }];
    const r = removeDockRefFromState(refs, "ref-1", "text @<ref-1> end");
    expect(r.refs).toHaveLength(0);
    expect(r.prompt).toBe("text end");
  });
});
