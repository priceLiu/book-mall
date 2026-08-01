import { describe, expect, it } from "vitest";

import { resolvePro2StarterDockLinkLabel } from "@/lib/canvas/pro2-dock-upstream-links";
import { pro2ScriptHubLinkedMessage } from "@/lib/canvas/pro2-thin-node-display-state";

describe("resolvePro2StarterDockLinkLabel", () => {
  it("uses story-outline purpose as 故事大纲", () => {
    expect(
      resolvePro2StarterDockLinkLabel({
        pro2TextPurpose: "story-outline",
        themeInput: "主题",
      }),
    ).toBe("故事大纲");
  });

  it("prefers node label when set", () => {
    expect(
      resolvePro2StarterDockLinkLabel({
        label: "第一集大纲",
        pro2TextPurpose: "story-outline",
      }),
    ).toBe("第一集大纲");
  });
});

describe("pro2ScriptHubLinkedMessage", () => {
  it("uses upstream starter label in connected title", () => {
    const msg = pro2ScriptHubLinkedMessage({
      hubId: "hub-1",
      hasOutlineLink: false,
      nodes: [
        {
          id: "starter-1",
          type: "story-pro2-starter",
          position: { x: 0, y: 0 },
          data: {
            label: "故事大纲",
            pro2TextPurpose: "story-outline",
          },
        },
      ],
      edges: [{ id: "e1", source: "starter-1", target: "hub-1" }],
    });
    expect(msg.title).toBe("已链接故事大纲");
  });
});
