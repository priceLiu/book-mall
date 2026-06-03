/**
 * 前端内置提示词（与 book-mall canvas-prompt-templates 保持一致，供默认节点 / 离线兜底）
 */
export const AI_ENGINE_PROMPT_TEMPLATE = `你是一个专业的提示词工程师。我将给你两张图片：
- 图片A：产品主图（展示产品的形状、结构、材质、功能细节）
- 图片B：风格图（展示想要的色彩、光影、质感、氛围、艺术风格）

请根据这两张图片，生成一段完整、具体、风格化的英文提示词。这段提示词将用于最新的图像生成模型（例如 Flux、Midjourney 或 DALL‑E 3）。

要求：
1. 仔细描述产品的**主体**（形态、关键特征、材质、颜色等），尽量保留原有功能性细节。
2. 将风格图中的**色彩方案、光影氛围、质感处理、构图方式、艺术流派或风格关键词**（如极简、赛博朋克、水彩、胶片感、3D渲染等）融合到产品上。
3. 使用专业的英文提示词语法，包含：主体描述 + 风格描述 + 环境/背景 + 光照 + 画质修饰（如 "8k, highly detailed, cinematic lighting"）。
4. 如果风格图涉及背景或环境元素，可以合理地将产品置于类似的环境中。
5. 最终只输出英文提示词，不要添加解释、标点多余符号，开头不要加"Prompt:"之类的字样。

现在开始，请基于你看到的两张图片生成提示词。`;

export const AI_ENGINE_PROMPT_TEMPLATE_V2 = `我将上传两张图片：
- 图1：产品主图（展示产品的形状、结构、材质、颜色等）
- 图2：风格参考图（展示我想要的色彩、光影、氛围、艺术风格、材质感）

请你扮演专业的提示词工程师，将"图1中的产品"按照"图2中的风格"重新设计，生成一段用于AI生图工具（如Flux、Midjourney、DALL‑E 3）的英文提示词。

要求：
1. 提示词必须完整、具体、可执行，直接复制到生图工具里就能生成一张新图片。
2. 内容结构建议：主体描述（保留产品主要特征） + 风格/氛围/色彩/光照（来自风格图） + 环境/背景（合理融合）+ 画质修饰（如"8k, ultra detailed, cinematic"）。
3. 不要添加任何解释、序号、额外说明，只输出最终的英文提示词。
4. 如果风格图中有背景或环境元素，可以让产品融入类似环境；如果风格图是抽象或纹理风格，则把那种质感应用到产品材质和光线中。

开始。`;

export const IMAGE_ENGINE_PROMPT_TEMPLATE_DEFAULT = `Professional e-commerce product poster, hero product centered, clean composition, brand-consistent color palette, soft studio lighting, high-end commercial photography, ultra detailed, 8k, sharp focus, minimal background, space for headline text at top`;

export {
  THREE_VIEW_ENGINE_PROMPT_DEFAULT,
  formatBatchThreeViewPrompt,
  formatCharacterRowThreeViewPrompt,
} from "./three-view-prompt-rules";

/** 三视图引擎可选模型（EnginePicker 白名单） */
export const THREE_VIEW_ENGINE_MODEL_KEYS = [
  "nano-banana-pro",
  "hunyuan-3d-pro",
  "hunyuan-3d-express",
] as const;
