import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";

export type DetailPageSuiteSlotPromptSaveExtras = {
  slotCopy?: string;
  copyOverlay?: EcomCopyOverlay;
  burnCopyInImage?: boolean;
  /** 最近一次「生成预览」的合成图 URL，重进编辑器后可「保存使用」 */
  layoutComposedPreviewUrl?: string | null;
};