/** 图像处理 · 前端预设选项（与 book-mall presets 对齐） */

export const DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER =
  "模糊、低质量、带水印、失真……";

export const ENHANCER_STYLE_OPTIONS = [
  { id: "standard", label: "标准 — 降噪 + 锐化混合" },
  { id: "photo-restore", label: "摄影修复" },
  { id: "balanced", label: "平衡增强" },
  { id: "ai-detail", label: "人工智能细节恢复" },
  { id: "top-quality", label: "最高品质细节" },
  { id: "text-logo", label: "最适合文字和标志" },
  { id: "stylized", label: "风格化细节" },
] as const;

export const RESTORE_REPAIR_OPTIONS = [
  { id: "auto", label: "自动（检测所有问题）" },
  { id: "upscale", label: "升级（2倍 / 4倍）" },
  { id: "denoise", label: "去除噪点 / 颗粒" },
  { id: "jpeg", label: "修复 JPEG 伪影" },
  { id: "scratches", label: "修复划痕" },
  { id: "full", label: "全面修复" },
] as const;

export const RESTORE_UPSCALE_OPTIONS = [
  { id: "1", label: "1x（仅修复）" },
  { id: "2", label: "2倍分辨率" },
  { id: "4", label: "4倍分辨率" },
] as const;

export const FACE_SWAP_BLEND_OPTIONS = [
  { id: "natural", label: "天然（推荐）" },
  { id: "strong", label: "强（更靠近源头）" },
  { id: "subtle", label: "微妙（轻柔混合）" },
] as const;

export const FACE_SWAP_POST_OPTIONS = [
  { id: "auto-beauty", label: "自动美颜" },
  { id: "hd-face", label: "高清人脸修复（最高清晰度）" },
  { id: "none", label: "无（保留原始输出）" },
] as const;

export const FACE_SWAP_ALGORITHM_OPTIONS = [
  { id: "standard", label: "标准 — inswapper_128 + GFPGAN 恢复" },
  { id: "natural-fusion", label: "自然身份融合" },
  { id: "strongest-match", label: "最强身份匹配" },
] as const;

export const RESTORE_FACE_SWAP_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "doubao-seedream-5-0-lite",
] as const;

export const BG_MODE_OPTIONS = [
  { id: "transparent", label: "透明 (PNG)" },
  { id: "white", label: "纯白色" },
  { id: "black", label: "纯黑色" },
  { id: "blur", label: "模糊的原图（人像模式）" },
  { id: "custom", label: "自定义颜色" },
] as const;

export const BG_REMOVAL_MODEL_OPTIONS = [
  { id: "qwen-image-edit-max", label: "百炼 · 快速抠图（推荐）" },
  { id: "qwen-image-edit", label: "Qwen 图像编辑" },
  { id: "doubao-seedream-5-0-lite", label: "Doubao Seedream 5.0 Lite" },
] as const;

export const BG_EDGE_QUALITY_OPTIONS = [
  { id: "auto", label: "自动（推荐）" },
  { id: "high", label: "高（速度较慢，边缘最干净）" },
  { id: "fast", label: "快速（速度更快，边缘性能好）" },
] as const;

export const BG_OUTPUT_FORMAT_OPTIONS = [
  { id: "png", label: "PNG（保留透明度）" },
  { id: "webp", label: "WebP（文件较小）" },
  { id: "jpg", label: "JPG（无透明度）" },
] as const;

export const GENERATIVE_IMAGE_COUNT_OPTIONS = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "4", label: "4" },
] as const;

export const OBJECT_REMOVE_MODE_OPTIONS = [
  { id: "auto", label: "自动（AI 检测并移除）" },
  { id: "clean-fill", label: "干净填充（平滑背景）" },
  { id: "context", label: "上下文感知（匹配周围环境）" },
] as const;

export const OBJECT_OUTPUT_FORMAT_OPTIONS = [
  { id: "png", label: "PNG（无损）" },
  { id: "jpg", label: "JPG（文件较小）" },
  { id: "webp", label: "WebP（现代、小尺寸）" },
] as const;

export const GENERATIVE_MODEL_OPTIONS = [
  { id: "qwen-image-edit", label: "Qwen 图像编辑" },
  { id: "qwen-image-edit-max", label: "Qwen 图像编辑 Max" },
  { id: "doubao-seedream-5-0-lite", label: "Seedream 5.0 Lite" },
] as const;

export const POSTER_MODEL_OPTIONS = [
  { id: "doubao-seedream-5-0-lite", label: "Seedream 5.0 Lite" },
  { id: "lib-nano-pro", label: "KIE NanoBanana Pro" },
] as const;

/** Seedream + KIE 文生图面板共用 */
export const T2I_MODEL_OPTIONS = POSTER_MODEL_OPTIONS;

export const MEME_FORMAT_OPTIONS = [
  { id: "classic", label: "经典（顶部/底部文字）" },
  { id: "drake", label: "德雷克（赞成/反对）" },
  { id: "distracted-bf", label: "心不在焉的男朋友" },
  { id: "woman-cat", label: "女人对着猫大喊大叫" },
  { id: "two-buttons", label: "两个按钮" },
  { id: "expanding-brain", label: "大脑扩张" },
] as const;

export const MEME_TEXT_STYLE_OPTIONS = [
  { id: "impact-classic", label: "冲击白 + 黑色轮廓（经典）" },
  { id: "helvetica-bold", label: "Helvetica 粗体" },
  { id: "comic-sans", label: "Comic Sans（用于讽刺）" },
] as const;

export const AVATAR_STYLE_OPTIONS = [
  { id: "pixar-3d", label: "Pixar 3D" },
  { id: "disney-2d", label: "Disney 2D 动画" },
  { id: "anime", label: "日式动漫" },
  { id: "cyberpunk", label: "赛博朋克" },
  { id: "corporate-memphis", label: "Corporate Memphis" },
  { id: "fantasy-rpg", label: "奇幻 RPG" },
  { id: "pixel-art", label: "像素艺术" },
  { id: "chibi", label: "可爱 Q 版" },
  { id: "clay", label: "粘土/橡皮泥" },
] as const;

export const AVATAR_CROP_OPTIONS = [
  { id: "circle", label: "圆圈（头像）" },
  { id: "square", label: "正方形" },
  { id: "rounded-square", label: "圆角正方形" },
  { id: "hexagon", label: "六边形" },
] as const;

export const GIF_ANIMATION_TYPE_OPTIONS = [
  { id: "seamless-loop", label: "无缝循环" },
  { id: "reaction", label: "反应 GIF" },
  { id: "morph", label: "变形/过渡" },
  { id: "loading", label: "加载中/旋转图标" },
  { id: "dynamic-photo", label: "动态照片" },
  { id: "animated-text", label: "动画文本" },
] as const;

export const GIF_DURATION_OPTIONS = [
  { id: "2", label: "2 秒（最小文件）" },
  { id: "3", label: "3 秒" },
  { id: "5", label: "5 秒（大文件）" },
] as const;

export const GIF_SIZE_OPTIONS = [
  { id: "256", label: "256px（聊天/Discord）" },
  { id: "480", label: "480 像素（默认值）" },
  { id: "720", label: "720 像素（高清）" },
] as const;

export const GIF_FRAME_RATE_OPTIONS = [
  { id: "12", label: "12 帧/秒（小文件）" },
  { id: "24", label: "24 帧/秒（流畅）" },
] as const;

export const CAMERA_ANGLE_OPTIONS = [
  { id: "three-quarter", label: "四分之三视角" },
  { id: "side-profile", label: "侧面轮廓" },
  { id: "top-down", label: "自顶向下" },
  { id: "bottom-up", label: "自下而上" },
  { id: "close-up", label: "特写" },
  { id: "wide-angle", label: "广角镜头" },
  { id: "behind-scenes", label: "幕后主题" },
  { id: "over-shoulder", label: "过肩视角" },
] as const;

export const POSTER_STYLE_OPTIONS = [
  { id: "concert", label: "演唱会" },
  { id: "movie", label: "电影" },
  { id: "inspirational", label: "励志" },
  { id: "corporate", label: "企业" },
  { id: "minimalist", label: "极简" },
  { id: "premium", label: "高端" },
  { id: "festival", label: "节日" },
] as const;

export const POSTER_PRINT_FORMAT_OPTIONS = [
  { id: "2:3", label: "2:3 — 11×14 / 18×24 / 24×36" },
  { id: "3:4", label: "3:4 — 电影海报" },
  { id: "4:5", label: "4:5 — 画廊 / Etsy 16×20" },
  { id: "1:1", label: "1:1 — 社交媒体" },
  { id: "16:9", label: "16:9 — 横幅" },
  { id: "a-series", label: "A 系列 — 国际印刷" },
] as const;

export const COUNT_OPTIONS = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "4", label: "4" },
] as const;

export const DEBLUR_BLUR_TYPE_OPTIONS = [
  { id: "auto", label: "自动检测" },
  { id: "motion", label: "动态模糊" },
  { id: "defocus", label: "失焦" },
  { id: "lowres", label: "低分辨率/像素化" },
  { id: "noisy", label: "嘈杂/颗粒感强" },
] as const;

export const DEBLUR_STRENGTH_OPTIONS = [
  { id: "light", label: "光" },
  { id: "medium", label: "中等的" },
  { id: "strong", label: "强的" },
  { id: "maximum", label: "最大限度" },
] as const;

export function isSeedreamLiteModel(modelKey: string) {
  return modelKey === "doubao-seedream-5-0-lite";
}

export function maxEditorUploadImages(modelKey: string): number {
  if (modelKey === "qwen-image-edit-max") return 6;
  if (modelKey === "qwen-image-edit") return 3;
  if (modelKey === "wan2.5-i2i-preview") return 3;
  return 1;
}
