import { describe, expect, it } from "vitest";

import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { buildPro2StyleRefDockInput } from "@/lib/canvas/pro2-spawn-style-asset";
import {
  PRO2_STYLE_ASSET_NODE_HEIGHT,
  PRO2_STYLE_ASSET_NODE_WIDTH,
} from "@/lib/canvas/story-pro2-node-dimensions";
import {
  STYLE_LIBRARY_PREVIEW_ASPECT_H,
  STYLE_LIBRARY_PREVIEW_ASPECT_W,
} from "@/lib/canvas/style-library-card-chrome";

describe("buildPro2DockMentionables", () => {
  it("lists only upstream links (no assets or platform shots)", () => {
    const items = buildPro2DockMentionables(
      [
        {
          id: "n1",
          kind: "image",
          label: "图片",
          previewUrl: "https://example.com/a.jpg",
        },
      ],
      [{ id: "ref1", label: "参考", url: "https://example.com/r.jpg" }],
      [
        {
          id: "asset1",
          displayName: "资产",
          thumbnailUrl: "https://example.com/t.jpg",
          refs: [],
        } as never,
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("n1");
  });
});

describe("buildPro2StyleRefDockInput", () => {
  it("uses up-style mention id for dock storage", () => {
    expect(buildPro2StyleRefDockInput("n_abc12345")).toBe(
      "参考 @<up-style-n_abc12345> 风格生成图",
    );
  });

  it("inserts style prompt between @ mention and 风格生成图", () => {
    expect(
      buildPro2StyleRefDockInput("n_x", "港风、复古滤镜、胶片颗粒"),
    ).toBe(
      "参考 @<up-style-n_x> 港风、复古滤镜、胶片颗粒 风格生成图",
    );
  });
});

describe("PRO2_STYLE_ASSET_NODE_DEFAULT_SIZE", () => {
  it("matches style library portrait aspect", () => {
    const stageH = PRO2_STYLE_ASSET_NODE_HEIGHT - 32;
    const ratio = PRO2_STYLE_ASSET_NODE_WIDTH / stageH;
    const target =
      STYLE_LIBRARY_PREVIEW_ASPECT_W / STYLE_LIBRARY_PREVIEW_ASPECT_H;
    expect(ratio).toBeCloseTo(target, 2);
    expect(PRO2_STYLE_ASSET_NODE_WIDTH).toBeLessThan(PRO2_STYLE_ASSET_NODE_HEIGHT);
  });
});
