/** 图像处理 · 头部标签（对齐参考站） */

export type ImageProcessingTagId =
  | "ai-image-generator"
  | "ai-retouch"
  | "ai-image-editor"
  | "ai-image-enhancer"
  | "ai-image-upscaler"
  | "ai-image-restore"
  | "bg-remover"
  | "object-remover"
  | "face-swap"
  | "ai-avatar-generator"
  | "ai-meme-generator"
  | "ai-gif-generator"
  | "ai-face-restore"
  | "ai-deblur"
  | "ai-3d-generator"
  | "ai-anime-generator"
  | "ai-cartoon-generator"
  | "ai-realistic-generator"
  | "ai-logo-generator"
  | "ai-qr-generator"
  | "ai-pixel-art"
  | "ai-style-transfer"
  | "ai-painting-generator"
  | "ai-product-photo"
  | "ai-poster-generator"
  | "ai-banner-generator"
  | "ai-model-generator"
  | "id-photo-generator"
  | "canny-controlnet"
  | "sketch-to-image"
  | "pose-to-image"
  | "depth-to-image"
  | "ai-relight"
  | "ai-camera-angle"
  | "ai-outpainting"
  | "ai-image-captioner";

export type ImageProcessingTag = {
  id: ImageProcessingTagId;
  label: string;
  /** 已上线 */
  live?: boolean;
};

export const IMAGE_PROCESSING_TAGS: ImageProcessingTag[] = [
  { id: "ai-image-generator", label: "AI图像生成器" },
  { id: "ai-retouch", label: "AI修图", live: true },
  { id: "ai-image-editor", label: "AI图像编辑器", live: true },
  { id: "ai-image-enhancer", label: "AI图像增强器", live: true },
  { id: "ai-image-upscaler", label: "AI扩图", live: true },
  { id: "ai-image-restore", label: "图片修复", live: true },
  { id: "bg-remover", label: "背景移除器", live: true },
  { id: "object-remover", label: "物体移除器", live: true },
  { id: "face-swap", label: "换脸", live: true },
  { id: "ai-avatar-generator", label: "AI虚拟形象生成器", live: true },
  { id: "ai-meme-generator", label: "AI表情包生成器", live: true },
  { id: "ai-gif-generator", label: "GIF生成器", live: true },
  { id: "ai-face-restore", label: "AI人脸修复" },
  { id: "ai-deblur", label: "AI图像去模糊", live: true },
  { id: "ai-3d-generator", label: "AI 3D生成器" },
  { id: "ai-anime-generator", label: "AI动漫生成器" },
  { id: "ai-cartoon-generator", label: "AI卡通生成器" },
  { id: "ai-realistic-generator", label: "AI逼真图像生成器" },
  { id: "ai-logo-generator", label: "AI标志生成器" },
  { id: "ai-qr-generator", label: "AI二维码生成器" },
  { id: "ai-pixel-art", label: "AI像素艺术" },
  { id: "ai-style-transfer", label: "AI风格迁移" },
  { id: "ai-painting-generator", label: "AI绘画生成器" },
  { id: "ai-product-photo", label: "AI产品照片" },
  { id: "ai-poster-generator", label: "AI海报生成器", live: true },
  { id: "ai-banner-generator", label: "AI横幅生成器" },
  { id: "ai-model-generator", label: "AI模型生成器" },
  { id: "id-photo-generator", label: "身份证照片生成器" },
  { id: "canny-controlnet", label: "Canny边缘到图像" },
  { id: "sketch-to-image", label: "草图到图像" },
  { id: "pose-to-image", label: "姿势到图像" },
  { id: "depth-to-image", label: "深度到图像" },
  { id: "ai-relight", label: "AI Relight" },
  { id: "ai-camera-angle", label: "AI相机角度转换器", live: true },
  { id: "ai-outpainting", label: "AI外绘" },
  { id: "ai-image-captioner", label: "AI图像描述器" },
];

/** 首行展示数量（其余在「更多」展开） */
export const IMAGE_PROCESSING_TAG_COLLAPSED_COUNT = 10;

export function imageProcessingPageTitle(activeTag: ImageProcessingTagId | null): string {
  if (activeTag === "ai-image-editor") return "AI图像编辑器";
  if (activeTag === "ai-image-enhancer") return "AI图像增强器";
  if (activeTag === "ai-image-upscaler") return "AI扩图";
  if (activeTag === "ai-image-restore") return "图片修复";
  if (activeTag === "bg-remover") return "背景移除器";
  if (activeTag === "object-remover") return "物体移除器";
  if (activeTag === "ai-deblur") return "AI图像去模糊";
  if (activeTag === "ai-camera-angle") return "AI相机角度转换器";
  if (activeTag === "ai-poster-generator") return "AI海报生成器";
  if (activeTag === "ai-meme-generator") return "AI表情包生成器";
  if (activeTag === "ai-avatar-generator") return "AI虚拟形象生成器";
  if (activeTag === "ai-gif-generator") return "GIF生成器";
  if (activeTag === "face-swap") return "换脸";
  if (activeTag === "ai-retouch" || activeTag === null) return "AI 修图";
  const tag = IMAGE_PROCESSING_TAGS.find((t) => t.id === activeTag);
  return tag?.label ?? "AI 修图";
}
