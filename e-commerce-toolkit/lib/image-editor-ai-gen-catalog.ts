export const IMAGE_EDITOR_AI_GEN_PROMPT_MAX = 800;

export const IMAGE_EDITOR_AI_GEN_ASPECTS = [
  { id: "3:4", w: 3, h: 4 },
  { id: "1:1", w: 1, h: 1 },
  { id: "2:3", w: 2, h: 3 },
  { id: "9:16", w: 9, h: 16 },
  { id: "3:2", w: 3, h: 2 },
  { id: "4:3", w: 4, h: 3 },
  { id: "16:9", w: 16, h: 9 },
] as const;

export const IMAGE_EDITOR_AI_GEN_COUNTS = ["1", "2", "3", "4"] as const;

export const IMAGE_EDITOR_AI_GEN_PROMPT_HINTS = [
  "现代客厅，落地窗，远处雪山，午后柔光，极简家具，8K 细节",
  "电商主图，白底产品摄影，柔和顶光，高清材质",
  "赛博朋克街道，霓虹雨夜，电影感构图",
  "中国风庭院，青瓦白墙，樱花飘落，水墨氛围",
] as const;

export const IMAGE_EDITOR_AI_GEN_PROMPT_SNIPPETS = [
  "高清细节",
  "柔和自然光",
  "浅景深",
  "电影级调色",
  "商业摄影",
  "极简构图",
] as const;