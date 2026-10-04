import { describe, expect, it } from "vitest";

import {
  buildSimpleFusionPreviewSlots,
  simpleFusionSlotFusionGenerating,
  simpleFusionSlotVideoGenerating,
} from "@/lib/simple-fusion-preview-slots";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";

function baseProject(overrides: Partial<SimpleFusionProject> = {}): SimpleFusionProject {
  return {
    id: "p1",
    title: null,
    module: "video-camera",
    templateId: "simple-fusion-i2v-v1",
    status: "idle",
    phase: "refs",
    settings: {},
    references: {},
    composeResult: null,
    meta: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("buildSimpleFusionPreviewSlots", () => {
  it("shows one placeholder when no garments", () => {
    const slots = buildSimpleFusionPreviewSlots(baseProject(), { garmentMulti: false });
    expect(slots).toHaveLength(1);
    expect(slots[0]!.caption).toBe("融合 + 片段");
  });

  it("shows two placeholders for dance when no garments", () => {
    const slots = buildSimpleFusionPreviewSlots(baseProject(), { garmentMulti: true });
    expect(slots).toHaveLength(2);
  });

  it("uses garment count before generate", () => {
    const slots = buildSimpleFusionPreviewSlots(
      baseProject({
        references: {
          garments: [
            { id: "g1", ossUrl: "https://x/a.png" },
            { id: "g2", ossUrl: "https://x/b.png" },
          ],
        },
      }),
      { garmentMulti: true },
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]!.key).toBe("g1");
  });
});

describe("simpleFusionSlotFusionGenerating", () => {
  it("animates when pipeline busy and slot empty", () => {
    expect(
      simpleFusionSlotFusionGenerating({ key: "1", caption: "x" }, true),
    ).toBe(true);
  });

  it("does not show fusion generating when slot busy but fused image exists (video step)", () => {
    expect(
      simpleFusionSlotFusionGenerating(
        {
          key: "1",
          caption: "x",
          fusedImageUrl: "https://x/old.png",
          status: "generating",
        },
        true,
        true,
      ),
    ).toBe(false);
  });
});

describe("simpleFusionSlotVideoGenerating", () => {
  const fused = {
    key: "1",
    caption: "x",
    fusedImageUrl: "https://x/f.png",
  };

  it("stops when look failed even if status was generating", () => {
    expect(
      simpleFusionSlotVideoGenerating(
        { ...fused, status: "failed", failReason: "err" },
        true,
      ),
    ).toBe(false);
  });

  it("does not spin on stale generating after pipeline idle", () => {
    expect(
      simpleFusionSlotVideoGenerating({ ...fused, status: "generating" }, false),
    ).toBe(false);
  });

  it("spins while pipeline busy and fused image ready", () => {
    expect(simpleFusionSlotVideoGenerating(fused, true)).toBe(true);
  });
});
