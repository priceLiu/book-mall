/** 前端是否展示 Mock 拆解入口（仅 development 构建） */
export function isMediaDecomposeMockDevUiEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
