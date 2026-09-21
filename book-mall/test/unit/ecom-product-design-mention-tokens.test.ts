import { describe, expect, it } from "vitest";

import { buildSemanticMentionRefs } from "@/lib/ecom/ecom-product-design-mention-tokens";

describe("buildSemanticMentionRefs", () => {
  it("detail 风格用 @详情页参考N，模特用 @模特N", () => {
    const refs = buildSemanticMentionRefs(
      [
        {
          id: "1",
          role: "detail-style",
          label: "拼图",
          ossUrl: "https://a/1.jpg",
        },
        { id: "2", role: "model", label: "模特A", ossUrl: "https://a/2.jpg" },
        { id: "3", role: "model", label: "模特B", ossUrl: "https://a/3.jpg" },
        { id: "4", role: "product", label: "夹克", ossUrl: "https://a/4.jpg" },
      ],
      "detail",
    );
    expect(refs.map((r) => r.token)).toEqual([
      "@详情页参考1",
      "@模特1",
      "@模特2",
      "@产品实拍1",
    ]);
    expect(refs[1]?.kind).toBe("model");
  });
});
