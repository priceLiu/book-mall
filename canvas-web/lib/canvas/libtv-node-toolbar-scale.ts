/**
 * 节点顶栏 zoom 补偿 · 全量补偿（屏幕尺寸恒定，字号不随画布缩放）。
 *
 * 规范（与 dock 线性规范一并固定，见 docs/libtv-node-interaction-spec.md §5.4）：
 * - blend = 1 → 完全补偿：scale = 1 / zoom，顶栏与字号在屏幕上恒定大小。
 * - 画布缩小（zoom<1）：scale 增大，zoom=0.1 → scale 10（封顶）。
 * - 画布 100% 及以上（zoom≥1）：on-screen 维持 1 倍（scale = 1/zoom，到 MIN 为止）。
 */

/** 0 = 随画布 1:1；1 = 完全补偿（屏幕尺寸恒定） */
export const LIBTV_NODE_TOOLBAR_ZOOM_BLEND = 1;

/** 顶栏整体尺度 */
export const LIBTV_NODE_TOOLBAR_SIZE_RATIO = 1;

/** scale 上限（zoom≈0.1 时达到，使 10% 画布下顶栏与 100% 等大） */
export const LIBTV_NODE_TOOLBAR_MAX_SCALE = 10;
/** scale 下限（画布大幅放大时） */
export const LIBTV_NODE_TOOLBAR_MIN_SCALE = 0.4;

/**
 * 节点内顶栏额外 scale（父节点已随画布 zoom 缩放）。
 * 全量补偿：屏幕尺寸恒定；画布缩小时放大（最大 10 倍 → 10% 画布与 100% 等大）。
 */
export function computeLibtvNodeToolbarTransformScale(zoom: number): number {
  const z = Math.max(0.08, Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  const fullComp = 1 / z;
  const blended = 1 + (fullComp - 1) * LIBTV_NODE_TOOLBAR_ZOOM_BLEND;
  const scaled = blended * LIBTV_NODE_TOOLBAR_SIZE_RATIO;
  return Math.min(
    LIBTV_NODE_TOOLBAR_MAX_SCALE,
    Math.max(LIBTV_NODE_TOOLBAR_MIN_SCALE, scaled),
  );
}
