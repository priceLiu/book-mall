import { describe, expect, it } from "vitest";

import {
  isPro2GeneralTextNode,
  isPro2StoryOutlineTextNode,
  resolvePro2TextPurpose,
} from "@/lib/canvas/pro2-text-purpose";

describe("pro2-text-purpose (book-mall)", () => {
  it("defaults to general when no script hub link", () => {
    expect(resolvePro2TextPurpose({})).toBe("general");
    expect(isPro2GeneralTextNode({})).toBe(true);
    expect(isPro2StoryOutlineTextNode({})).toBe(false);
  });

  it("respects explicit pro2TextPurpose", () => {
    expect(resolvePro2TextPurpose({ pro2TextPurpose: "story-outline" })).toBe(
      "story-outline",
    );
    expect(resolvePro2TextPurpose({ pro2TextPurpose: "general" })).toBe(
      "general",
    );
  });

  it("infers general from image-to-prompt preset", () => {
    expect(
      resolvePro2TextPurpose({ pro2PresetKind: "image-to-prompt" }),
    ).toBe("general");
  });

  it("infers story-outline when linked to script hub", () => {
    const nodes = [
      { id: "hub", type: "story-pro2-script-hub" },
      { id: "t1", type: "story-pro2-starter" },
    ];
    const edges = [{ source: "t1", target: "hub" }];
    expect(
      resolvePro2TextPurpose({}, { nodeId: "t1", nodes, edges }),
    ).toBe("story-outline");
  });
});
