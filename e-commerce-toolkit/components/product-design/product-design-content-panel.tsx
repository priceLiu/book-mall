"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Download, Eye, FileText, Film, ImageIcon, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  analyzeProductDesignReferences,
  createStoryboardFromAssets,
  decomposeProductDesignImagePlan,
  downloadProductDesignExportZip,
  generateProductDesignImages,
  getProductDesignProject,
  saveProductDesignWorkflow,
  syncProductDesign,
  updateProductDesignProject,
} from "@/lib/ecom-product-design-api";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { ProductDesignRefUploader } from "@/components/product-design/product-design-ref-uploader";
import { ProductDesignGenSlotWorkspace } from "@/components/product-design/product-design-gen-slot-workspace";
import { fetchAssetById } from "@/lib/ecom-api";
import type {
  EcomPlatformSpec,
  ProductDesign,
  ProductDesignBrief,
  ProductDesignDetailPage,
  ProductDesignMainImage,
  ProductDesignProject,
  ProductDesignReferenceRole,
} from "@/lib/product-design-types";
import {
  productDesignStepAnchorId,
  PRODUCT_DESIGN_STEPS,
  type ProductDesignStepId,
  type DetailWorkflowPath,
  resolveActiveTrack,
  isStepInTrack,
  defaultMainImageRefPrompt,
  defaultDetailPageRefPrompt,
  appendMainImageSlots,
  PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX,
  isFastDetailPath,
  isFastDetailPromptPath,
  isFastDetailSetupPending,
  isFastMainPath,
  isFastMainPromptPath,
  isReferenceImagePath,
  isFastMainSetupPending,
  MAIN_IMAGE_BATCH_COUNT_CHOICES,
  resolveMainImageBatchCount,
  needsBriefCollection,
  briefComplete,
  shouldSkipBrief,
} from "@/lib/product-design-workflow";
import { buildProductDesignPromptMentionRefs } from "@/lib/product-design-mention-refs";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { getMaxRefsForRoleAtInvokeClient, hasProductRef, PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX } from "@/lib/product-design-ref-rules";
import { ProductDesignGalleryPreviewDialog, type ProductDesignGalleryPreviewItem } from "@/components/product-design/product-design-gallery-preview-dialog";
import { ProductDesignSaveDialog } from "@/components/product-design/product-design-save-dialog";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";
import {
  productDesignCssAspectRatio,
  productDesignRatioFrameClass,
} from "@/lib/product-design-ratio-display";
import { ProductDesignEditableField } from "@/components/product-design/product-design-editable-field";
import { ProductDesignMarketingPlanTable } from "@/components/product-design/product-design-marketing-plan-table";
import {
  marketingPlansLookLikeMisParsedMatrix,
  resolveMarketingPlansForDisplay,
  syncLegacyFieldsFromRows,
} from "@/lib/product-design-marketing-parse";
import { ProductDesignBuyingReasonMatrixTable } from "@/components/product-design/product-design-buying-reason-matrix-table";
import { ProductDesignBriefSummaryPanel } from "@/components/product-design/product-design-brief-summary-panel";
import { ProductDesignMainCopyPanel } from "@/components/product-design/product-design-main-copy-panel";
import { ProductDesignDetailOutlineTable } from "@/components/product-design/product-design-detail-outline-table";
import {
  buildBuyingReasonBriefPatch,
  deriveBuyingReasonsFromBrief,
  hasBuyingReasonBriefContent,
  isStep3ReadyForDownstream,
  isStep3Unlocked,
  isValidStep3Table,
  resolveBuyingReasonForDisplay,
  resolveBuyingReasonTable,
} from "@/lib/product-design-buying-reason-parse";
import {
  resolveDetailOutlineForDisplay,
  resolveMainImagesForDisplay,
  resolveAnalysisForDisplay,
  hasValidAnalysis,
} from "@/lib/product-design-step-sync-parse";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORYBOARD_PROJECT_STORAGE_KEY = "ecom-storyboard-active-project";

/** 中间区各步统一说明：结果定稿面（推进交互在会话区） */
const MIDDLE_WORKSPACE_EDIT_HINT =
  "此处仅展示本步结论，可铅笔编辑保存。点选与「下一步」请在右侧会话区完成。";

/** 电商产品创作 · 宽弹层：宽约 2/3 屏宽，高约 1/2 屏高，内容区可滚动 */
const PRODUCT_DESIGN_WIDE_DIALOG_CLASS =
  "flex h-[min(50dvh,640px)] max-h-[min(90dvh,720px)] w-[min(66.67vw,calc(100vw-2rem))] max-w-none flex-col overflow-hidden";

/** 视觉分析结果 / 生图 Prompt 只读弹层（带内边距） */
const PRODUCT_DESIGN_PROMPT_DIALOG_CLASS = cn(
  PRODUCT_DESIGN_WIDE_DIALOG_CLASS,
  "gap-4",
);

type GenPipelinePurpose = "plan-decompose" | "visual-review" | "generate";

type GenPipeline = {
  target: "main" | "detail";
  indexes?: number[];
  purpose: GenPipelinePurpose;
  step: "vision-model" | "analyzing" | "review" | "image-model";
  draftVisionKey: string;
  draftSummary: string;
  draftPrompt: string;
  decomposeSource?: "reference-decompose" | "reference-intent";
  intentPrompt?: string;
};

type Props = {
  project: ProductDesignProject;
  specs: EcomPlatformSpec[];
  spec: EcomPlatformSpec | null;
  visionModels: StoryboardGatewayModel[];
  visionModelKey: string;
  onVisionModelChange: (key: string) => void;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  onImageModelChange: (key: string) => void;
  onRefUpload: (
    file: File,
    opts: { label: string; role: ProductDesignReferenceRole },
  ) => Promise<void>;
  onRefRemove: (refId: string) => void | Promise<void>;
  onAttachAssets?: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  refBusy?: boolean;
  uploadingRole?: ProductDesignReferenceRole | null;
  uploadProgress?: number | null;
  onNewProject?: () => void | Promise<void>;
  /** 详情页入口：打开「从已有主图项目导入」选择器 */
  onImportFromMainProject?: () => void;
  /** 主图入口：主图出完后引导新建详情页项目并带走策略 */
  onContinueToDetailPages?: () => void;
  onProjectChange: () => void | Promise<void>;
  streaming?: boolean;
  generateMainImagesToken?: number;
  generateDetailImagesToken?: number;
  onBriefComplete?: () => void;
  onChooseDetailWorkflow?: (mode: DetailWorkflowPath) => void;
  onRegenerateMarketingPlans?: () => void;
  focusStepId?: ProductDesignStepId | null;
  /** 模型列表仍在拉取（打开选模弹层前预加载） */
  modelsLoading?: boolean;
  /** 模型拉取失败时的说明 */
  modelsLoadError?: string | null;
  onRefreshModels?: () => void | Promise<void>;
};

function productDesignImagePickerCopy(
  target: "main" | "detail",
  indexes: number[] | undefined,
  ratioLabel: string,
): { title: string; description: string; footerHint: string } {
  const count = indexes?.length ?? 0;
  const single = count === 1;
  if (target === "main") {
    return {
      title: single ? "生成产品主图" : "生成全部的产品主图",
      description: single
        ? `选择生图模型；输出比例 ${ratioLabel} 由平台规则决定。`
        : `选择生图模型并批量出主图；输出比例 ${ratioLabel} 由平台规则决定。`,
      footerHint: "选好模型后开始出图。",
    };
  }
  return {
    title: single ? "生成详情屏" : "生成全部的详情屏",
    description: single
      ? `选择生图模型；输出比例 ${ratioLabel} 由平台规则决定。`
      : `选择生图模型并批量出详情屏；输出比例 ${ratioLabel} 由平台规则决定。`,
    footerHint: "选好模型后开始出图。",
  };
}

export function ProductDesignContentPanel({
  project,
  specs,
  spec,
  visionModels,
  visionModelKey,
  onVisionModelChange,
  imageModels,
  imageModelKey,
  onImageModelChange,
  onRefUpload,
  onRefRemove,
  onAttachAssets,
  refBusy,
  uploadingRole = null,
  uploadProgress = null,
  onNewProject,
  onImportFromMainProject,
  onContinueToDetailPages,
  onProjectChange,
  streaming,
  generateMainImagesToken = 0,
  generateDetailImagesToken = 0,
  onBriefComplete,
  onChooseDetailWorkflow,
  onRegenerateMarketingPlans,
  focusStepId = null,
  modelsLoading = false,
  modelsLoadError = null,
  onRefreshModels,
}: Props) {
  const router = useRouter();
  const { alert, confirm } = useDialogs();
  const design = project.design;
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const activeTrack = resolveActiveTrack(project);

  const [busy, setBusy] = useState<string | null>(null);
  const [imagePickerSubmitting, setImagePickerSubmitting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [genPipeline, setGenPipeline] = useState<GenPipeline | null>(null);

  const imagePickerCopy = useMemo(() => {
    if (!genPipeline || genPipeline.step !== "image-model") return null;
    const ratio =
      genPipeline.target === "detail"
        ? project.resolved.detailPageRatio
        : project.resolved.mainImageRatio;
    return productDesignImagePickerCopy(genPipeline.target, genPipeline.indexes, ratio);
  }, [genPipeline, project.resolved.detailPageRatio, project.resolved.mainImageRatio]);

  useEffect(() => {
    if (genPipeline?.step !== "image-model") return;
    if (imageModels.length > 0 || modelsLoading) return;
    void onRefreshModels?.();
  }, [genPipeline?.step, imageModels.length, modelsLoading, onRefreshModels]);

  useEffect(() => {
    if (genPipeline?.step !== "image-model") setImagePickerSubmitting(false);
  }, [genPipeline?.step]);
  const [generatingTarget, setGeneratingTarget] = useState<{
    target: "main" | "detail";
    indexes?: number[];
  } | null>(null);
  const [mainGenMode, setMainGenMode] = useState<
    "copy" | "reference-decompose" | "reference-prompt" | "reference"
  >(
    project.settings.mainImageGenMode ?? "copy",
  );
  const [mainCustomPrompt, setMainCustomPrompt] = useState(
    project.settings.mainImageCustomPrompt ?? "",
  );
  const [detailCustomPrompt, setDetailCustomPrompt] = useState(
    project.settings.detailPageCustomPrompt ?? "",
  );
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMainGenMode(project.settings.mainImageGenMode ?? "copy");
    setMainCustomPrompt(project.settings.mainImageCustomPrompt ?? "");
    setDetailCustomPrompt(project.settings.detailPageCustomPrompt ?? "");
  }, [project.id, project.settings.mainImageGenMode, project.settings.mainImageCustomPrompt, project.settings.detailPageCustomPrompt]);

  useEffect(
    () => () => {
      if (genPollRef.current) clearInterval(genPollRef.current);
    },
    [],
  );

  const stopGenPoll = useCallback(() => {
    if (genPollRef.current) {
      clearInterval(genPollRef.current);
      genPollRef.current = null;
    }
  }, []);

  const startGenPoll = useCallback(
    (target: "main" | "detail", indexes?: number[]) => {
      stopGenPoll();
      genPollRef.current = setInterval(() => {
        void getProductDesignProject(project.id)
          .then((refreshed) => {
            void onProjectChange();
            const items =
              target === "main"
                ? refreshed.design?.mainImages
                : refreshed.design?.detailPages;
            if (!items?.length) return;
            const pending = (indexes?.length ? indexes : items.map((i) => i.index)).filter(
              (idx) => !items.find((i) => i.index === idx)?.imageUrl,
            );
            if (pending.length === 0) stopGenPoll();
          })
          .catch(() => undefined);
      }, 2500);
    },
    [onProjectChange, project.id, stopGenPoll],
  );

  const [draftVisionKey, setDraftVisionKey] = useState(visionModelKey);
  const [draftModelKey, setDraftModelKey] = useState(imageModelKey);
  const [mainGenBatchCount, setMainGenBatchCount] = useState(() =>
    resolveMainImageBatchCount(project.settings.mainImageCount),
  );
  const [galleryPreview, setGalleryPreview] = useState<{
    items: ProductDesignGalleryPreviewItem[];
    initialIndex: number;
  } | null>(null);
  const [promptPreview, setPromptPreview] = useState<{
    title: string;
    prompt: string;
  } | null>(null);

  useEffect(() => setDraftVisionKey(visionModelKey), [visionModelKey]);
  useEffect(() => setDraftModelKey(imageModelKey), [imageModelKey]);
  useEffect(() => {
    setMainGenBatchCount(resolveMainImageBatchCount(project.settings.mainImageCount));
  }, [project.id, project.settings.mainImageCount]);

  useEffect(() => {
    if (!focusStepId) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const order = PRODUCT_DESIGN_STEPS.map((s) => s.id);
    const start = order.indexOf(focusStepId);
    let target: HTMLElement | null = null;
    for (let i = start; i >= 0; i--) {
      const el = root.querySelector<HTMLElement>(
        `#${productDesignStepAnchorId(order[i]!)}`,
      );
      if (el) {
        target = el;
        break;
      }
    }
    target ??= root.querySelector<HTMLElement>("#pdt-step-top");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusStepId, design]);

  const patchDesign = useCallback(
    async (designPatch: Partial<ProductDesign>) => {
      await updateProductDesignProject(project.id, { designPatch });
      await onProjectChange();
    },
    [project.id, onProjectChange],
  );

  const patchBrief = useCallback(
    async (briefPatch: Partial<ProductDesignBrief>) => {
      const nextBrief = { ...(project.brief ?? {}), ...briefPatch };
      await updateProductDesignProject(project.id, {
        brief: nextBrief,
      });
      await onProjectChange();
      if (
        briefComplete(nextBrief) &&
        !shouldSkipBrief(project) &&
        !hasValidAnalysis(resolveAnalysisForDisplay(project))
      ) {
        onBriefComplete?.();
      }
    },
    [onBriefComplete, onProjectChange, project],
  );

  const marketingPlansDisplay = useMemo(
    () => resolveMarketingPlansForDisplay(project),
    [project],
  );

  const marketingPlansSyncKeyRef = useRef("");
  useEffect(() => {
    if (marketingPlansDisplay.length === 0) return;
    const storedMisparse = marketingPlansLookLikeMisParsedMatrix(
      project.design?.marketingPlans ?? [],
    );
    if (project.design?.selectedPlanNo != null && !storedMisparse) return;
    const nextKey = JSON.stringify(marketingPlansDisplay);
    if (marketingPlansSyncKeyRef.current === nextKey) return;
    const storedKey = JSON.stringify(project.design?.marketingPlans ?? []);
    if (storedKey === nextKey) {
      marketingPlansSyncKeyRef.current = nextKey;
      return;
    }
    marketingPlansSyncKeyRef.current = nextKey;
    void patchDesign({ marketingPlans: marketingPlansDisplay });
  }, [marketingPlansDisplay, patchDesign, project.design?.marketingPlans, project.design?.selectedPlanNo]);

  const buyingReasonDisplay = useMemo(
    () => resolveBuyingReasonForDisplay(project),
    [project],
  );

  const buyingReasonSyncKeyRef = useRef("");
  useEffect(() => {
    if (!isStep3Unlocked(project)) return;
    if (!buyingReasonDisplay.hasContent) return;
    if (project.design?.buyingReasonBrief?.userEdited) return;
    const nextKey = JSON.stringify({
      brief: buyingReasonDisplay.brief,
      reasons: buyingReasonDisplay.reasons,
    });
    if (buyingReasonSyncKeyRef.current === nextKey) return;
    const storedKey = JSON.stringify({
      brief: project.design?.buyingReasonBrief ?? null,
      reasons: project.design?.buyingReasons ?? [],
    });
    if (storedKey === nextKey) {
      buyingReasonSyncKeyRef.current = nextKey;
      return;
    }
    buyingReasonSyncKeyRef.current = nextKey;
    const reasons =
      buyingReasonDisplay.reasons.length > 0
        ? buyingReasonDisplay.reasons
        : deriveBuyingReasonsFromBrief(buyingReasonDisplay.brief);
    void patchDesign({
      buyingReasonBrief: buyingReasonDisplay.brief ?? undefined,
      buyingReasons: reasons,
    });
  }, [
    buyingReasonDisplay,
    patchDesign,
    project,
    project.design?.buyingReasonBrief,
    project.design?.buyingReasons,
    project.design?.selectedPlanNo,
    project.chatHistory,
  ]);

  const mainImagesDisplay = useMemo(
    () => resolveMainImagesForDisplay(project),
    [project],
  );

  const detailOutlineDisplay = useMemo(
    () => resolveDetailOutlineForDisplay(project),
    [project],
  );

  const analysisDisplay = useMemo(
    () => resolveAnalysisForDisplay(project),
    [project],
  );

  const analysisSyncKeyRef = useRef("");
  useEffect(() => {
    if (!analysisDisplay) return;
    const nextKey = JSON.stringify(analysisDisplay);
    if (analysisSyncKeyRef.current === nextKey) return;
    const storedKey = JSON.stringify(project.design?.analysis ?? null);
    if (storedKey === nextKey) {
      analysisSyncKeyRef.current = nextKey;
      return;
    }
    analysisSyncKeyRef.current = nextKey;
    void patchDesign({ analysis: analysisDisplay });
  }, [analysisDisplay, patchDesign, project.design?.analysis]);

  const saveMainImageItem = useCallback(
    async (
      index: number,
      updater: (prev: ProductDesignMainImage) => ProductDesignMainImage,
    ) => {
      const base =
        (design?.mainImages?.length ?? 0) > 0
          ? [...design!.mainImages]
          : [...mainImagesDisplay];
      const pos = base.findIndex((m) => m.index === index);
      const prev =
        pos >= 0 ? base[pos]! : mainImagesDisplay.find((m) => m.index === index);
      if (!prev) return;
      const updated = updater(prev);
      if (pos >= 0) base[pos] = updated;
      else base.push(updated);
      base.sort((a, b) => a.index - b.index);
      await patchDesign({ mainImages: base });
    },
    [design, mainImagesDisplay, patchDesign],
  );

  const mainImagesSyncKeyRef = useRef("");
  useEffect(() => {
    if (!isStep3ReadyForDownstream(project)) return;
    if (mainImagesDisplay.length === 0) return;
    const nextKey = JSON.stringify(
      mainImagesDisplay.map((m) => ({
        index: m.index,
        purpose: m.purpose,
        layers: m.layers,
        emphasis: m.emphasis,
      })),
    );
    if (mainImagesSyncKeyRef.current === nextKey) return;
    const storedKey = JSON.stringify(
      (project.design?.mainImages ?? []).map((m) => ({
        index: m.index,
        purpose: m.purpose,
        layers: m.layers,
        emphasis: m.emphasis,
      })),
    );
    if (storedKey === nextKey) {
      mainImagesSyncKeyRef.current = nextKey;
      return;
    }
    mainImagesSyncKeyRef.current = nextKey;
    void patchDesign({ mainImages: mainImagesDisplay });
  }, [mainImagesDisplay, patchDesign, project, project.design?.mainImages]);

  const detailOutlineSyncKeyRef = useRef("");
  useEffect(() => {
    if (!isStep3ReadyForDownstream(project)) return;
    if (mainImagesDisplay.length === 0 && (project.design?.mainImages?.length ?? 0) === 0) return;
    if (detailOutlineDisplay.length === 0) return;
    const nextKey = JSON.stringify(detailOutlineDisplay);
    if (detailOutlineSyncKeyRef.current === nextKey) return;
    const storedKey = JSON.stringify(project.design?.detailOutline ?? []);
    if (storedKey === nextKey) {
      detailOutlineSyncKeyRef.current = nextKey;
      return;
    }
    detailOutlineSyncKeyRef.current = nextKey;
    void patchDesign({ detailOutline: detailOutlineDisplay });
  }, [
    detailOutlineDisplay,
    mainImagesDisplay.length,
    patchDesign,
    project.design?.detailOutline,
    project.design?.selectedPlanNo,
  ]);

  const staleDownstreamClearedRef = useRef(false);
  const prematureStep3ClearedRef = useRef(false);
  useEffect(() => {
    const d = project.design;
    if (!d) return;

    // 快速分支（参考图 + 自定义 Prompt）本就跳过 Step2 选方案，
    // selectedPlanNo 恒为空，不能据此判定下游内容是解析残留
    const planExpected = !isFastMainPath(project) && !isFastDetailPath(project);

    if (planExpected && d.selectedPlanNo == null) {
      prematureStep3ClearedRef.current = false;
      // 已出图的槽位一律保留：出图消耗过额度，不能当作脏数据抹掉
      const hasGenerated =
        (d.mainImages ?? []).some((m) => m.imageUrl) ||
        (d.detailPages ?? []).some((p) => p.imageUrl);
      const hasStale =
        Boolean(d.buyingReasonBrief) ||
        (d.buyingReasons?.length ?? 0) > 0 ||
        (d.detailOutline?.length ?? 0) > 0 ||
        (!hasGenerated &&
          ((d.mainImages?.length ?? 0) > 0 || (d.detailPages?.length ?? 0) > 0));
      if (!hasStale || staleDownstreamClearedRef.current) return;
      staleDownstreamClearedRef.current = true;
      void patchDesign({
        buyingReasonBrief: undefined,
        buyingReasons: [],
        detailOutline: [],
        ...(hasGenerated ? {} : { mainImages: [], detailPages: [] }),
      });
      return;
    }

    staleDownstreamClearedRef.current = false;

    const invalidBrief =
      d.buyingReasonBrief &&
      !isValidStep3Table(resolveBuyingReasonTable(d.buyingReasonBrief));
    if (invalidBrief && !prematureStep3ClearedRef.current) {
      prematureStep3ClearedRef.current = true;
      void patchDesign({
        buyingReasonBrief: undefined,
        buyingReasons: [],
      });
    }
  }, [
    patchDesign,
    project,
    project.design,
    project.design?.buyingReasonBrief,
    project.design?.buyingReasons,
    project.design?.detailOutline,
    project.design?.detailPages,
    project.design?.mainImages,
    project.design?.selectedPlanNo,
    project.chatHistory,
  ]);

  const saveMainGenSettings = useCallback(
    async (mode: "copy" | "reference-decompose" | "reference-prompt" | "reference", customPrompt: string) => {
      await updateProductDesignProject(project.id, {
        settings: {
          mainImageGenMode: mode,
          mainImageCustomPrompt: customPrompt.trim() || undefined,
        },
      });
      await onProjectChange();
    },
    [project.id, onProjectChange],
  );

  const runGenerate = useCallback(
    async (target: "main" | "detail", indexes?: number[], modelKey?: string) => {
      const label = target === "main" ? "主图" : "详情屏";
      const items = target === "main" ? design?.mainImages : design?.detailPages;
      if (!items?.length) return;

      const wantedIndexes =
        indexes && indexes.length > 0
          ? indexes
          : items.filter((i) => !i.imageUrl).map((i) => i.index);
      if (wantedIndexes.length === 0) return;

      const mk = modelKey ?? imageModelKey;
      const ratio =
        target === "main"
          ? project.resolved.mainImageRatio
          : project.resolved.detailPageRatio;

      const countBefore = items.filter((i) =>
        wantedIndexes.includes(i.index) ? Boolean(i.imageUrl) : false,
      ).length;

      setGeneratingTarget({ target, indexes: wantedIndexes });
      setBusy(
        wantedIndexes.length === 1
          ? `${label}第 ${wantedIndexes[0]} 张生成中`
          : `${label}生成中（0/${wantedIndexes.length}）`,
      );
      startGenPoll(target, wantedIndexes);

      const failures: Array<{ index: number; message: string }> = [];
      let generated = 0;
      try {
        const result = await generateProductDesignImages(project.id, {
          target,
          indexes: wantedIndexes,
          modelKey: mk,
          ratio,
        });
        generated = result.generated;
        failures.push(...result.failures);
      } catch (e) {
        for (const index of wantedIndexes) {
          failures.push({
            index,
            message: e instanceof Error ? e.message : "生成失败",
          });
        }
      } finally {
        stopGenPoll();
        await onProjectChange();
      }

      const refreshed = await getProductDesignProject(project.id);
      const afterItems =
        target === "main"
          ? refreshed.design?.mainImages ?? []
          : refreshed.design?.detailPages ?? [];
      const newlyDone = wantedIndexes.filter((idx) =>
        Boolean(afterItems.find((i) => i.index === idx)?.imageUrl),
      ).length;

      if (failures.length > 0) {
        if (newlyDone > countBefore) {
          await alert({
            title: `${newlyDone - countBefore} 张已生成，${failures.length} 张失败`,
            message: failures.map((f) => `第 ${f.index} 张：${f.message}`).join("\n"),
            variant: "error",
          });
        } else {
          await alert({
            title: `${label}生成失败`,
            message: failures.map((f) => `第 ${f.index} 张：${f.message}`).join("\n"),
            variant: "error",
          });
        }
      } else if (target === "main") {
        const mains = afterItems;
        if (mains.length > 0 && mains.every((m) => m.imageUrl)) {
          await alert({
            title: "主图生成完成",
            message: "全部主图已生成。请在中间工作区选择详情页制作方式，继续详情页流程。",
          });
        }
      }

      setBusy(null);
      setGeneratingTarget(null);
    },
    [
      design?.mainImages,
      design?.detailPages,
      project.id,
      project.resolved,
      imageModelKey,
      onProjectChange,
      alert,
      startGenPoll,
      stopGenPoll,
    ],
  );

  const cardGeneratingFor = useCallback(
    (target: "main" | "detail", index: number) => {
      if (!generatingTarget || generatingTarget.target !== target) return false;
      if (!generatingTarget.indexes?.length) return true;
      return generatingTarget.indexes.includes(index);
    },
    [generatingTarget],
  );

  const openMainSlotPreview = useCallback(
    (index: number) => {
      if (!design) return;
      const item = design.mainImages.find((m) => m.index === index);
      if (!item?.imageUrl) return;
      const items: ProductDesignGalleryPreviewItem[] = design.mainImages
        .filter((m) => m.imageUrl)
        .map((m) => ({
          url: m.imageUrl!,
          title: `主图 ${m.index} · ${m.layers.title}`,
          ratio: project.resolved.mainImageRatio,
          downloadFilename: `主图-${m.index}-${m.layers.title.slice(0, 12)}.png`,
        }));
      const initialIndex = items.findIndex((g) => g.url === item.imageUrl);
      setGalleryPreview({
        items,
        initialIndex: initialIndex >= 0 ? initialIndex : 0,
      });
    },
    [design, project.resolved.mainImageRatio],
  );

  const openDetailSlotPreview = useCallback(
    (index: number) => {
      if (!design) return;
      const item = design.detailPages.find((d) => d.index === index);
      if (!item?.imageUrl) return;
      const items: ProductDesignGalleryPreviewItem[] = design.detailPages
        .filter((d) => d.imageUrl)
        .map((d) => ({
          url: d.imageUrl!,
          title: `第 ${d.index} 屏 · ${d.title}`,
          ratio: project.resolved.detailPageRatio,
          downloadFilename: `详情-${d.index}-${d.title.slice(0, 12)}.png`,
        }));
      const initialIndex = items.findIndex((g) => g.url === item.imageUrl);
      setGalleryPreview({
        items,
        initialIndex: initialIndex >= 0 ? initialIndex : 0,
      });
    },
    [design, project.resolved.detailPageRatio],
  );

  const startGeneratePipeline = useCallback(
    async (target: "main" | "detail", indexes?: number[]) => {
      if (
        target === "main" &&
        mainGenMode === "reference-prompt" &&
        mainCustomPrompt.trim()
      ) {
        await saveMainGenSettings(mainGenMode, mainCustomPrompt);
      }
      if (
        target === "detail" &&
        project.settings.detailPageGenMode === "reference-prompt" &&
        detailCustomPrompt.trim()
      ) {
        await updateProductDesignProject(project.id, {
          settings: { detailPageCustomPrompt: detailCustomPrompt.trim() },
        });
      }
      setGenPipeline({
        target,
        indexes,
        purpose: "generate",
        step: "image-model",
        draftVisionKey: visionModelKey,
        draftSummary: "",
        draftPrompt: "",
      });
    },
    [
      mainGenMode,
      mainCustomPrompt,
      saveMainGenSettings,
      visionModelKey,
      detailCustomPrompt,
      project.settings.detailPageGenMode,
    ],
  );

  const startAnalyzeForPlan = useCallback(
    async (opts: {
      target: "main" | "detail";
      decomposeSource: "reference-decompose" | "reference-intent";
      intentPrompt?: string;
    }) => {
      if (opts.target === "main" && isFastMainPromptPath(project) && mainCustomPrompt.trim()) {
        await saveMainGenSettings("reference-prompt", mainCustomPrompt);
      }
      if (
        opts.target === "detail" &&
        isFastDetailPromptPath(project) &&
        detailCustomPrompt.trim()
      ) {
        await updateProductDesignProject(project.id, {
          settings: { detailPageCustomPrompt: detailCustomPrompt.trim() },
        });
      }
      setGenPipeline({
        target: opts.target,
        purpose: "plan-decompose",
        step: "vision-model",
        draftVisionKey: visionModelKey,
        draftSummary: "",
        draftPrompt: "",
        decomposeSource: opts.decomposeSource,
        intentPrompt: opts.intentPrompt?.trim() || undefined,
      });
    },
    [
      project,
      mainCustomPrompt,
      detailCustomPrompt,
      saveMainGenSettings,
      visionModelKey,
    ],
  );

  const runPlanDecompose = useCallback(
    async (pipeline: GenPipeline) => {
      const label = pipeline.target === "main" ? "主图" : "详情页";
      setBusy(`正在分析${label}参考并拆解 Prompt…`);
      setGenPipeline({ ...pipeline, step: "analyzing" });
      try {
        onVisionModelChange(pipeline.draftVisionKey);
        await decomposeProductDesignImagePlan(project.id, {
          target: pipeline.target,
          modelKey: pipeline.draftVisionKey,
          intentPrompt: pipeline.intentPrompt,
          source: pipeline.decomposeSource,
        });
        await onProjectChange();
        setGenPipeline(null);
      } catch (e) {
        await alert({
          title: "分析拆解失败",
          message: e instanceof Error ? e.message : "未知错误",
          variant: "error",
        });
        setGenPipeline(null);
      } finally {
        setBusy(null);
      }
    },
    [project.id, onVisionModelChange, onProjectChange, alert],
  );

  const runVisionAnalyze = useCallback(
    async (pipeline: GenPipeline) => {
      const label = pipeline.target === "main" ? "主图" : "详情屏";
      setBusy(`正在用视觉模型分析${label}参考图…`);
      setGenPipeline({ ...pipeline, step: "analyzing" });
      try {
        onVisionModelChange(pipeline.draftVisionKey);
        const result = await analyzeProductDesignReferences(project.id, {
          target: pipeline.target,
          modelKey: pipeline.draftVisionKey,
          analysisMode:
            (pipeline.target === "main" && mainGenMode === "reference-prompt") ||
            (pipeline.target === "detail" &&
              project.settings.detailPageGenMode === "reference-prompt")
              ? "reference-style"
              : "copy",
        });
        await onProjectChange();
        setGenPipeline({
          ...pipeline,
          step: "review",
          draftSummary: result.entry.summary,
          draftPrompt: result.entry.derivedPrompt,
        });
      } catch (e) {
        await alert({
          title: "视觉分析失败",
          message: e instanceof Error ? e.message : "未知错误",
          variant: "error",
        });
        setGenPipeline(null);
      } finally {
        setBusy(null);
      }
    },
    [project.id, onVisionModelChange, onProjectChange, alert, mainGenMode, project.settings.detailPageGenMode],
  );

  const confirmVisualReview = useCallback(
    async (pipeline: GenPipeline) => {
      const briefKey = pipeline.target;
      const prev = design?.visualBrief?.[briefKey];
      await patchDesign({
        visualBrief: {
          ...(design?.visualBrief ?? {}),
          [briefKey]: {
            summary: pipeline.draftSummary,
            derivedPrompt: pipeline.draftPrompt,
            modelKey: pipeline.draftVisionKey,
            analyzedAt: prev?.analyzedAt ?? new Date().toISOString(),
            refFingerprint: prev?.refFingerprint,
            productTraits: prev?.productTraits,
            styleTraits: prev?.styleTraits,
          },
        },
      });
      setGenPipeline({ ...pipeline, step: "image-model" });
    },
    [design?.visualBrief, patchDesign],
  );

  const requestMainGenerate = useCallback(
    async (indexes: number[]) => {
      if (!design || indexes.length <= 0) return;

      const ok = await confirm({
        title: `生成 ${indexes.length} 张主图`,
        message: `将出图 ${indexes.length} 张主图，预计需要几分钟。是否继续？`,
      });
      if (!ok) return;

      void startGeneratePipeline("main", indexes);
    },
    [design, confirm, startGeneratePipeline],
  );

  const requestDetailGenerate = useCallback(
    async (indexes: number[]) => {
      const items = design?.detailPages;
      if (!items?.length || indexes.length === 0) {
        await alert({
          title: "无法生成",
          message: "还没有详情屏条目。",
          variant: "error",
        });
        return;
      }
      const ok = await confirm({
        title: `生成 ${indexes.length} 张详情屏`,
        message: `将出图 ${indexes.length} 张详情屏，预计需要几分钟。是否继续？`,
      });
      if (!ok) return;
      void startGeneratePipeline("detail", indexes);
    },
    [design?.detailPages, alert, confirm, startGeneratePipeline],
  );

  // 助手侧点「生成全部主图 / 详情屏」时通过递增 token 触发
  const mainTokenRef = useRef(generateMainImagesToken);
  const detailTokenRef = useRef(generateDetailImagesToken);
  useEffect(() => {
    if (generateMainImagesToken === mainTokenRef.current) return;
    mainTokenRef.current = generateMainImagesToken;
    const indexes =
      design?.mainImages
        .filter((m) => !m.imageUrl)
        .slice(0, mainGenBatchCount)
        .map((m) => m.index) ??
      [];
    if (indexes.length === 0 && design?.mainImages.length) {
      void requestMainGenerate(
        design.mainImages.slice(0, mainGenBatchCount).map((m) => m.index),
      );
    } else if (indexes.length > 0) {
      void requestMainGenerate(indexes);
    }
  }, [generateMainImagesToken, requestMainGenerate, mainGenBatchCount, design?.mainImages]);
  useEffect(() => {
    if (generateDetailImagesToken === detailTokenRef.current) return;
    detailTokenRef.current = generateDetailImagesToken;
    const items = design?.detailPages ?? [];
    const pending = items.filter((i) => !i.imageUrl);
    const indexes =
      pending.length > 0 ? pending.map((i) => i.index) : items.map((i) => i.index);
    if (indexes.length > 0) void requestDetailGenerate(indexes);
  }, [generateDetailImagesToken, requestDetailGenerate, design?.detailPages]);

  const allMainImagesDone =
    Boolean(design?.mainImages.length) &&
    design!.mainImages.every((m) => m.imageUrl);

  const mainImageDoneCount =
    design?.mainImages.filter((m) => m.imageUrl).length ?? 0;
  const mainImageTotal = design?.mainImages.length ?? 0;
  const mainPendingCount =
    design?.mainImages.filter((m) => !m.imageUrl).length ?? 0;
  const mainNeedAppend = Math.max(0, mainGenBatchCount - mainPendingCount);
  const mainGenerateBlocked =
    mainImageTotal + mainNeedAppend > PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX;

  const mainTrack = activeTrack === "main";
  const detailTrack = activeTrack === "detail";
  const mainImagesAllGenerated = mainImageTotal > 0 && mainPendingCount === 0;

  const showReferenceMainPlan =
    mainTrack && isReferenceImagePath(project) && Boolean(project.meta?.platformConfirmed);

  const showDetailPlanWorkspace =
    detailTrack && isFastDetailPath(project) && Boolean(project.meta?.detailWorkflowPath);

  const showFastMainSetup = mainTrack && isFastMainSetupPending(project);
  const showFastDetailSetup = detailTrack && isFastDetailSetupPending(project);
  const showBriefSetup = needsBriefCollection(project);

  const fastMainSpec =
    specs.find((s) => s.code === project.platform) ??
    spec ??
    specs[0] ??
    null;

  const confirmFastMainSetup = useCallback(async () => {
    if (!fastMainSpec) {
      await alert({
        title: "请先选择平台",
        message: "快速主图需先选定上架平台。",
        variant: "error",
      });
      return;
    }
    const detailCount =
      project.settings.detailPageCount ?? fastMainSpec.detailPage.recommended;
    const prompt =
      mainCustomPrompt.trim() ||
      defaultMainImageRefPrompt({
        ...project,
        platform: fastMainSpec.code,
        settings: {
          ...project.settings,
          mainImageGenMode: "reference-prompt",
        },
      });
    setBusy("正在初始化…");
    try {
      await updateProductDesignProject(project.id, {
        platform: fastMainSpec.code,
        settings: {
          detailPageCount: detailCount,
          mainImageGenMode: "reference-prompt",
          ...(prompt ? { mainImageCustomPrompt: prompt } : {}),
          mainImageRatio: fastMainSpec.mainImage.ratio,
          detailPageRatio: fastMainSpec.detailPage.ratio,
        },
        meta: {
          mainWorkflowPath: "prompt",
          platformConfirmed: true,
          countsConfirmed: true,
          setupPhase: "done",
          briefSkipped: true,
        },
      });
      setMainGenMode("reference-prompt");
      if (prompt) setMainCustomPrompt(prompt);
      await onProjectChange();
    } finally {
      setBusy(null);
    }
  }, [alert, fastMainSpec, mainCustomPrompt, onProjectChange, project]);

  const confirmFastDetailSetup = useCallback(async () => {
    const detailSpec = spec ?? specs[0];
    if (!detailSpec) return;
    const prompt =
      detailCustomPrompt.trim() ||
      defaultDetailPageRefPrompt({
        ...project,
        settings: {
          ...project.settings,
          detailPageGenMode: "reference-prompt",
        },
      });
    setBusy("正在初始化…");
    try {
      await updateProductDesignProject(project.id, {
        settings: {
          detailPageGenMode: "reference-prompt",
          detailPageCustomPrompt: prompt,
          detailPageRatio: detailSpec.detailPage.ratio,
        },
        meta: {
          detailWorkflowPath: "prompt",
        },
      });
      setDetailCustomPrompt(prompt);
      await onProjectChange();
    } finally {
      setBusy(null);
    }
  }, [spec, specs, detailCustomPrompt, onProjectChange, project]);

  const requestMainPlanAnalyze = useCallback(async () => {
    if (!project.meta?.platformConfirmed) {
      await confirmFastMainSetup();
    }
    await startAnalyzeForPlan({
      target: "main",
      decomposeSource: mainCustomPrompt.trim() ? "reference-intent" : "reference-decompose",
      intentPrompt: mainCustomPrompt.trim() || undefined,
    });
  }, [
    project,
    confirmFastMainSetup,
    startAnalyzeForPlan,
    mainCustomPrompt,
  ]);

  const requestDetailPlanAnalyze = useCallback(async () => {
    if (!project.meta?.detailWorkflowPath && isFastDetailPromptPath(project)) {
      await confirmFastDetailSetup();
    }
    await startAnalyzeForPlan({
      target: "detail",
      decomposeSource: detailCustomPrompt.trim() ? "reference-intent" : "reference-decompose",
      intentPrompt: detailCustomPrompt.trim() || undefined,
    });
  }, [
    project,
    confirmFastDetailSetup,
    startAnalyzeForPlan,
    detailCustomPrompt,
  ]);

  const handleFastMainAnalyze = useCallback(async () => {
    if (!project.platform && !fastMainSpec) {
      await alert({
        title: "请先选择平台",
        message: "请先选定上架平台后再分析。",
        variant: "error",
      });
      return;
    }
    await requestMainPlanAnalyze();
  }, [project.platform, fastMainSpec, alert, requestMainPlanAnalyze]);

  const handleFastDetailAnalyze = useCallback(async () => {
    await requestDetailPlanAnalyze();
  }, [requestDetailPlanAnalyze]);

  const selectFastMainPlatform = useCallback(
    async (nextSpec: EcomPlatformSpec) => {
      const recommended = nextSpec.mainImage.recommended;
      await updateProductDesignProject(project.id, {
        platform: nextSpec.code,
        settings: {
          mainImageCount: recommended,
          detailPageCount: nextSpec.detailPage.recommended,
          mainImageRatio: nextSpec.mainImage.ratio,
          detailPageRatio: nextSpec.detailPage.ratio,
        },
      });
      await onProjectChange();
    },
    [onProjectChange, project.id],
  );

  const promptMentionRefs = useMemo(
    () => buildProductDesignPromptMentionRefs(project, "main"),
    [project.references],
  );
  const detailPromptMentionRefs = useMemo(
    () => buildProductDesignPromptMentionRefs(project, "detail"),
    [project.references],
  );

  const visionInvokeMax = getMaxRefsForRoleAtInvokeClient("main-style", {
    visionModelKey,
    imageModelKey,
  });

  async function handleViewGenPrompt(opts: {
    title: string;
    genPrompt?: string;
    assetId?: string;
  }) {
    let prompt = opts.genPrompt?.trim();
    if (!prompt && opts.assetId) {
      setBusy("正在读取生图 Prompt…");
      try {
        const asset = await fetchAssetById(opts.assetId);
        prompt = asset?.prompt?.trim() ?? "";
      } catch {
        prompt = "";
      } finally {
        setBusy(null);
      }
    }
    if (!prompt) {
      await alert({
        title: "暂无 Prompt",
        message:
          "该图生成于 Prompt 记录功能上线之前。请点「重新生成」后可在此查看完整生图 Prompt。",
      });
      return;
    }
    setPromptPreview({ title: opts.title, prompt });
  }

  async function handleGoToVideo(assetIds: string[], title: string) {
    if (assetIds.length === 0) {
      await alert({
        title: "还没有可用图片",
        message: "请先生成图片，再去做视频。",
        variant: "error",
      });
      return;
    }
    setBusy("正在创建微剧故事版…");
    try {
      const { projectId } = await createStoryboardFromAssets({
        assetIds,
        title,
        role: "product",
      });
      sessionStorage.setItem(STORYBOARD_PROJECT_STORAGE_KEY, projectId);
      router.push("/ecom/storyboard/micro-drama");
    } catch (e) {
      await alert({
        title: "跳转失败",
        message: e instanceof Error ? e.message : "无法创建故事版",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleResync() {
    setBusy("正在重新解析助手输出…");
    try {
      await syncProductDesign(project.id);
      await onProjectChange();
    } catch (e) {
      await alert({
        title: "解析失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleExportZip() {
    setBusy("正在打包交付包…");
    try {
      await downloadProductDesignExportZip(project.id);
    } catch (e) {
      await alert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveWorkflow(productName: string) {
    setBusy("正在保存到资产库…");
    try {
      const snapshot = await saveProductDesignWorkflow(project.id, productName);
      setSaveDialogOpen(false);
      await alert({
        title: "已保存到资产库",
        message: `「${snapshot.title}」已保存。可在「我的资产」对应类目下一键复用。`,
      });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  const defaultSaveProductName =
    (typeof project.brief?.productName === "string" && project.brief.productName.trim()) ||
    project.title?.trim() ||
    "";

  const mainAssetIds = (design?.mainImages ?? [])
    .map((m) => m.assetId)
    .filter((id): id is string => Boolean(id));
  const allAssetIds = [
    ...mainAssetIds,
    ...(design?.detailPages ?? [])
      .map((d) => d.assetId)
      .filter((id): id is string => Boolean(id)),
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div
        ref={scrollRootRef}
        className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]"
      >
      <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            {project.title ??
              (activeTrack === "detail" ? "电商产品详情页创作" : "电商产品主图创作")}
          </h2>
          <p className="text-[11px] text-[#6e6e73]">
            {spec
              ? `${spec.label} · ${activeTrack === "detail" ? "产品详情页" : "产品主图"}`
              : activeTrack === "detail"
                ? "产品详情页"
                : "产品主图"}
            {spec ? (
              <>
                {" "}
                ·{" "}
                {activeTrack === "detail"
                  ? `详情 ${project.resolved.detailPageCount} 屏（${project.resolved.detailPageRatio}）`
                  : `主图 ${project.resolved.mainImageCount} 张（${project.resolved.mainImageRatio}）`}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNewProject ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              dark
              disabled={Boolean(busy) || Boolean(refBusy) || streaming}
              onClick={() => void onNewProject()}
            >
              新建
            </EcomButtonSecondary>
          ) : null}
          {onImportFromMainProject ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              dark
              disabled={Boolean(busy) || Boolean(refBusy) || streaming}
              onClick={() => onImportFromMainProject()}
            >
              从主图项目导入
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={streaming || (Boolean(busy) && !generatingTarget)}
            onClick={() => void handleResync()}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            重新解析
          </EcomButtonSecondary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={!design || Boolean(busy)}
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="h-3.5 w-3.5 shrink-0" />
            保存
          </EcomButtonSecondary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={!design || Boolean(busy)}
            onClick={() => void handleExportZip()}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            导出交付包
          </EcomButtonSecondary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={Boolean(busy) || allAssetIds.length === 0}
            onClick={() => void handleGoToVideo(allAssetIds, project.title ?? "产品视频")}
          >
            <Film className="h-3.5 w-3.5 shrink-0" />
            去做视频
          </EcomButtonSecondary>
        </div>
        </div>
      </header>

      <section className="border-b border-[#e8e8ed] px-5 py-4">
        <ProductDesignRefUploader
          role="product"
          required
          references={project.references}
          visionModelKey={visionModelKey}
          imageModelKey={imageModelKey}
          onUpload={onRefUpload}
          onRemove={onRefRemove}
          onAttachAssets={onAttachAssets}
          busy={Boolean(refBusy) && uploadingRole !== "main-style"}
          uploadProgress={uploadingRole === "product" ? uploadProgress : null}
        />
        <div className="mt-3">
          <ProductDesignRefUploader
            role={detailTrack ? "detail-style" : "main-style"}
            references={project.references}
            visionModelKey={visionModelKey}
            imageModelKey={imageModelKey}
            onUpload={onRefUpload}
            onRemove={onRefRemove}
            onAttachAssets={onAttachAssets}
            busy={Boolean(refBusy) && uploadingRole !== "product"}
            uploadProgress={
              uploadingRole === (detailTrack ? "detail-style" : "main-style")
                ? uploadProgress
                : null
            }
          />
        </div>
      </section>

      <StoryboardTaskStatus
        active={Boolean(busy)}
        title={busy ?? ""}
        className="mt-3"
        surface="chrome"
      />

      {showFastMainSetup && isFastMainPath(project) ? (
        <div
          id={productDesignStepAnchorId("main-image")}
          className="scroll-mt-20 px-5 py-8"
        >
          <Section title="主图 · 参考图 + Prompt">
            <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
              跳过 Step1–4：选择平台、填写 Prompt（参考图可选）后点击「分析」，确认 Prompt 计划再出图。
            </p>
            <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">1. 选择平台</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {specs.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  disabled={streaming || (Boolean(busy) && !generatingTarget)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[11px] transition-colors",
                    project.platform === s.code
                      ? "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)] text-[#1d1d1f]"
                      : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)]",
                  )}
                  onClick={() => void selectFastMainPlatform(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {fastMainSpec ? (
              <>
                <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">
                  2. Prompt（可 @ 参考图）
                </p>
                <ProductDesignPromptMentionTextarea
                  value={
                    mainCustomPrompt.trim() ||
                    defaultMainImageRefPrompt({
                      ...project,
                      platform: fastMainSpec.code,
                      settings: {
                        ...project.settings,
                        mainImageGenMode: "reference-prompt",
                      },
                    })
                  }
                  referenceImages={promptMentionRefs}
                  disabled={Boolean(busy)}
                  onChange={setMainCustomPrompt}
                />
              </>
            ) : null}
            {project.platform ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <EcomButtonPrimary
                  size="sm"
                  type="button"
                  disabled={streaming || (Boolean(busy) && !generatingTarget)}
                  onClick={() => void handleFastMainAnalyze()}
                >
                  分析
                </EcomButtonPrimary>
              </div>
            ) : null}
          </Section>
        </div>
      ) : null}

      {showReferenceMainPlan && !showFastMainSetup ? (
        <div className="px-5 py-4">
          <ProductDesignGenSlotWorkspace
            project={project}
            target="main"
            ratio={project.resolved.mainImageRatio}
            title="主图 · Prompt 与出图"
            disabled={streaming || (Boolean(busy) && !generatingTarget)}
            mode="decompose"
            onProjectChange={onProjectChange}
            onRequestAnalyze={() => void requestMainPlanAnalyze()}
            onGenerate={(indexes) => void requestMainGenerate(indexes)}
            cardGeneratingFor={(index) => cardGeneratingFor("main", index)}
            onPreview={openMainSlotPreview}
            onDownload={(index) => {
              const item = project.design?.mainImages.find((m) => m.index === index);
              if (!item?.imageUrl) return;
              downloadImageFile(
                item.imageUrl,
                `主图-${item.index}-${item.layers.title.slice(0, 12)}.png`,
              );
            }}
            onGoToVideo={(index) => {
              const item = project.design?.mainImages.find((m) => m.index === index);
              void handleGoToVideo(
                item?.assetId ? [item.assetId] : [],
                `${item?.layers.title ?? "主图"} · 主图视频`,
              );
            }}
            beforeSlots={
              isFastMainPromptPath(project) ? (
                <div className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">
                    意图 Prompt（可 @ 参考图）
                  </p>
                  <ProductDesignPromptMentionTextarea
                    value={
                      mainCustomPrompt.trim() ||
                      defaultMainImageRefPrompt({
                        ...project,
                        settings: {
                          ...project.settings,
                          mainImageGenMode: "reference-prompt",
                        },
                      })
                    }
                    referenceImages={promptMentionRefs}
                    disabled={streaming || (Boolean(busy) && !generatingTarget)}
                    onChange={setMainCustomPrompt}
                  />
                </div>
              ) : null
            }
          />
        </div>
      ) : null}

      {showFastDetailSetup ? (
        <div
          id={productDesignStepAnchorId("detail-image")}
          className="scroll-mt-20 px-5 py-8"
        >
          <Section title="参考图快速出图 · 详情页">
            <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
              跳过 Step7–8：在页面顶部上传 detail-style 参考长图，填写意图 Prompt（可选），点击「分析」拆解为 N 屏
              Prompt 计划并确认后出图。
            </p>
            <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">
              意图 Prompt（可选，可 @ 参考图）
            </p>
            <ProductDesignPromptMentionTextarea
              value={
                detailCustomPrompt.trim() ||
                defaultDetailPageRefPrompt(project)
              }
              referenceImages={detailPromptMentionRefs}
              disabled={streaming || (Boolean(busy) && !generatingTarget)}
              onChange={setDetailCustomPrompt}
              minHeightClass="min-h-[7rem]"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={streaming || (Boolean(busy) && !generatingTarget)}
                onClick={() => void handleFastDetailAnalyze()}
              >
                分析
              </EcomButtonPrimary>
            </div>
          </Section>
        </div>
      ) : null}

      {showDetailPlanWorkspace && !showFastDetailSetup ? (
        <div className="px-5 py-4">
          <ProductDesignGenSlotWorkspace
            project={project}
            target="detail"
            ratio={project.resolved.detailPageRatio}
            title="详情页 · Prompt 与出图"
            disabled={streaming || (Boolean(busy) && !generatingTarget)}
            mode="decompose"
            onProjectChange={onProjectChange}
            onRequestAnalyze={() => void requestDetailPlanAnalyze()}
            onGenerate={(indexes) => void requestDetailGenerate(indexes)}
            cardGeneratingFor={(index) => cardGeneratingFor("detail", index)}
            onPreview={openDetailSlotPreview}
            onDownload={(index) => {
              const item = project.design?.detailPages.find((d) => d.index === index);
              if (!item?.imageUrl) return;
              downloadImageFile(
                item.imageUrl,
                `详情-${item.index}-${item.title.slice(0, 12)}.png`,
              );
            }}
            beforeSlots={
              <>
                {isFastDetailPromptPath(project) ? (
                  <div className="mb-4">
                    <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">
                      意图 Prompt（可选，可 @ 参考图）
                    </p>
                    <ProductDesignPromptMentionTextarea
                      value={detailCustomPrompt.trim() || defaultDetailPageRefPrompt(project)}
                      referenceImages={detailPromptMentionRefs}
                      disabled={streaming || (Boolean(busy) && !generatingTarget)}
                      onChange={setDetailCustomPrompt}
                      minHeightClass="min-h-[7rem]"
                    />
                  </div>
                ) : null}
              </>
            }
          />
        </div>
      ) : null}

      {!showBriefSetup &&
      !shouldSkipBrief(project) &&
      briefComplete(project.brief) &&
      project.brief ? (
        <div className="px-5 pt-5">
          <Section id="pdt-step-brief" title="Step0 · 产品信息采集">
            <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
              {MIDDLE_WORKSPACE_EDIT_HINT} 采集点选在会话区完成。
            </p>
            <ProductDesignBriefSummaryPanel
              brief={project.brief}
              onSaveField={(key, value) => patchBrief({ [key]: value })}
            />
          </Section>
        </div>
      ) : null}

      {analysisDisplay ? (
        <div className="space-y-6 px-5 py-5">
          <Section id="pdt-step-analysis" title="Step1 · 平台合规与产品拆解">
            <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
              {MIDDLE_WORKSPACE_EDIT_HINT}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <EditableFactList
                title="表层痛点"
                items={analysisDisplay.surfacePainPoints}
                onSave={(items) =>
                  patchDesign({
                    analysis: { ...analysisDisplay, surfacePainPoints: items },
                  })
                }
              />
              <EditableFactList
                title="深层需求"
                items={analysisDisplay.deepNeeds}
                onSave={(items) =>
                  patchDesign({
                    analysis: { ...analysisDisplay, deepNeeds: items },
                  })
                }
              />
              <EditableFactList
                title="差异化竞争力"
                items={analysisDisplay.differentiators}
                onSave={(items) =>
                  patchDesign({
                    analysis: { ...analysisDisplay, differentiators: items },
                  })
                }
              />
              <EditableFactList
                title="需规避表述"
                items={analysisDisplay.forbiddenWords}
                onSave={(items) =>
                  patchDesign({
                    analysis: { ...analysisDisplay, forbiddenWords: items },
                  })
                }
              />
            </div>
            <div className="mt-3 space-y-2">
              <ProductDesignEditableField
                label="视觉调性"
                value={analysisDisplay.visualTone}
                multiline
                rows={2}
                onSave={(v) =>
                  patchDesign({
                    analysis: { ...analysisDisplay, visualTone: v },
                  })
                }
              />
              <ProductDesignEditableField
                label="平台策略说明"
                value={analysisDisplay.platformNotes}
                multiline
                rows={3}
                onSave={(v) =>
                  patchDesign({
                    analysis: { ...analysisDisplay, platformNotes: v },
                  })
                }
              />
            </div>
          </Section>
        </div>
      ) : null}

      {design ? (
        <div className="space-y-6 px-5 py-5">
          <div id="pdt-step-top" className="scroll-mt-20" aria-hidden />

          {marketingPlansDisplay.length > 0 ? (
            <Section
              id="pdt-step-marketing"
              title={
                design.selectedPlanNo != null
                  ? `Step2 · 已选营销方案（方案 ${design.selectedPlanNo}）`
                  : marketingPlansDisplay.length >= 3
                    ? "Step2 · 三套营销方案（待选用）"
                    : `Step2 · ${marketingPlansDisplay.length} 套营销方案（待选用）`
              }
              action={
                design.selectedPlanNo == null ? (
                  marketingPlansDisplay.length < 3 ? (
                    <span className="text-[10px] font-medium text-amber-700">
                      仅解析到 {marketingPlansDisplay.length} 套，请在会话区重新生成或点「重新解析」
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#86868b]">
                      请在会话区点选「方案 1 / 2 / 3」
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-medium text-[var(--ecom-primary-on-dark)]">
                    已选方案 {design.selectedPlanNo} · 已锁定
                  </span>
                )
              }
            >
              {design.selectedPlanNo == null ? (
                <p className="text-[11px] leading-relaxed text-[#6e6e73]">
                  三套方案已生成并同步。请仅在右侧会话区点选「方案 1 / 2 / 3」；选定后本区展示已选方案并可铅笔编辑。
                </p>
              ) : (
                <>
                  <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                    {MIDDLE_WORKSPACE_EDIT_HINT} 方案一经选定不可更换；方案名只读，其余字段可编辑。
                  </p>
                  {(() => {
                    const selectedPlan = marketingPlansDisplay.find(
                      (p) => p.no === design.selectedPlanNo,
                    );
                    if (!selectedPlan) return null;
                    return (
                      <div className="max-w-2xl">
                        <ProductDesignMarketingPlanTable
                          plan={selectedPlan}
                          selected
                          onSaveRows={(rows) =>
                            patchDesign({
                              marketingPlans: marketingPlansDisplay.map((p) =>
                                p.no === selectedPlan.no
                                  ? syncLegacyFieldsFromRows({ ...p, rows })
                                  : p,
                              ),
                            })
                          }
                        />
                      </div>
                    );
                  })()}
                </>
              )}
            </Section>
          ) : null}

          {buyingReasonDisplay.hasContent && design.selectedPlanNo != null ? (
            <Section id="pdt-step-reasons" title="Step3 · 卖点转用户购买理由">
              <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                {MIDDLE_WORKSPACE_EDIT_HINT}
              </p>
              {buyingReasonDisplay.table ? (
                <ProductDesignBuyingReasonMatrixTable
                  intro={buyingReasonDisplay.intro}
                  table={buyingReasonDisplay.table}
                  onSaveTable={async (table) => {
                    const brief = buildBuyingReasonBriefPatch(
                      project.design?.buyingReasonBrief,
                      table,
                      buyingReasonDisplay.intro,
                    );
                    const reasons = deriveBuyingReasonsFromBrief(brief);
                    await patchDesign({
                      buyingReasonBrief: brief,
                      buyingReasons: reasons,
                    });
                  }}
                />
              ) : (
                <ul className="space-y-2">
                  {buyingReasonDisplay.reasons.map((reason, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-sm text-[#424245]"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}

          {mainTrack && mainImagesDisplay.length > 0 && !isReferenceImagePath(project) ? (
            <Section id="pdt-step-main-copy" title="Step4 · 主图分层定稿文案">
              <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                {MIDDLE_WORKSPACE_EDIT_HINT}
              </p>
              <ProductDesignMainCopyPanel
                items={mainImagesDisplay}
                onSaveItem={saveMainImageItem}
              />
            </Section>
          ) : null}

          {mainTrack && design.mainImages.length > 0 && !isReferenceImagePath(project) ? (
            <Section
              id="pdt-step-main"
              title={`Step5 · 主图出图（${design.mainImages.filter((m) => m.imageUrl).length}/${design.mainImages.length}）`}
            >
              <div className="mb-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3">
                <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">主图出图模式</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px]",
                      mainGenMode === "copy"
                        ? "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)] text-[#1d1d1f]"
                        : "border-[#e8e8ed] bg-white text-[#6e6e73]",
                    )}
                    onClick={() => {
                      setMainGenMode("copy");
                      void saveMainGenSettings("copy", mainCustomPrompt);
                    }}
                  >
                    文案驱动（Step4 分层文案）
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px]",
                      mainGenMode === "reference-prompt"
                        ? "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)] text-[#1d1d1f]"
                        : "border-[#e8e8ed] bg-white text-[#6e6e73]",
                    )}
                    onClick={() => {
                      setMainGenMode("reference-prompt");
                      const next =
                        mainCustomPrompt.trim() ||
                        defaultMainImageRefPrompt(project);
                      setMainCustomPrompt(next);
                      void saveMainGenSettings("reference-prompt", next);
                    }}
                  >
                    参考图 + 自定义 Prompt
                  </button>
                </div>
                {mainGenMode === "reference-prompt" ? (
                  <div className="space-y-2">
                    <ProductDesignPromptMentionTextarea
                      value={mainCustomPrompt}
                      referenceImages={promptMentionRefs}
                      disabled={Boolean(busy)}
                      onChange={setMainCustomPrompt}
                      onBlur={() =>
                        void saveMainGenSettings(mainGenMode, mainCustomPrompt)
                      }
                    />
                  </div>
                ) : null}
              </div>
              <ProductDesignGenSlotWorkspace
                project={project}
                target="main"
                ratio={project.resolved.mainImageRatio}
                title="主图 · Prompt 与出图"
                disabled={streaming || (Boolean(busy) && !generatingTarget)}
                mode="derive"
                onProjectChange={onProjectChange}
                onGenerate={(indexes) => void requestMainGenerate(indexes)}
                cardGeneratingFor={(index) => cardGeneratingFor("main", index)}
                onPreview={openMainSlotPreview}
                onDownload={(index) => {
                  const item = design.mainImages.find((m) => m.index === index);
                  if (!item?.imageUrl) return;
                  downloadImageFile(
                    item.imageUrl,
                    `主图-${item.index}-${item.layers.title.slice(0, 12)}.png`,
                  );
                }}
                onGoToVideo={(index) => {
                  const item = design.mainImages.find((m) => m.index === index);
                  if (!item) return;
                  void handleGoToVideo(
                    item.assetId ? [item.assetId] : [],
                    `${item.layers.title} · 主图视频`,
                  );
                }}
              />
            </Section>
          ) : null}

          {mainTrack && onContinueToDetailPages && mainImagesAllGenerated ? (
            <section className="mx-5 mb-4 rounded-xl border border-[#e8e8ed] bg-[#f9f9fb] p-4">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                主图已出齐，继续做详情页？
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
                会新建一个详情页项目，并把 Step0–3 的策略层、产品图与主图成品一起带过去，
                不需要重新填一遍。带过去的内容之后仍可修改。
              </p>
              <EcomButtonPrimary
                size="sm"
                type="button"
                className="mt-3"
                disabled={streaming || (Boolean(busy) && !generatingTarget)}
                onClick={() => onContinueToDetailPages()}
              >
                去做详情页
              </EcomButtonPrimary>
            </section>
          ) : null}

          {detailTrack && detailOutlineDisplay.length > 0 ? (
            <Section id="pdt-step-detail-outline" title="Step7 · 详情页架构">
              <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                {MIDDLE_WORKSPACE_EDIT_HINT}
              </p>
              <ProductDesignDetailOutlineTable
                rows={detailOutlineDisplay}
                onSaveRows={(rows) => patchDesign({ detailOutline: rows })}
              />
            </Section>
          ) : null}

          {detailTrack && design.detailPages.length > 0 && !isFastDetailPath(project) ? (
            <Section
              id="pdt-step-detail"
              title={`Step8-9 · 详情屏（${design.detailPages.filter((d) => d.imageUrl).length}/${design.detailPages.length}）`}
            >
              <ProductDesignGenSlotWorkspace
                project={project}
                target="detail"
                ratio={project.resolved.detailPageRatio}
                title="详情屏 · Prompt 与出图"
                disabled={streaming || (Boolean(busy) && !generatingTarget)}
                mode="derive"
                onProjectChange={onProjectChange}
                onGenerate={(indexes) => void requestDetailGenerate(indexes)}
                cardGeneratingFor={(index) => cardGeneratingFor("detail", index)}
                onPreview={openDetailSlotPreview}
                onDownload={(index) => {
                  const item = design.detailPages.find((d) => d.index === index);
                  if (!item?.imageUrl) return;
                  downloadImageFile(
                    item.imageUrl,
                    `详情-${item.index}-${item.title.slice(0, 12)}.png`,
                  );
                }}
              />
            </Section>
          ) : null}
        </div>
      ) : null}
      </div>

      <StoryboardTaskStatus
        active={genPipeline?.step === "image-model"}
        title="准备出图"
        detail="请确认生图模型；出图尺寸已按平台规则锁定。"
      />

      <StoryboardTaskStatus
        active={Boolean(generatingTarget)}
        title="AI 出图中"
        detail={busy ?? "正在调用 Gateway 生图模型，请稍候…"}
        surface="content"
      />

      <StoryboardModelPickerDialog
        open={
          genPipeline?.step === "vision-model" || genPipeline?.step === "analyzing"
        }
        onOpenChange={(open) => {
          if (!open && genPipeline?.step === "analyzing") return;
          if (!open) setGenPipeline(null);
        }}
        mode="image"
        dialogTitle={
          genPipeline?.purpose === "plan-decompose" ? "视觉分析 · 拆解 Prompt" : "视觉分析"
        }
        dialogDescription={
          genPipeline?.purpose === "plan-decompose"
            ? "选择 Gateway 视觉模型，阅读产品图与风格参考，拆解为 N 条生图 Prompt。"
            : "选择 Gateway 视觉模型，分析产品图与风格参考（姿势、光影、场景、色调）。"
        }
        confirmLabel="开始分析"
        footerHint="选好模型后点击开始分析。"
        contentClassName={cn(PRODUCT_DESIGN_WIDE_DIALOG_CLASS, "gap-0 p-0")}
        running={genPipeline?.step === "analyzing"}
        runningTitle="分析中"
        runningDetail={undefined}
        models={visionModels.length ? visionModels : imageModels}
        value={draftVisionKey}
        onChange={setDraftVisionKey}
        lockedFieldLabel="说明"
        lockedImageSizeLabel="本步仅分析图片内容，不生成图片；出图比例在下一步按平台规则设定"
        confirming={false}
        onConfirm={() => {
          if (!genPipeline) return;
          const next = { ...genPipeline, draftVisionKey };
          if (next.purpose === "plan-decompose") {
            void runPlanDecompose(next);
          } else {
            void runVisionAnalyze(next);
          }
        }}
      />

      <Dialog
        open={genPipeline?.step === "review"}
        onOpenChange={(open) => {
          if (!open) setGenPipeline(null);
        }}
      >
        <DialogContent className={PRODUCT_DESIGN_PROMPT_DIALOG_CLASS}>
          <DialogHeader className="shrink-0">
            <DialogTitle>视觉分析</DialogTitle>
          </DialogHeader>
          <div className="ecom-scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm">
            <div className="flex min-h-[5rem] shrink-0 flex-col">
              <p className="mb-1 text-xs font-medium text-[#6e6e73]">分析摘要</p>
              <textarea
                className="min-h-[5rem] w-full flex-1 rounded-lg border border-[#e8e8ed] px-3 py-2 text-[13px] leading-relaxed"
                value={genPipeline?.draftSummary ?? ""}
                onChange={(e) =>
                  setGenPipeline((p) =>
                    p ? { ...p, draftSummary: e.target.value } : p,
                  )
                }
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-1 shrink-0 text-xs font-medium text-[#6e6e73]">
                生图 Prompt（可编辑后出图）
              </p>
              <textarea
                className="min-h-0 w-full flex-1 rounded-lg border border-[#e8e8ed] px-3 py-2 text-[13px] leading-relaxed"
                value={genPipeline?.draftPrompt ?? ""}
                onChange={(e) =>
                  setGenPipeline((p) =>
                    p ? { ...p, draftPrompt: e.target.value } : p,
                  )
                }
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-2">
            <EcomButtonSecondary type="button" onClick={() => setGenPipeline(null)}>
              取消
            </EcomButtonSecondary>
            <EcomButtonPrimary
              type="button"
              onClick={() => {
                if (!genPipeline) return;
                void confirmVisualReview(genPipeline);
              }}
            >
              确认并选择生图模型
            </EcomButtonPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StoryboardModelPickerDialog
        open={genPipeline?.step === "image-model"}
        onOpenChange={(open) => {
          if (!open) setGenPipeline(null);
        }}
        mode="image"
        dialogTitle={imagePickerCopy?.title}
        dialogDescription={imagePickerCopy?.description}
        footerHint={imagePickerCopy?.footerHint}
        models={imageModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint={
          modelsLoadError ??
          "暂无可用生图模型。平台代付用户请联系管理员在 Gateway 上架 IMAGE 模型；自付用户请先在 Gateway 绑定厂商凭证。"
        }
        onRetryLoadModels={onRefreshModels}
        value={draftModelKey}
        onChange={setDraftModelKey}
        lockedImageSizeLabel={
          genPipeline?.target === "detail"
            ? `${project.resolved.detailPageRatio}（由 ${spec?.label ?? "平台"} 规则决定）`
            : `${project.resolved.mainImageRatio}（由 ${spec?.label ?? "平台"} 规则决定）`
        }
        confirming={imagePickerSubmitting}
        onConfirm={() => {
          const req = genPipeline;
          if (!req || imagePickerSubmitting) return;
          setImagePickerSubmitting(true);
          setGenPipeline(null);
          onImageModelChange(draftModelKey);
          void runGenerate(req.target, req.indexes, draftModelKey).finally(() => {
            setImagePickerSubmitting(false);
          });
        }}
      />

      <ProductDesignSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultProductName={defaultSaveProductName}
        busy={Boolean(busy)}
        onConfirm={handleSaveWorkflow}
      />

      <ProductDesignGalleryPreviewDialog
        items={galleryPreview?.items ?? []}
        initialIndex={galleryPreview?.initialIndex ?? 0}
        open={Boolean(galleryPreview?.items.length)}
        onOpenChange={(open) => {
          if (!open) setGalleryPreview(null);
        }}
      />

      <Dialog
        open={Boolean(promptPreview)}
        onOpenChange={(open) => {
          if (!open) setPromptPreview(null);
        }}
      >
        <DialogContent className={PRODUCT_DESIGN_PROMPT_DIALOG_CLASS}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{promptPreview?.title ?? "生图 Prompt"}</DialogTitle>
          </DialogHeader>
          <textarea
            readOnly
            className="ecom-scrollbar-thin min-h-0 w-full flex-1 resize-none rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-[12px] leading-relaxed text-[#1d1d1f]"
            value={promptPreview?.prompt ?? ""}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn(id && "scroll-mt-20")}>
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function EditableFactList({
  title,
  items,
  onSave,
}: {
  title: string;
  items: string[];
  onSave: (items: string[]) => void | Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-[#e8e8ed] bg-white p-3">
      <ProductDesignEditableField
        label={title}
        value={items.join("\n")}
        multiline
        rows={4}
        onSave={(text) =>
          onSave(
            text
              .split(/\n+/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </div>
  );
}

function FactList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-[#e8e8ed] bg-white p-3">
      <p className="mb-1.5 text-[11px] font-semibold text-[#1d1d1f]">{title}</p>
      <ul className="space-y-1 text-[11px] leading-relaxed text-[#6e6e73]">
        {items.map((item, i) => (
          <li key={i}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

function downloadImageFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\u4e00-\u9fff.-]+/g, "_");
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ImageCardHoverActions({
  onPreview,
  onDownload,
  onViewPrompt,
  onRegenerate,
  regenerateDisabled,
}: {
  onPreview?: () => void;
  onDownload?: () => void;
  onViewPrompt?: () => void;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
}) {
  const btnClass =
    "pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] ring-1 ring-black/10 group-hover/image:pointer-events-auto";

  return (
    <>
      {onPreview ? (
        <button
          type="button"
          title="预览"
          className={btnClass}
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onRegenerate ? (
        <button
          type="button"
          title="重新生成"
          disabled={regenerateDisabled}
          className={cn(btnClass, "disabled:cursor-not-allowed disabled:opacity-50")}
          onClick={(e) => {
            e.stopPropagation();
            onRegenerate();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onDownload ? (
        <button
          type="button"
          title="下载"
          className={btnClass}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onViewPrompt ? (
        <button
          type="button"
          title="查看 Prompt"
          className={btnClass}
          onClick={(e) => {
            e.stopPropagation();
            onViewPrompt();
          }}
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </>
  );
}

function ProductDesignCardImage({
  ratio,
  src,
  alt,
  generating,
  emptyLabel,
  badge,
  hoverActions,
}: {
  ratio: string;
  src?: string | null;
  alt: string;
  generating?: boolean;
  emptyLabel: string;
  badge: React.ReactNode;
  hoverActions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        productDesignRatioFrameClass(ratio),
        "group/image relative isolate [contain:paint]",
      )}
      style={{ aspectRatio: productDesignCssAspectRatio(ratio) }}
    >
      {generating ? (
        <>
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-contain object-center"
              unoptimized
            />
          ) : null}
          <EcomMediaGeneratingBusy className="absolute inset-0 h-full w-full" />
        </>
      ) : src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-contain object-center"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] text-[#86868b]">
          {emptyLabel}
        </div>
      )}
      {src && !generating && hoverActions ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 bg-black/45 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 z-20 flex max-w-full items-center justify-center gap-1.5 overflow-hidden px-1 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 sm:gap-2">
            {hoverActions}
          </div>
        </>
      ) : null}
      {badge}
    </div>
  );
}

function MainImageCard({
  item,
  ratio,
  busy,
  generating,
  onGenerate,
  onGoToVideo,
  onPreview,
  onDownload,
  onViewPrompt,
}: {
  item: ProductDesignMainImage;
  ratio: string;
  busy: boolean;
  generating?: boolean;
  onGenerate: () => void;
  onGoToVideo: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onViewPrompt: () => void;
}) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e8e8ed] bg-white">
      <ProductDesignCardImage
        ratio={ratio}
        src={item.imageUrl}
        alt={`主图 ${item.index}`}
        generating={generating}
        emptyLabel="点「生成」出图"
        badge={
          <span className="absolute left-2 top-2 z-20 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            主图 {item.index}
          </span>
        }
        hoverActions={
          <ImageCardHoverActions
            onPreview={onPreview}
            onDownload={onDownload}
            onViewPrompt={onViewPrompt}
            onRegenerate={onGenerate}
            regenerateDisabled={busy}
          />
        }
      />
      <div className="flex shrink-0 gap-2 border-t border-[#f0f0f2] p-3">
        <EcomButtonPrimary
          size="sm"
          type="button"
          disabled={busy}
          className="h-7 flex-1 !max-w-none w-full px-2 text-[11px]"
          onClick={onGenerate}
        >
          {item.imageUrl ? "重新生成" : "生成"}
        </EcomButtonPrimary>
        {item.assetId ? (
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={busy}
            className="h-7 px-2 text-[11px]"
            onClick={onGoToVideo}
          >
            去做视频
          </EcomButtonSecondary>
        ) : (
          <span className="h-7 w-[4.5rem] shrink-0" aria-hidden />
        )}
      </div>
    </article>
  );
}

function DetailPageCard({
  item,
  ratio,
  busy,
  generating,
  onGenerate,
  onPreview,
  onDownload,
  onViewPrompt,
  onPatchTitle,
  onPatchPurpose,
  onPatchBody,
}: {
  item: ProductDesignDetailPage;
  ratio: string;
  busy: boolean;
  generating?: boolean;
  onGenerate: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onViewPrompt: () => void;
  onPatchTitle: (title: string) => void | Promise<void>;
  onPatchPurpose: (purpose: string) => void | Promise<void>;
  onPatchBody: (body: string[]) => void | Promise<void>;
}) {
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#e8e8ed] bg-white">
      <ProductDesignCardImage
        ratio={ratio}
        src={item.imageUrl}
        alt={item.title}
        generating={generating}
        emptyLabel="文案就绪后点「生成」出图"
        badge={
          <span className="absolute left-2 top-2 z-20 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            第 {item.index} 屏
          </span>
        }
        hoverActions={
          <ImageCardHoverActions
            onPreview={onPreview}
            onDownload={onDownload}
            onViewPrompt={onViewPrompt}
            onRegenerate={onGenerate}
            regenerateDisabled={busy}
          />
        }
      />
      <div className="flex flex-1 flex-col space-y-1.5 p-3">
        <ProductDesignEditableField
          label="屏标题"
          value={item.title}
          onSave={(v) => void onPatchTitle(v)}
        />
        <ProductDesignEditableField
          label="本屏职责"
          value={item.purpose}
          onSave={(v) => void onPatchPurpose(v)}
        />
        <ProductDesignEditableField
          label="正文（一行一条）"
          value={item.body.join("\n")}
          multiline
          rows={4}
          onSave={(text) =>
            void onPatchBody(
              text
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
        <div className="mt-auto pt-2">
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={busy}
            className="h-7 !max-w-none w-full px-2 text-[11px]"
            onClick={onGenerate}
          >
            {item.imageUrl ? "重新生成" : "生成"}
          </EcomButtonPrimary>
        </div>
      </div>
    </article>
  );
}
