import { describe, expect, it } from "vitest";

import {
  SCENE_TEMPLATE_DEFAULTS,
  SCENE_TEMPLATE_IDS,
} from "@/lib/platform-model/scene-templates";

describe("scene-templates", () => {
  it("defines six template ids", () => {
    expect(SCENE_TEMPLATE_IDS).toEqual(["text", "t2i", "i2i", "t2v", "i2v", "v2v"]);
    expect(SCENE_TEMPLATE_DEFAULTS.map((d) => d.id)).toEqual([...SCENE_TEMPLATE_IDS]);
  });

  it("default rulesJson must not contain vendor", () => {
    for (const d of SCENE_TEMPLATE_DEFAULTS) {
      expect(JSON.stringify(d.rulesJson)).not.toMatch(/vendor/i);
    }
  });
});
