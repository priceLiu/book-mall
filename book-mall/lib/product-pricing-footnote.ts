import type { ProductKind } from "@prisma/client";

/** 产品 catalog 不再展示数字标价时的统一说明（计费：课程=订阅；工具=钱包+工具管理单价） */
export function productPricingFootnote(kind: ProductKind): string {
  return kind === "KNOWLEDGE"
    ? "含于有效订阅 · AI 学堂学习"
    : "充值钱包后按次计费 · 单价见后台工具管理";
}
