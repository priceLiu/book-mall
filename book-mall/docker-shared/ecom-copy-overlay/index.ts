export type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";
export { ECOM_COPY_OVERLAY_VERSION } from "./types";
export {
  defaultCopyOverlay,
  defaultCopyOverlayLayer,
  normalizeEcomCopyText,
  parseEcomCopyOverlay,
  resolveEditorCopyText,
  resolveOverlayForEditor,
  syncOverlayMainLayerText,
} from "./defaults";
export {
  EcomCopyOverlayMultiLineText,
  type EcomCopyOverlayMultiLineTextProps,
} from "./copy-textarea";
export {
  ECOM_COPY_FONT_PRESETS,
  normalizeCopyFontPresetId,
  resolveLayerFontCss,
  resolveLayerFontSvg,
  type EcomCopyFontPresetId,
} from "./copy-fonts";
export {
  layerPreviewTextExtras,
  layerPreviewTextShadow,
  layerSvgEffectFilterAttr,
  layerSvgEffectFilterDef,
  layerSvgShadowFilterAttr,
  layerSvgShadowFilterDef,
  layerSvgStrokeAttrs,
  resolveLayerGlow,
  resolveLayerShadow,
  resolveLayerStroke,
  resolveLayerTextBg,
} from "./text-effects";
export {
  addOverlayTextLayer,
  layerListLabel,
  newOverlayLayerId,
  overlayHasAnyCopy,
  patchOverlayLayerText,
  primarySlotCopyFromOverlay,
  removeOverlayLayer,
} from "./layer-ops";
export {
  EcomCopyOverlayLayersEditor,
  type EcomCopyOverlayLayersEditorProps,
} from "./overlay-layers-editor";
export { EcomCopyOverlayCanvas } from "./overlay-canvas";
export type { EcomCopyOverlayCanvasProps } from "./overlay-canvas";
export { EcomCopyOverlayLayerControls } from "./overlay-layer-controls";
export type { EcomCopyImageArtifact } from "./artifact";
export {
  ECOM_COPY_IMAGE_ARTIFACT_SCHEMA,
  createDefaultArtifact,
  parseEcomCopyImageArtifact,
} from "./artifact";
export {
  useEcomCopyOverlayEditorState,
  type UseEcomCopyOverlayEditorStateOpts,
} from "./use-overlay-editor-state";
