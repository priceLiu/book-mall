import type { ComponentProps } from "react";

import type { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";

/** 与模特试衣 / 换背景一致：正文 @ 引用带缩略图，顶栏同步 Prompt 内已引用素材 */
export const PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS = {
  mentionBadgeVariant: "thumbnail",
  syncRefBarWithPrompt: true,
  refBarHint: "参考资产 · Prompt 中已 @ 引用的素材",
} satisfies Partial<ComponentProps<typeof ProductDesignPromptMentionTextarea>>;
