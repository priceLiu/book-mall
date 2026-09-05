import {
  IMAGE_PROCESSING_TAGS,
  type ImageProcessingTagId,
} from "@/lib/image-processing-tags";
import type { ImageProcessingMode } from "@/lib/image-processing-api";

export type ToolRegistryEntry = {
  slug: ImageProcessingTagId;
  label: string;
  mode: ImageProcessingMode | "placeholder";
  category: "edit" | "generate" | "fun";
  description: string;
  seoTitle: string;
  seoDescription: string;
};

const SLUG_MODE: Record<ImageProcessingTagId, ToolRegistryEntry["mode"]> = {
  "ai-image-generator": "image-generator",
  "ai-retouch": "retouch",
  "ai-image-editor": "editor",
  "ai-image-enhancer": "enhancer",
  "ai-image-upscaler": "outpaint",
  "ai-image-restore": "restore",
  "bg-remover": "bg-remove",
  "object-remover": "object-remove",
  "face-swap": "face-swap",
  "ai-avatar-generator": "avatar",
  "ai-meme-generator": "meme",
  "ai-gif-generator": "gif",
  "ai-face-restore": "placeholder",
  "ai-deblur": "deblur",
  "ai-3d-generator": "placeholder",
  "ai-anime-generator": "placeholder",
  "ai-cartoon-generator": "placeholder",
  "ai-realistic-generator": "realistic",
  "ai-logo-generator": "placeholder",
  "ai-qr-generator": "placeholder",
  "ai-pixel-art": "placeholder",
  "ai-style-transfer": "placeholder",
  "ai-painting-generator": "placeholder",
  "ai-product-photo": "placeholder",
  "ai-poster-generator": "poster",
  "ai-banner-generator": "placeholder",
  "ai-model-generator": "placeholder",
  "id-photo-generator": "placeholder",
  "canny-controlnet": "placeholder",
  "sketch-to-image": "placeholder",
  "pose-to-image": "placeholder",
  "depth-to-image": "placeholder",
  "ai-relight": "placeholder",
  "ai-camera-angle": "camera-angle",
  "ai-outpainting": "placeholder",
  "ai-image-captioner": "placeholder",
};

const CATEGORY: Partial<Record<ImageProcessingTagId, ToolRegistryEntry["category"]>> = {
  "ai-retouch": "edit",
  "ai-image-editor": "edit",
  "ai-image-enhancer": "edit",
  "ai-image-upscaler": "edit",
  "ai-image-restore": "edit",
  "bg-remover": "edit",
  "object-remover": "edit",
  "face-swap": "edit",
  "ai-deblur": "edit",
  "ai-camera-angle": "edit",
  "ai-image-generator": "generate",
  "ai-realistic-generator": "generate",
  "ai-poster-generator": "generate",
  "ai-avatar-generator": "generate",
  "ai-meme-generator": "fun",
  "ai-gif-generator": "fun",
};

const SEO: Partial<
  Record<ImageProcessingTagId, { description: string; seoDescription: string }>
> = {
  "ai-retouch": {
    description: "涂抹蒙版 + 自然语言，局部修图",
    seoDescription: "AI 修图：上传图片、涂抹区域并描述替换内容，经 Gateway 调用百炼 Qwen。",
  },
  "ai-meme-generator": {
    description: "生成表情包并叠加文字",
    seoDescription: "AI 表情包生成器：描述场景，批量生成 meme 图。",
  },
};

export const LIVE_TOOLS: ToolRegistryEntry[] = IMAGE_PROCESSING_TAGS.filter(
  (t) => t.live,
).map((t) => {
  const extra = SEO[t.id];
  return {
    slug: t.id,
    label: t.label,
    mode: SLUG_MODE[t.id],
    category: CATEGORY[t.id] ?? "generate",
    description: extra?.description ?? `${t.label} · AI 图像小工具`,
    seoTitle: `${t.label} · 常用工具`,
    seoDescription:
      extra?.seoDescription ??
      `${t.label}：注册送体验积分，全站 AI 工具通用；按次消耗积分。`,
  };
});

export function getLiveTool(slug: string): ToolRegistryEntry | null {
  return LIVE_TOOLS.find((t) => t.slug === slug) ?? null;
}

export const TOOL_CATEGORIES: Array<{
  id: ToolRegistryEntry["category"];
  label: string;
}> = [
  { id: "edit", label: "图像编辑" },
  { id: "generate", label: "图像生成" },
  { id: "fun", label: "趣味创意" },
];
