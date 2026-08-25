import { describe, expect, it } from "vitest";
import { resolveDockRunPrompt, resolveSbv1VideoEngineRunPrompt } from "@/lib/canvas/resolve-dock-run-prompt";
import { resolveSbv1VideoModelRefRunWarning } from "@/lib/canvas/sbv1-video-model-reference";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";

const links: Pro2DockUpstreamLink[] = [
  {
    id: "up-img-brand",
    kind: "image",
    label: "粘贴的图片",
    previewUrl: "https://cdn.example/brand.png",
    sourceNodeId: "img1",
  },
  {
    id: "up-tag-1",
    kind: "text",
    label: "品牌",
    previewMd: "AURORA 品牌调性：冷色科技 + 琥珀点缀",
    sourceNodeId: "tag1",
  },
];

describe("resolveDockRunPrompt", () => {
  it("strips image @ tokens and keeps plain text", () => {
    const { prompt, extraText } = resolveDockRunPrompt(
      "主视觉统一，品牌：@<up-img-brand>",
      links,
    );
    expect(prompt).toBe("主视觉统一，品牌：");
    expect(extraText).toEqual([]);
  });

  it("expands text/tag @ into extraText", () => {
    const { prompt, extraText } = resolveDockRunPrompt(
      "参考 @<up-tag-1> 生成海报",
      links,
    );
    expect(prompt).toBe("参考 生成海报");
    expect(extraText).toEqual(["AURORA 品牌调性：冷色科技 + 琥珀点缀"]);
  });

  it("keeps user instruction after stripping text @ mention", () => {
    const { prompt, extraText } = resolveDockRunPrompt(
      "@<up-tag-1>\nExtract Pose 1 from the received text\n输出请转换为中文",
      links,
    );
    expect(prompt).toContain("Extract Pose 1 from the received text");
    expect(prompt).toContain("输出请转换为中文");
    expect(prompt).not.toContain("@<up-tag-1>");
    expect(extraText).toEqual(["AURORA 品牌调性：冷色科技 + 琥珀点缀"]);
  });
});

describe("resolveSbv1VideoEngineRunPrompt", () => {
  const upstream: Pro2DockUpstreamLink[] = [
    {
      id: "sbv1-text-t1",
      kind: "text",
      label: "文本 1",
      previewMd: "小木和小芽去火山探险的完整脚本……",
      sourceNodeId: "t1",
    },
    {
      id: "sbv1-ref-img1",
      kind: "image",
      label: "图片 1",
      previewUrl: "https://cdn.example/a.png",
      sourceNodeId: "img1",
    },
    {
      id: "sbv1-ref-img2",
      kind: "image",
      label: "图片 2",
      previewUrl: "https://cdn.example/b.png",
      sourceNodeId: "img2",
    },
  ];

  it("inlines text @ and maps image @ to [Image N] for HappyHorse R2V", () => {
    expect(
      resolveSbv1VideoEngineRunPrompt(
        "角色: 小蓝 @<sbv1-ref-img1> , 小红 @<sbv1-ref-img2>\n请根据 @<sbv1-text-t1> 生成",
        upstream,
        { modelKey: "happyhorse-1.1-r2v" },
      ),
    ).toBe(
      "角色: 小蓝 [Image 1] , 小红 [Image 2]\n请根据 小木和小芽去火山探险的完整脚本…… 生成",
    );
  });

  it("uses 图N tokens for wan2.7-r2v image mentions", () => {
    expect(
      resolveSbv1VideoEngineRunPrompt(
        "开场 @<sbv1-ref-img1> 请根据 @<sbv1-text-t1> 生成",
        upstream,
        { modelKey: "wan2.7-r2v" },
      ),
    ).toBe(
      "开场 图1 请根据 小木和小芽去火山探险的完整脚本…… 生成",
    );
  });

  it("strips video @ tokens (video passed via in_motion_video edge)", () => {
    const withVideo: Pro2DockUpstreamLink[] = [
      {
        id: "sbv1-motion-v1",
        kind: "video",
        label: "拖入的视频",
        previewUrl: "https://cdn.example/poster.jpg",
        sourceNodeId: "v1",
      },
    ];
    expect(
      resolveSbv1VideoEngineRunPrompt(
        "请去掉 @<sbv1-motion-v1> 右下角水印",
        withVideo,
      ),
    ).toBe("请去掉 右下角水印");
  });
});

describe("resolveSbv1VideoModelRefRunWarning · wan3.0", () => {
  it("does not block All-in-One wan3.0 when refs are connected", () => {
    expect(
      resolveSbv1VideoModelRefRunWarning({
        modelKey: "wan3.0-video",
        refCount: 2,
      }),
    ).toBeNull();
    expect(
      resolveSbv1VideoModelRefRunWarning({
        modelKey: "wan3.0-video-prime",
        refCount: 5,
      }),
    ).toBeNull();
  });

  it("still blocks legacy happyhorse T2V with refs", () => {
    expect(
      resolveSbv1VideoModelRefRunWarning({
        modelKey: "happyhorse-1.1-t2v",
        refCount: 2,
      })?.title,
    ).toBe("请切换为参考生视频模型");
  });
});
