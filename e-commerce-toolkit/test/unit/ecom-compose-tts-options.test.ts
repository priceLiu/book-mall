import { describe, expect, it } from "vitest";

import {
  buildSeedVideoComposeTtsOptions,
  buildSimpleFusionComposeTtsOptions,
} from "@/lib/ecom-compose-tts-options";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";

describe("ecom-compose-tts-options", () => {
  it("lists simple fusion TTS by look", () => {
    const project = {
      meta: {
        looks: [
          {
            lookId: "L1",
            garmentId: "g1",
            ttsUrl: "https://cdn/a.mp3",
            voiceover: "第一句口播",
          },
          { lookId: "L2", garmentId: "g2" },
        ],
      },
    } as SimpleFusionProject;
    const opts = buildSimpleFusionComposeTtsOptions(project, [
      { key: "L1", caption: "套装 A" },
      { key: "L2", caption: "套装 B" },
    ]);
    expect(opts).toHaveLength(1);
    expect(opts[0]?.label).toBe("套装 A");
    expect(opts[0]?.suggestedClipId).toBe("look-L1");
    expect(opts[0]?.voiceover).toBe("第一句口播");
  });

  it("lists seed video TTS by shot index", () => {
    const opts = buildSeedVideoComposeTtsOptions([
      {
        index: 2,
        timeSlice: "5-10s",
        refImageId: "r",
        refImageLabel: "@图1",
        sceneDescription: "s",
        videoPrompt: "v",
        voiceover: "镜2口播",
        durationSec: 5,
        ttsUrl: "https://cdn/b.mp3",
      },
    ]);
    expect(opts[0]?.label).toContain("镜 2");
    expect(opts[0]?.suggestedClipId).toBe("shot-2");
  });
});
