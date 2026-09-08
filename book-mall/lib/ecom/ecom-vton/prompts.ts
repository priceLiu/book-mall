/** AI 文生模特 · 默认 Prompt（对齐 model-shot 模特参考） */
export const VTon_DEFAULT_MODEL_GENERATE_PROMPT =
  "全身时尚女模特，自然妆容与发型，中性灰摄影棚背景，电商 lookbook 全身照，柔和均匀光，高清无水印";

/** 头像/半身 → 全身扩图 · 主体模板（摘自穿搭视频文档） */
export const VTon_FULL_BODY_EXPAND_PROMPT_ZH = [
  "商业电商人像摄影，9:16竖版，高清8K，真实相机拍摄。",
  "模特保持正面站立全身人像，严格保留原模特五官脸型、发型，素色简约内衣或基础打底，不要改变人物样貌。",
  "中性灰摄影棚背景，柔和大面积柔光，干净通透，商业服装广告质感，无多余杂物。",
].join("");

export const VTon_FULL_BODY_EXPAND_NEGATIVE_ZH =
  "人脸变形，五官错位，脸部扭曲，肢体畸形，手部崩坏，身体扭转侧对镜头，背影，卡通，手绘，绘画，水印，文字，模糊，多余肢体";

export function buildVtonFullBodyExpandPrompt(userPrompt?: string): string {
  const extra = userPrompt?.trim();
  if (!extra) return VTon_FULL_BODY_EXPAND_PROMPT_ZH;
  return `${VTon_FULL_BODY_EXPAND_PROMPT_ZH}\n${extra}`;
}
