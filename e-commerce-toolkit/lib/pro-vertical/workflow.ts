/**
 * Pro Vertical 工作流 · 共享入口（实现仍在 fashion-workflow，服装兼容层保留）
 */
export {
  buildFashionReviseDimensionPatch as buildFashionDimensionStepPatch,
  buildFashionProjectKeywords,
  buildFashionSellpointsSavePatch,
  buildFashionStoryboardPanelsSavePatch,
  fashionCharacterMode,
  fashionSheetNeedsScriptResync,
  fashionWorkflowPatchForChoice,
  getFashionWorkflowMeta,
  isAwaitingFashionStoryboardPick,
  isFashionProduceSetupReady,
  isFashionStoryboardPanelsEditable,
  listFashionStoryboardVersionKeys,
  nextFashionSellpointId,
  resolveFashionDeliverable,
  resolveFashionStoryboardPanelsForVersion,
  resolveProVerticalDeliverable,
} from "@/lib/fashion-workflow";

export {
  getProjectVertical,
  isBagsProject,
  isFashionVerticalProject,
  isProVerticalProject,
} from "@/lib/pro-vertical/project-vertical";
