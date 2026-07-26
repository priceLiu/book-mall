import { describe, expect, it } from "vitest";
import { resolveDockRunPrompt, resolveSbv1VideoEngineRunPrompt } from "@/lib/canvas/resolve-dock-run-prompt";
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
});

describe("resolveSbv1VideoEngineRunPrompt", () => {
  it("inlines sbv1 text upstream @ into final prompt", () => {
    const upstream: Pro2DockUpstreamLink[] = [
      {
        id: "sbv1-text-t1",
        kind: "text",
        label: "文本 1",
        previewMd: "小木和小芽去火山探险的完整脚本……",
        sourceNodeId: "t1",
      },
    ];
    expect(
      resolveSbv1VideoEngineRunPrompt(
        "开场 @<sbv1-text-t1> 请根据 @<sbv1-ref-img1> 生成",
        [
          ...upstream,
          {
            id: "sbv1-ref-img1",
            kind: "image",
            label: "图片 1",
            previewUrl: "https://cdn.example/a.png",
            sourceNodeId: "img1",
          },
        ],
      ),
    ).toBe(
      "开场 请根据 生成\n\n小木和小芽去火山探险的完整脚本……",
    );
  });
});
