export type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";
export { ECOM_COPY_OVERLAY_VERSION } from "./types";
export {
  defaultCopyOverlay,
  defaultCopyOverlayLayer,
  parseEcomCopyOverlay,
  resolveOverlayForEditor,
  syncOverlayMainLayerText,
} from "./defaults";
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
