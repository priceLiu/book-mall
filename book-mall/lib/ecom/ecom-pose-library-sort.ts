import type { EcomPoseLibraryEntry } from "@/lib/ecom/ecom-pose-library-service";

/** 有参考图的姿势条目优先（同 category 内稳定排序） */
export function sortPoseEntriesWithImageFirst(
  entries: EcomPoseLibraryEntry[],
): EcomPoseLibraryEntry[] {
  return [...entries].sort((a, b) => {
    const aHas = Boolean(a.ossUrl?.trim());
    const bHas = Boolean(b.ossUrl?.trim());
    if (aHas !== bHas) return aHas ? -1 : 1;
    const sortA = a.sortOrder ?? 0;
    const sortB = b.sortOrder ?? 0;
    if (sortA !== sortB) return sortA - sortB;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}
