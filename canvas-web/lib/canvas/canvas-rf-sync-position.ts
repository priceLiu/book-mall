/**
 * zustand → RF 合并时的坐标选择：拖动中可保留 RF 位置，但换父后坐标系变了必须用 store。
 */
export function pickStoreToRfPosition(opts: {
  preserveRfPositions: boolean;
  rfParentId?: string;
  storeParentId?: string;
  rfPosition: { x: number; y: number };
  storePosition: { x: number; y: number };
}): { x: number; y: number } {
  if (opts.preserveRfPositions && opts.rfParentId === opts.storeParentId) {
    return opts.rfPosition;
  }
  return opts.storePosition;
}
