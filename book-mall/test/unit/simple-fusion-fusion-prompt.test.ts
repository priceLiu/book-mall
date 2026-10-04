import { describe, expect, it } from "vitest";

import { buildSimpleFusionFusionPrompt } from "@/lib/ecom/simple-fusion-video/fusion-prompts";

describe("buildSimpleFusionFusionPrompt", () => {
  const refs = {
    model: { ossUrl: "https://x/model.jpg" },
    garments: [
      { id: "g1", ossUrl: "https://x/g1.jpg" },
      { id: "g2", ossUrl: "https://x/g2.jpg" },
    ],
    scene: { ossUrl: "https://x/scene.jpg" },
  };

  it("uses segmented sections instead of stacked @ prefix", () => {
    const p = buildSimpleFusionFusionPrompt("dance", refs, 1);
    expect(p).toContain("【人物】");
    expect(p).toContain("【服装】");
    expect(p).toContain("【构图与姿态】");
    expect(p.startsWith("@模特1 @服装1")).toBe(false);
  });

  it("binds only the current garment token for multi-look dance", () => {
    const p1 = buildSimpleFusionFusionPrompt("dance", refs, 1);
    const p2 = buildSimpleFusionFusionPrompt("dance", refs, 2);
    expect(p1).toContain("@服装1");
    expect(p1).not.toContain("@服装2");
    expect(p2).toContain("@服装2");
    expect(p2).not.toContain("@服装1");
  });

  it("requires full body hands and feet in composition block", () => {
    const p = buildSimpleFusionFusionPrompt("camera", refs, 1);
    expect(p).toMatch(/双手/);
    expect(p).toMatch(/双脚与鞋子/);
    expect(p).toMatch(/禁止裁切/);
  });
});
