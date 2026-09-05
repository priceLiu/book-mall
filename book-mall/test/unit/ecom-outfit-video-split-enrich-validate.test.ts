import { describe, expect, it } from "vitest";

import {
  isOutfitSplitDescIncomplete,
  normalizeOutfitSplitEnrichScene,
  OUTFIT_SPLIT_MANUAL_EDIT_HINT,
} from "@/lib/ecom/ecom-outfit-video-split-enrich-validate";

describe("ecom-outfit-video-split-enrich-validate", () => {
  it("accepts complete sentences and fallback phrases", () => {
    expect(isOutfitSplitDescIncomplete("固定机位全身正面拍摄，画面稳定")).toBe(false);
    expect(isOutfitSplitDescIncomplete("无法识别光影信息")).toBe(false);
  });

  it("flags truncated short fragments", () => {
    expect(isOutfitSplitDescIncomplete("顶部暖色")).toBe(true);
  });

  it("maps snake_case LLM fields and sets parseIncomplete on bad lighting/scene", () => {
    const norm = normalizeOutfitSplitEnrichScene({
      sceneId: "s1",
      camera_desc: "固定机位全身正面拍摄",
      action_desc: "模特面向镜头缓步向前走",
      light_desc: "顶部暖",
      scene_desc: "米色墙",
    });
    expect(norm.cameraMove).toContain("固定机位");
    expect(norm.parseIncomplete).toBe(true);
    expect(norm.lightingSetup).toBe(OUTFIT_SPLIT_MANUAL_EDIT_HINT);
  });
});
