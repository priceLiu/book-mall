import { describe, expect, it } from "vitest";

import { resolveStoryboardPanelVideoRefPlan } from "@/lib/ecom/ecom-storyboard-video-ref-rules";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";

describe("resolveStoryboardPanelVideoRefPlan", () => {
  const references: StoryboardReference[] = [
    {
      id: "p1",
      label: "产品",
      role: "product",
      ossUrl: "https://cdn.example.com/product.jpg",
    },
    {
      id: "c1",
      label: "角色",
      role: "character",
      ossUrl: "https://cdn.example.com/char.jpg",
    },
    {
      id: "s1",
      label: "场景1",
      role: "scene",
      ossUrl: "https://cdn.example.com/scene1.jpg",
    },
    {
      id: "s2",
      label: "场景2",
      role: "scene",
      ossUrl: "https://cdn.example.com/scene2.jpg",
    },
  ];

  it("keeps character ref before scene refs when cap is tight (wan2.6 R2V)", () => {
    const plan = resolveStoryboardPanelVideoRefPlan({
      modelKey: "wan2.6-r2v",
      references,
      panelImageUrl: "https://cdn.example.com/panel1.jpg",
    });
    const roles = plan.slots.map((s) => s.role);
    expect(roles[0]).toBe("panel");
    expect(roles).toContain("product");
    expect(roles).toContain("character");
    const charIdx = roles.indexOf("character");
    const sceneIdx = roles.indexOf("scene");
    expect(charIdx).toBeGreaterThan(0);
    if (sceneIdx >= 0) {
      expect(charIdx).toBeLessThan(sceneIdx);
    }
  });
});
