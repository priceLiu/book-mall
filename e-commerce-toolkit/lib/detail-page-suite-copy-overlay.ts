/**  re-export：与 book-mall / 画布共用 @private/ecom-copy-overlay */
export type { EcomCopyOverlay as DetailPageSuiteCopyOverlay } from "@private/ecom-copy-overlay";
export type { EcomCopyOverlayLayer as DetailPageSuiteCopyOverlayLayer } from "@private/ecom-copy-overlay";
export {
  defaultCopyOverlay,
  defaultCopyOverlayLayer,
  parseEcomCopyOverlay as parseDetailPageSuiteCopyOverlay,
  resolveOverlayForEditor,
  syncOverlayMainLayerText,
} from "@private/ecom-copy-overlay";
