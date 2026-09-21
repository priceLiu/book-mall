import { describe, expect, it } from "vitest";

import { bindPlainMentionAliasesInPrompt, type EcomPromptImageRef } from "@/lib/ecom-prompt-mention";

const refs: EcomPromptImageRef[] = [
  {
    index: 1,
    token: "@详情页参考1",
    kind: "style",
    kindIndex: 1,
    url: "https://example.com/a.jpg",
    label: "详情风格",
    role: "detail-style",
  },
  {
    index: 2,
    token: "@模特1",
    kind: "model",
    kindIndex: 1,
    url: "https://example.com/b.jpg",
    label: "模特",
    role: "model",
  },
  {
    index: 3,
    token: "@产品实拍1",
    kind: "product",
    kindIndex: 1,
    url: "https://example.com/c.jpg",
    label: "商品",
    role: "product",
  },
];

describe("bindPlainMentionAliasesInPrompt", () => {
  it("补全无 @ 的语义代号", () => {
    const raw =
      "模特1 是我的模特，产品实拍1 是我的商品。详情页参考1 是详情编排。按 详情页参考1 生成 5 屏。";
    expect(bindPlainMentionAliasesInPrompt(raw, refs)).toBe(
      "@模特1 是我的模特，@产品实拍1 是我的商品。@详情页参考1 是详情编排。按 @详情页参考1 生成 5 屏。",
    );
  });

  it("不重复添加 @", () => {
    const raw = "@详情页参考1 与 模特1 已绑定";
    expect(bindPlainMentionAliasesInPrompt(raw, refs)).toBe(
      "@详情页参考1 与 @模特1 已绑定",
    );
  });
});
