/**
 * 画廊类列表的「每次进来换一批顺序」。
 *
 * 用 (seed, id) 推导排序键而非真随机数：同一 seed 下顺序恒定，
 * 滚动翻页、远端数据回填、导入实时追加都不会让已看过的格子跳位。
 */
function orderKey(seed: number, id: string): number {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * seed 为 0 表示尚未洗牌（与服务端渲染顺序一致，避免水合不一致）。
 * `sinkToEnd` 命中的条目整体排在最后，组内仍随机。
 */
export function shuffleByIdForDisplay<T extends { id: string }>(
  items: T[],
  seed: number,
  sinkToEnd?: (item: T) => boolean,
): T[] {
  if (seed === 0 || items.length < 2) return items;
  return items
    .map((item) => ({
      item,
      sink: sinkToEnd?.(item) ? 1 : 0,
      key: orderKey(seed, item.id),
    }))
    .sort((a, b) => (a.sink !== b.sink ? a.sink - b.sink : a.key - b.key))
    .map((x) => x.item);
}
