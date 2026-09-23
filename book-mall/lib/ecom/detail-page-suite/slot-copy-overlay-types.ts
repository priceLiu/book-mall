/** @deprecated 使用 @private/ecom-copy-overlay；保留别名供详情页套图落库字段名 */
export type {
  EcomCopyOverlay as DetailPageSuiteCopyOverlay,
  EcomCopyOverlayLayer as DetailPageSuiteCopyOverlayLayer,
} from "@private/ecom-copy-overlay";

export {
  ECOM_COPY_OVERLAY_VERSION as DETAIL_PAGE_SUITE_COPY_OVERLAY_VERSION,
  defaultCopyOverlay,
  defaultCopyOverlayLayer,
  parseEcomCopyOverlay as parseDetailPageSuiteCopyOverlay,
  syncOverlayMainLayerText,
} from "@private/ecom-copy-overlay";
