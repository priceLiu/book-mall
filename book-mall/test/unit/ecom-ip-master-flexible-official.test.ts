import { describe, expect, it } from "vitest";

import {
  IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES,
  normalizeToOfficialFlexibleFeatures,
} from "@/lib/ecom/ecom-ip-master-flexible-official";
import { parseIpMasterTemplateJson } from "@/lib/ecom/ecom-ip-master-template-schema";

describe("ip master official flexible features", () => {
  it("normalizes legacy free-form list to 6 official items", () => {
    const out = normalizeToOfficialFlexibleFeatures([
      { featureName: "色彩", description: "主色 #112233" },
      { featureName: "配饰与服装", description: "蓝色卫衣" },
    ]);
    expect(out).toHaveLength(6);
    expect(out[0]?.featureName).toBe("色彩方案");
    expect(out[0]?.description).toContain("#112233");
    expect(out[3]?.description).toContain("蓝色卫衣");
  });

  it("parse template coerces flexibleFeatures to official 6", () => {
    const parsed = parseIpMasterTemplateJson({
      imagePrompt: { positive: "test" },
      ipMeta: {
        ipId: "p1",
        ipName: "波波仔",
        version: "V0.1",
        createTime: "2026-10-03",
      },
      rigidFeatures: [{ featureName: "脸", description: "圆脸", weight: 0.9 }],
      flexibleFeatures: [{ featureName: "头发", description: "可换发色" }],
      softConstraint: "保持气质",
    });
    expect(parsed?.flexibleFeatures).toHaveLength(6);
    expect(parsed?.flexibleFeatures.map((f) => f.featureName)).toEqual([
      ...IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES,
    ]);
  });
});
