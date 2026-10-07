import { describe, expect, it } from "vitest";

import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";

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
