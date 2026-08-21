import { describe, expect, it } from "vitest";

import { resolvePro2StarterDockLinkLabel, resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
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

  it("keeps custom title after general text has generated output", () => {
    expect(
      resolvePro2StarterDockLinkLabel({
        label: "提取pose 描述",
        pro2TextPurpose: "general",
        generatedOutlineMd: '{"pose1":"stand"}',
      }),
    ).toBe("提取pose 描述");
  });

  it("does not relabel general generated text as 故事大纲", () => {
    expect(
      resolvePro2StarterDockLinkLabel({
        pro2TextPurpose: "general",
        generatedOutlineMd: '{"pose1":"stand"}',
      }),
    ).toBe("文本");
  });
});

describe("resolvePro2DockUpstreamLinks · starter outline chip", () => {
  it("shows renamed starter title instead of 故事大纲", () => {
    const links = resolvePro2DockUpstreamLinks(
      "n-down",
      "story-pro2-starter",
      [
        {
          id: "n-up",
          type: "story-pro2-starter",
          position: { x: 0, y: 0 },
          data: {
            label: "提取pose 描述",
            pro2TextPurpose: "general",
            generatedOutlineMd: '{"pose1":"stand"}',
          },
        },
        {
          id: "n-down",
          type: "story-pro2-starter",
          position: { x: 400, y: 0 },
          data: { themeInput: "@<up-outline-n-up>" },
        },
      ],
      [{ id: "e1", source: "n-up", target: "n-down", targetHandle: "in_text" }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.label).toBe("提取pose 描述");
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
