/** 与 book-mall aplus-module-catalog 卡片副标题一致（candidate_pool[0]） */
export function detailPageModuleCardSubtitle(candidatePool: string[]): string {
  return candidatePool[0]?.trim() ?? "";
}
