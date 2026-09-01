/** 前端是否展示专业拉片 Mock 入口（仅 development 构建） */
export function isFilmPullMockDevUiEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
