import { describe, expect, it } from "vitest";
import { resolveDockRunPrompt } from "@/lib/canvas/resolve-dock-run-prompt";
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
