import { describe, expect, it } from "vitest";

import {
  buildWorldlabsWorldPrompt,
  validateWorldGenerateDraft,
} from "@/lib/quick-replica/qr-world-service";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

function baseDraft(overrides: Partial<QrWorkspaceDraft> = {}): QrWorkspaceDraft {
  return {
    category: "world",
    kind: "create-world",
    targetImageUrl: "",
    referenceVideoUrl: "",
    referenceAudioUrl: "",
    sceneImageUrls: [],
    prompt: "A sunlit atrium",
    modelKey: "marble-1.1",
    ...overrides,
  };
}

describe("qr-world-service", () => {
  it("builds text prompt", () => {
    const p = buildWorldlabsWorldPrompt(baseDraft());
    expect(p).toEqual({ type: "text", text_prompt: "A sunlit atrium" });
  });

  it("builds single image prompt with auto pano", () => {
    const p = buildWorldlabsWorldPrompt(
      baseDraft({ sceneImageUrls: ["https://cdn.example/a.jpg"] }),
    );
    expect(p.type).toBe("image");
    if (p.type === "image") {
      expect(p.image_prompt).toEqual({ source: "uri", uri: "https://cdn.example/a.jpg" });
      expect(p.is_pano).toBe("auto");
    }
  });

  it("builds multi-image prompt with azimuth", () => {
    const p = buildWorldlabsWorldPrompt(
      baseDraft({
        sceneImageUrls: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
        worldRefAzimuths: [0, 180],
        worldAutoLayout: true,
      }),
    );
    expect(p.type).toBe("multi-image");
    if (p.type === "multi-image") {
      expect(p.multi_image_prompt).toHaveLength(2);
      expect(p.multi_image_prompt[0]?.azimuth).toBe(0);
      expect(p.multi_image_prompt[1]?.azimuth).toBe(180);
      expect(p.reconstruct_images).toBe(true);
    }
  });

  it("requires text when no media", () => {
    expect(validateWorldGenerateDraft(baseDraft({ prompt: "" }))).toMatch(/描述|参考图/);
    expect(validateWorldGenerateDraft(baseDraft({ prompt: "", sceneImageUrls: ["x"] }))).toBeNull();
  });
});
