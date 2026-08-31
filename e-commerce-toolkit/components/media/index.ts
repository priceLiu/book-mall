/** 电商工具箱 · 媒体预览公共出口（其他模块优先从此 import） */
export { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
export {
  EcomImagePreviewHost,
  useEcomImagePreview,
} from "@/components/media/ecom-image-preview-host";
export type {
  EcomImagePreviewItem,
  EcomImagePreviewOpenState,
} from "@/lib/media/ecom-image-preview";
export {
  buildEcomImagePreviewOpenState,
  buildModelShotPosePreviewItems,
  buildStoryboardPanelPreviewItems,
  findEcomImagePreviewIndex,
  mapPreviewItemsFromEntries,
} from "@/lib/media/ecom-image-preview";
