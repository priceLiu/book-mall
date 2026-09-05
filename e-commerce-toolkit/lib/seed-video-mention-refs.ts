import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { SeedVideoReference } from "@/lib/seed-video-types";

export function buildSeedVideoMentionRefs(
  references: SeedVideoReference[],
): EcomPromptImageRef[] {
  return references
    .filter((r) => r.role === "seed-material")
    .map((r, i) => ({
      index: i + 1,
      token: `@图片${i + 1}`,
      kind: "product" as const,
      kindIndex: i + 1,
      url: r.ossUrl,
      label: r.label || `图片${i + 1}`,
      role: "seed-material",
    }));
}

export const SEED_VIDEO_WELCOME_MESSAGE = `你好，我是种草短视频策划助理。

**本栏**：过程、结论与全部点选交互（脚本、制作模式、成片风格等）。  
**中间工作区**：上传种草素材、填写 Prompt（可 @ 图片）并点击「开始策划」。

请先在中间工作区上传 **1～9 张素材** 并填写 Prompt；完成后点「开始策划」，脚本与模式选择在本栏继续。`;

export const SEED_VIDEO_PROMPT_PLACEHOLDER =
  "@图片1@图片2 帮我用这些素材生成3个种草视频脚本（并带有口播文案），视频时长预计20s，给我选择确认";
