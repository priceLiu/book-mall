import { describe, expect, it } from "vitest";
import {
  appendImageEngineRefFooter,
  expandImageEnginePrompt,
  shouldSkipUpstreamTextForImageRefs,
} from "@/lib/canvas/canvas-image-engine-prompt";

describe("appendImageEngineRefFooter", () => {
  it("matches working nano-banana-pro gateway log footer (沈昭昭 4 refs)", () => {
    const out = appendImageEngineRefFooter("【沈昭昭（现代）】持唐刀", 4);
    expect(out).toContain("# 上游附带 4 张参考图（已作为 image_url 附在本条消息）");
    expect(out).toContain("第 1 张为产品主体（必保）");
    expect(out).not.toContain("根据参考图进行图像编辑");
  });

  it("matches working four-view single ref footer", () => {
    const out = appendImageEngineRefFooter("请生成人物的四视图", 1);
    expect(out).toContain("# 上游附带 1 张参考图（已作为 image_url 附在本条消息）");
    expect(out).toContain("第 1 张为产品主体（必保）");
  });
});

describe("expandImageEnginePrompt", () => {
  it("does not prepend extra ref guide (align cmtl903wu / cmto16v9)", () => {
    const out = expandImageEnginePrompt(
      "小男孩图1与小女孩图2在卧室",
      {
        type: "image-engine",
        data: {},
        imageInputs: [
          "https://cdn.example/a.jpg",
          "https://cdn.example/b.jpg",
        ],
        textInputs: [],
      },
      { refCount: 2 },
    );
    expect(out).toContain("小男孩图1与小女孩图2在卧室");
    expect(out).toContain("第 1 张为产品主体（必保）");
    expect(out).not.toContain("根据参考图进行图像编辑");
  });

  it("does not duplicate footer when already present", () => {
    const existing = appendImageEngineRefFooter("场景描述", 1);
    expect(appendImageEngineRefFooter(existing, 1)).toBe(existing);
  });
});

describe("shouldSkipUpstreamTextForImageRefs", () => {
  it("returns true for 图N dock tokens", () => {
    expect(
      shouldSkipUpstreamTextForImageRefs("小男孩图1与小女孩图2在卧室", true),
    ).toBe(true);
  });

  it("returns true for legacy [Image N] dock tokens", () => {
    expect(
      shouldSkipUpstreamTextForImageRefs("角色 [Image 1] 参考", true),
    ).toBe(true);
  });
});
