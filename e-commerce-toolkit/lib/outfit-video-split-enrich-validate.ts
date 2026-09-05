/** §十 · 拆镜 enrich 残缺检测（客户端镜像 · 与 book-mall 一致） */

export const OUTFIT_SPLIT_MANUAL_EDIT_HINT = "【AI识别不足，请手动编辑】";

export const OUTFIT_SPLIT_UNRECOGNIZED = {
  camera: "无法识别运镜",
  action: "无法识别模特动作",
  lighting: "无法识别光影信息",
  scene: "无法识别场景信息",
} as const;
