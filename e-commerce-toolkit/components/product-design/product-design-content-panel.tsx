"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Download, Eye, FileText, Film, ImageIcon, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  analyzeProductDesignReferences,
  createStoryboardFromAssets,
  generateProductDesignImages,
  getProductDesignProject,
  syncProductDesign,
  updateProductDesignProject,
} from "@/lib/ecom-product-design-api";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { ProductDesignRefUploader } from "@/components/product-design/product-design-ref-uploader";
import { buildProductDesignMarkdown } from "@/lib/product-design-markdown";
import { fetchAssetById } from "@/lib/ecom-api";
import type {
  EcomPlatformSpec,
  ProductDesign,
  ProductDesignDetailPage,
  ProductDesignMainImage,
  ProductDesignProject,
  ProductDesignReferenceRole,
} from "@/lib/product-design-types";
import { marketingPlanChoiceLabel, productDesignStepAnchorId, PRODUCT_DESIGN_STEPS, type ProductDesignStepId, defaultMainImageRefPrompt, ENTER_DETAIL_PAGE_CHOICE, appendMainImageSlots, PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX, ANALYZE_DETAIL_DECOMPOSE_CHOICE, hasDetailStyleRef, isFastDetailPath, INTERACTIVE_WORKFLOW_CHOICE, MAIN_REF_PROMPT_WORKFLOW_CHOICE, resolveSetupPhase } from "@/lib/product-design-workflow";
import { buildProductDesignPromptMentionRefs } from "@/lib/product-design-mention-refs";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { getMaxRefsForRoleAtInvokeClient, PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX } from "@/lib/product-design-ref-rules";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";
import {
  productDesignCssAspectRatio,
  productDesignRatioFrameClass,
} from "@/lib/product-design-ratio-display";
import { ProductDesignEditableField } from "@/components/product-design/product-design-editable-field";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORYBOARD_PROJECT_STORAGE_KEY = "ecom-storyboard-active-project";

/** 电商产品创作 · 宽弹层：宽约 2/3 屏宽，高约 1/2 屏高，内容区可滚动 */
const PRODUCT_DESIGN_WIDE_DIALOG_CLASS =
  "flex h-[min(50dvh,640px)] max-h-[min(90dvh,720px)] w-[min(66.67vw,calc(100vw-2rem))] max-w-none flex-col overflow-hidden";

/** 视觉分析结果 / 生图 Prompt 只读弹层（带内边距） */
const PRODUCT_DESIGN_PROMPT_DIALOG_CLASS = cn(
  PRODUCT_DESIGN_WIDE_DIALOG_CLASS,
  "gap-4",
);

type GenPipeline = {
  target: "main" | "detail";
  indexes?: number[];
  step: "vision-model" | "analyzing" | "review" | "image-model";
  draftVisionKey: string;
  draftSummary: string;
  draftPrompt: string;
};

type Props = {
  project: ProductDesignProject;
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
  refBusy?: boolean;
  onProjectChange: () => void | Promise<void>;
  streaming?: boolean;
  generateMainImagesToken?: number;
  generateDetailImagesToken?: number;
  onEnterDetailPage?: () => void;
  onAnalyzeDetailDecompose?: () => void;
  onChooseMainWorkflow?: (mode: "interactive" | "reference-prompt") => void;
  focusStepId?: ProductDesignStepId | null;
};

export function ProductDesignContentPanel({
  project,
  spec,
  visionModels,
  visionModelKey,
  onVisionModelChange,
  imageModels,
  imageModelKey,
  onImageModelChange,
  onRefUpload,
  onRefRemove,
  refBusy,
  onProjectChange,
  streaming,
  generateMainImagesToken = 0,
  generateDetailImagesToken = 0,
  onEnterDetailPage,
  onAnalyzeDetailDecompose,
  onChooseMainWorkflow,
  focusStepId = null,
}: Props) {
  const router = useRouter();
  const { alert, confirm } = useDialogs();
  const design = project.design;
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [genPipeline, setGenPipeline] = useState<GenPipeline | null>(null);
  const [generatingTarget, setGeneratingTarget] = useState<{
    target: "main" | "detail";
    indexes?: number[];
  } | null>(null);
  const [mainGenMode, setMainGenMode] = useState<"copy" | "reference-prompt">(
    project.settings.mainImageGenMode ?? "copy",
  );
  const [mainCustomPrompt, setMainCustomPrompt] = useState(
    project.settings.mainImageCustomPrompt ?? "",
  );

  useEffect(() => {
    setMainGenMode(project.settings.mainImageGenMode ?? "copy");
    setMainCustomPrompt(project.settings.mainImageCustomPrompt ?? "");
  }, [project.id, project.settings.mainImageGenMode, project.settings.mainImageCustomPrompt]);
  const [draftVisionKey, setDraftVisionKey] = useState(visionModelKey);
  const [draftModelKey, setDraftModelKey] = useState(imageModelKey);
  const [appendBatchSize, setAppendBatchSize] = useState(5);
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    title: string;
    ratio: string;
  } | null>(null);
  const [promptPreview, setPromptPreview] = useState<{
    title: string;
    prompt: string;
  } | null>(null);

  useEffect(() => setDraftVisionKey(visionModelKey), [visionModelKey]);
  useEffect(() => setDraftModelKey(imageModelKey), [imageModelKey]);

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

  const selectMarketingPlan = useCallback(
    async (planNo: number) => {
      if (design?.selectedPlanNo === planNo) return;
      await patchDesign({ selectedPlanNo: planNo });
    },
    [design?.selectedPlanNo, patchDesign],
  );

  const saveMainGenSettings = useCallback(
    async (mode: "copy" | "reference-prompt", customPrompt: string) => {
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
      setGeneratingTarget({ target, indexes });
      setBusy(
        indexes?.length === 1
          ? `${label}第 ${indexes[0]} 张生成中`
          : `${label}生成中`,
      );
      try {
        const result = await generateProductDesignImages(project.id, {
          target,
          indexes,
          modelKey: modelKey ?? imageModelKey,
          ratio:
            target === "main"
              ? project.resolved.mainImageRatio
              : project.resolved.detailPageRatio,
        });
        await onProjectChange();
        if (result.failures.length > 0) {
          await alert({
            title: `${result.generated} 张成功，${result.failures.length} 张失败`,
            message: result.failures
              .map((f) => `第 ${f.index} 张：${f.message}`)
              .join("\n"),
            variant: "error",
          });
        } else if (target === "main") {
          const refreshed = await getProductDesignProject(project.id);
          const mains = refreshed?.design?.mainImages ?? design?.mainImages ?? [];
          if (mains.length > 0 && mains.every((m) => m.imageUrl)) {
            await alert({
              title: "主图生成完成",
              message:
                "全部主图已生成。请在右侧助手点「进入详情页制作」，开始规划详情页架构与分屏文案。",
            });
          }
        }
      } catch (e) {
        await alert({
          title: `${label}生成失败`,
          message: e instanceof Error ? e.message : "未知错误",
          variant: "error",
        });
      } finally {
        setBusy(null);
        setGeneratingTarget(null);
      }
    },
    [project.id, project.resolved, imageModelKey, design?.mainImages, onProjectChange, alert],
  );

  const cardGeneratingFor = useCallback(
    (target: "main" | "detail", index: number) => {
      if (!generatingTarget || generatingTarget.target !== target) return false;
      if (!generatingTarget.indexes?.length) return true;
      return generatingTarget.indexes.includes(index);
    },
    [generatingTarget],
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
      setGenPipeline({
        target,
        indexes,
        step: "vision-model",
        draftVisionKey: visionModelKey,
        draftSummary: "",
        draftPrompt: "",
      });
    },
    [mainGenMode, mainCustomPrompt, saveMainGenSettings, visionModelKey],
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
            pipeline.target === "main" && mainGenMode === "reference-prompt"
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
    [project.id, onVisionModelChange, onProjectChange, alert, mainGenMode],
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

  const requestBatch = useCallback(
    async (target: "main" | "detail") => {
      const items = target === "main" ? design?.mainImages : design?.detailPages;
      if (!items?.length) {
        await alert({
          title: "无法生成",
          message: target === "main" ? "还没有主图槽位，请先追加或完成 Step4。" : "还没有详情屏文案。",
          variant: "error",
        });
        return;
      }
      const pending = items.filter((i) => !i.imageUrl);
      const regenerateAll = pending.length === 0;
      const indexes = regenerateAll
        ? items.map((i) => i.index)
        : pending.map((i) => i.index);
      const label = target === "main" ? "主图" : "详情屏";
      const ok = await confirm({
        title: regenerateAll ? `重新生成全部${label}` : `生成全部${label}`,
        message: regenerateAll
          ? `将全部 ${indexes.length} 张${label}重新出图（会覆盖现有图片）。将先分析参考图再出图，预计需要几分钟。是否继续？`
          : `将先分析参考图生成视觉 Prompt，再出图 ${indexes.length} 张，预计需要几分钟。是否继续？`,
      });
      if (!ok) return;
      if (
        target === "main" &&
        mainGenMode === "reference-prompt" &&
        !mainCustomPrompt.trim()
      ) {
        await alert({
          title: "请先填写自定义 Prompt",
          message: "参考图模式下需在「参考图 + 自定义 Prompt」文本框中描述生成意图。",
          variant: "error",
        });
        return;
      }
      void startGeneratePipeline(target, indexes);
    },
    [design, alert, confirm, startGeneratePipeline, mainGenMode, mainCustomPrompt],
  );

  // 助手侧点「生成全部主图 / 详情屏」时通过递增 token 触发
  const mainTokenRef = useRef(generateMainImagesToken);
  const detailTokenRef = useRef(generateDetailImagesToken);
  useEffect(() => {
    if (generateMainImagesToken === mainTokenRef.current) return;
    mainTokenRef.current = generateMainImagesToken;
    void requestBatch("main");
  }, [generateMainImagesToken, requestBatch]);
  useEffect(() => {
    if (generateDetailImagesToken === detailTokenRef.current) return;
    detailTokenRef.current = generateDetailImagesToken;
    void requestBatch("detail");
  }, [generateDetailImagesToken, requestBatch]);

  const allMainImagesDone =
    Boolean(design?.mainImages.length) &&
    design!.mainImages.every((m) => m.imageUrl);

  const showEnterDetailBanner =
    allMainImagesDone &&
    !project.meta?.detailWorkflowPath &&
    (design?.detailOutline.length ?? 0) === 0;

  const showDetailDecomposeWorkspace =
    allMainImagesDone &&
    isFastDetailPath(project) &&
    (design?.detailPages.length ?? 0) === 0;

  const setupPhase = resolveSetupPhase(project);
  const showMainWorkflowChoice =
    setupPhase === "workflow-choice" && !project.meta?.mainWorkflowPath;

  const promptMentionRefs = useMemo(
    () => buildProductDesignPromptMentionRefs(project, "main"),
    [project.references],
  );

  const visionInvokeMax = getMaxRefsForRoleAtInvokeClient("main-style", {
    visionModelKey,
    imageModelKey,
  });

  const appendMainImages = useCallback(
    async (addCount: number) => {
      if (!design) return;
      const next = appendMainImageSlots(design, addCount);
      if (next.length === design.mainImages.length) {
        await alert({
          title: "已达上限",
          message: `主图槽位最多 ${PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX} 张。`,
          variant: "error",
        });
        return;
      }
      const added = next.length - design.mainImages.length;
      await updateProductDesignProject(project.id, {
        settings: { mainImageCount: next.length },
      });
      await patchDesign({ mainImages: next });
    },
    [design, alert, project.id, patchDesign],
  );

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

  function handleExport() {
    const markdown = buildProductDesignMarkdown(project, spec);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title ?? "电商产品创作"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#e8e8ed] bg-white px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            {project.title ?? "电商产品创作"}
          </h2>
          <p className="text-[11px] text-[#6e6e73]">
            {spec?.label ?? project.platform} · 主图 {project.resolved.mainImageCount} 张（
            {project.resolved.mainImageRatio}） · 详情 {project.resolved.detailPageCount} 屏（
            {project.resolved.detailPageRatio}）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={Boolean(busy) || streaming}
            onClick={() => void handleResync()}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            重新解析
          </EcomButtonSecondary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={!design}
            onClick={handleExport}
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
      </header>

      <StoryboardTaskStatus
        active={Boolean(busy)}
        title={busy ?? ""}
        className="mt-3"
        surface="chrome"
      />

      {!design && !showMainWorkflowChoice ? (
        <div id="pdt-step-top" className="grid scroll-mt-20 place-items-center px-6 py-24 text-center">
          <Sparkles className="mb-3 h-8 w-8 text-[#86868b]" />
          <p className="text-sm text-[#6e6e73]">
            在右侧完成平台与产品信息后，助手将按 9 步逐段产出内容，结果会实时显示在左侧。
          </p>
        </div>
      ) : null}

      {showMainWorkflowChoice ? (
        <div id="pdt-step-top" className="scroll-mt-20 px-5 py-8">
          <Section title="主图制作方式">
            <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
              已上传产品图与风格参考。请选择主图流程：完整 9 步助手，或跳过 Step1–4 直接用参考图 +
              自定义 Prompt 快速出主图。
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={Boolean(busy) || streaming}
                className="rounded-xl border border-[#e8e8ed] bg-white px-4 py-4 text-left transition-colors hover:border-[var(--ecom-chrome-accent)] hover:bg-[var(--ecom-content-selected-bg)] disabled:opacity-50"
                onClick={() => onChooseMainWorkflow?.("interactive")}
              >
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {INTERACTIVE_WORKFLOW_CHOICE}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6e6e73]">
                  平台拆解 → 营销方案 → 购买理由 → 主图文案 → 出图，与原有流程一致。
                </p>
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || streaming}
                className="rounded-xl border border-[#e8e8ed] bg-white px-4 py-4 text-left transition-colors hover:border-[var(--ecom-chrome-accent)] hover:bg-[var(--ecom-content-selected-bg)] disabled:opacity-50"
                onClick={() => onChooseMainWorkflow?.("reference-prompt")}
              >
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {MAIN_REF_PROMPT_WORKFLOW_CHOICE}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6e6e73]">
                  选平台与张数后，在中间工作区确认 Prompt（可 @ 参考图），视觉分析后直接出主图。
                </p>
              </button>
            </div>
          </Section>
        </div>
      ) : null}

      {design ? (
        <div className="space-y-6 px-5 py-5">
          <div id="pdt-step-top" className="scroll-mt-20" aria-hidden />
          {design.analysis ? (
            <Section id="pdt-step-analysis" title="Step1 · 平台合规与产品拆解">
              <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                可直接修改下方内容，保存后自动写入项目；确认无误后在助手区点「下一步」。
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <EditableFactList
                  title="表层痛点"
                  items={design.analysis.surfacePainPoints}
                  onSave={(items) =>
                    patchDesign({
                      analysis: { ...design.analysis!, surfacePainPoints: items },
                    })
                  }
                />
                <EditableFactList
                  title="深层需求"
                  items={design.analysis.deepNeeds}
                  onSave={(items) =>
                    patchDesign({
                      analysis: { ...design.analysis!, deepNeeds: items },
                    })
                  }
                />
                <EditableFactList
                  title="差异化竞争力"
                  items={design.analysis.differentiators}
                  onSave={(items) =>
                    patchDesign({
                      analysis: { ...design.analysis!, differentiators: items },
                    })
                  }
                />
                <EditableFactList
                  title="需规避表述"
                  items={design.analysis.forbiddenWords}
                  onSave={(items) =>
                    patchDesign({
                      analysis: { ...design.analysis!, forbiddenWords: items },
                    })
                  }
                />
              </div>
              <div className="mt-3 space-y-2">
                <ProductDesignEditableField
                  label="视觉调性"
                  value={design.analysis.visualTone}
                  multiline
                  rows={2}
                  onSave={(v) =>
                    patchDesign({
                      analysis: { ...design.analysis!, visualTone: v },
                    })
                  }
                />
                <ProductDesignEditableField
                  label="平台策略说明"
                  value={design.analysis.platformNotes}
                  multiline
                  rows={3}
                  onSave={(v) =>
                    patchDesign({
                      analysis: { ...design.analysis!, platformNotes: v },
                    })
                  }
                />
              </div>
            </Section>
          ) : null}

          {design.marketingPlans.length > 0 ? (
            <Section
              id="pdt-step-marketing"
              title="Step2 · 三套营销方案"
              action={
                design.selectedPlanNo == null ? (
                  <span className="text-[10px] text-[#86868b]">
                    请选一套后继续 Step3
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-[var(--ecom-primary-on-dark)]">
                    已选方案 {design.selectedPlanNo}
                  </span>
                )
              }
            >
              <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                点击「选用方案 N」或在右侧助手点「方案 1 / 2 / 3」；铅笔图标可就地改文案，保存后出图会使用修改版。
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {design.marketingPlans.map((plan) => (
                  <article
                    key={plan.no}
                    className={cn(
                      "flex flex-col rounded-xl border p-3",
                      design.selectedPlanNo === plan.no
                        ? "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)]"
                        : "border-[#e8e8ed] bg-white",
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[#1d1d1f]">
                        方案{plan.no} · {plan.name}
                      </p>
                      {design.selectedPlanNo === plan.no ? (
                        <span className="shrink-0 text-[10px] font-medium text-[var(--ecom-primary-on-dark)]">
                          已选用
                        </span>
                      ) : (
                        <EcomButtonPrimary
                          size="sm"
                          type="button"
                          className="h-6 shrink-0 px-2 text-[10px]"
                          onClick={() => void selectMarketingPlan(plan.no)}
                        >
                          {marketingPlanChoiceLabel(plan.no)}
                        </EcomButtonPrimary>
                      )}
                    </div>
                    <div className="space-y-2">
                      <ProductDesignEditableField
                        label="切入角度"
                        value={plan.angle}
                        onSave={(v) =>
                          patchDesign({
                            marketingPlans: design.marketingPlans.map((p) =>
                              p.no === plan.no ? { ...p, angle: v } : p,
                            ),
                          })
                        }
                      />
                      <ProductDesignEditableField
                        label="击中痛点"
                        value={plan.painPoint}
                        onSave={(v) =>
                          patchDesign({
                            marketingPlans: design.marketingPlans.map((p) =>
                              p.no === plan.no ? { ...p, painPoint: v } : p,
                            ),
                          })
                        }
                      />
                      <ProductDesignEditableField
                        label="用户收获"
                        value={plan.outcome}
                        onSave={(v) =>
                          patchDesign({
                            marketingPlans: design.marketingPlans.map((p) =>
                              p.no === plan.no ? { ...p, outcome: v } : p,
                            ),
                          })
                        }
                      />
                      <ProductDesignEditableField
                        label="视觉情绪"
                        value={plan.mood}
                        onSave={(v) =>
                          patchDesign({
                            marketingPlans: design.marketingPlans.map((p) =>
                              p.no === plan.no ? { ...p, mood: v } : p,
                            ),
                          })
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          ) : null}

          {design.buyingReasons.length > 0 ? (
            <Section id="pdt-step-reasons" title="Step3 · 购买理由">
              <p className="mb-2 text-[11px] text-[#6e6e73]">
                悬停条目点铅笔可修改，保存后立即生效。
              </p>
              <ul className="space-y-2">
                {design.buyingReasons.map((reason, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-[#e8e8ed] bg-white px-3 py-2"
                  >
                    <ProductDesignEditableField
                      value={reason}
                      multiline
                      rows={2}
                      onSave={(v) =>
                        patchDesign({
                          buyingReasons: design.buyingReasons.map((r, idx) =>
                            idx === i ? v : r,
                          ),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {design.mainImages.length > 0 ? (
            <Section
              id="pdt-step-main"
              title={`Step4-5 · 主图（${design.mainImages.filter((m) => m.imageUrl).length}/${design.mainImages.length}）`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {spec ? (
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1 text-[10px] text-[#6e6e73]">
                        追加
                        <select
                          className="h-7 rounded-lg border border-[#e8e8ed] bg-white px-2 text-[11px] text-[#1d1d1f]"
                          value={appendBatchSize}
                          disabled={Boolean(busy)}
                          onChange={(e) =>
                            setAppendBatchSize(Number.parseInt(e.target.value, 10))
                          }
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        张
                      </label>
                      <EcomButtonSecondary
                        size="sm"
                        type="button"
                        dark
                        disabled={
                          Boolean(busy) ||
                          design.mainImages.length >= PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX
                        }
                        className="h-7 px-2 text-[10px]"
                        onClick={() => void appendMainImages(appendBatchSize)}
                      >
                        追加槽位
                      </EcomButtonSecondary>
                      <span className="text-[10px] text-[#86868b]">
                        共 {design.mainImages.length} 张
                      </span>
                    </div>
                  ) : null}
                  <EcomButtonPrimary
                    size="sm"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void requestBatch("main")}
                  >
                    <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    生成全部主图
                  </EcomButtonPrimary>
                </div>
              }
            >
              {showEnterDetailBanner ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0071e3]/25 bg-[#0071e3]/5 px-3 py-2.5">
                  <p className="text-[11px] leading-relaxed text-[#1d1d1f]">
                    主图已全部生成。下一步请规划详情页架构与分屏文案。
                  </p>
                  <EcomButtonPrimary
                    size="sm"
                    type="button"
                    disabled={Boolean(busy) || streaming}
                    className="shrink-0"
                    onClick={() => onEnterDetailPage?.()}
                  >
                    {ENTER_DETAIL_PAGE_CHOICE}
                  </EcomButtonPrimary>
                </div>
              ) : null}
              <p className="mb-3 rounded-lg bg-white px-3 py-2 text-[11px] leading-relaxed text-[#6e6e73]">
                Step4 助手产出分层文案（右侧可改）。Step5 点击「生成」将先经 Gateway
                视觉模型分析产品图与可选风格参考，再按分析 Prompt 出图。
              </p>
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
                    <p className="text-[10px] leading-relaxed text-[#86868b]">
                      流程：先视觉分析 {promptMentionRefs.length} 张参考（姿势/光影/场景/色调）→
                      确认 Prompt → 出图。输入 <code className="text-[#1d1d1f]">@</code>{" "}
                      引用参考图（风格在前、产品在后，最多上传 {PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX}{" "}
                      张风格参考；单次分析/出图按模型上限约 {visionInvokeMax} 张）。
                    </p>
                    <ProductDesignPromptMentionTextarea
                      value={mainCustomPrompt}
                      referenceImages={promptMentionRefs}
                      disabled={Boolean(busy)}
                      onChange={setMainCustomPrompt}
                      onBlur={() =>
                        void saveMainGenSettings(mainGenMode, mainCustomPrompt)
                      }
                    />
                    <button
                      type="button"
                      className="text-[10px] text-[var(--ecom-primary-on-dark)] hover:underline"
                      onClick={() => {
                        const next = defaultMainImageRefPrompt(project);
                        setMainCustomPrompt(next);
                        void saveMainGenSettings(mainGenMode, next);
                      }}
                    >
                      按当前参考图填充模板
                    </button>
                  </div>
                ) : null}
              </div>
              <ProductDesignRefUploader
                role="main-style"
                references={project.references}
                visionModelKey={visionModelKey}
                imageModelKey={imageModelKey}
                onUpload={onRefUpload}
                onRemove={onRefRemove}
                busy={refBusy}
                className="mb-3"
              />
              {design.visualBrief?.main ? (
                <div className="mb-3 rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-[11px] text-[#6e6e73]">
                  <p className="font-semibold text-[#1d1d1f]">上次视觉分析摘要</p>
                  <p className="mt-1 whitespace-pre-wrap">{design.visualBrief.main.summary}</p>
                </div>
              ) : null}
              <div className="grid min-w-0 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {design.mainImages.map((item) => (
                  <MainImageCard
                    key={item.index}
                    item={item}
                    ratio={project.resolved.mainImageRatio}
                    busy={Boolean(busy)}
                    generating={cardGeneratingFor("main", item.index)}
                    onGenerate={() => void startGeneratePipeline("main", [item.index])}
                    onGoToVideo={() =>
                      void handleGoToVideo(
                        item.assetId ? [item.assetId] : [],
                        `${item.layers.title} · 主图视频`,
                      )
                    }
                    onPreview={() =>
                      item.imageUrl &&
                      setImagePreview({
                        url: item.imageUrl,
                        title: `主图 ${item.index} · ${item.layers.title}`,
                        ratio: project.resolved.mainImageRatio,
                      })
                    }
                    onDownload={() => {
                      if (!item.imageUrl) return;
                      downloadImageFile(
                        item.imageUrl,
                        `主图-${item.index}-${item.layers.title.slice(0, 12)}.png`,
                      );
                    }}
                    onViewPrompt={() =>
                      void handleViewGenPrompt({
                        title: `主图 ${item.index} · 生图 Prompt`,
                        genPrompt: item.genPrompt,
                        assetId: item.assetId,
                      })
                    }
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {showDetailDecomposeWorkspace ? (
            <Section id="pdt-step-detail-decompose" title="详情页 · 参考拆解">
              <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
                上传竞品或目标风格的详情页长图参考，AI 将拆解为{" "}
                {project.resolved.detailPageCount} 屏架构与分屏文案，再逐屏出图。
              </p>
              <ProductDesignRefUploader
                role="detail-style"
                references={project.references}
                visionModelKey={visionModelKey}
                imageModelKey={imageModelKey}
                onUpload={onRefUpload}
                onRemove={onRefRemove}
                busy={refBusy}
                className="mb-3"
              />
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={
                  Boolean(busy) ||
                  streaming ||
                  !hasDetailStyleRef(project.references)
                }
                onClick={() => onAnalyzeDetailDecompose?.()}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {ANALYZE_DETAIL_DECOMPOSE_CHOICE}
              </EcomButtonPrimary>
              {!hasDetailStyleRef(project.references) ? (
                <p className="mt-2 text-[10px] text-[#86868b]">
                  请先上传至少 1 张详情页参考图（detail-style）。
                </p>
              ) : null}
            </Section>
          ) : null}

          {design.detailOutline.length > 0 ? (
            <Section id="pdt-step-detail-outline" title="Step7 · 详情页架构">
              <ol className="space-y-1.5">
                {design.detailOutline.map((row) => (
                  <li
                    key={row.index}
                    className="flex gap-3 rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-[#1d1d1f]">第{row.index}屏</span>
                    <span className="flex-1 text-[#6e6e73]">
                      {row.mission}
                      {row.doubtResolved ? ` · 解答：${row.doubtResolved}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {design.detailPages.length > 0 ? (
            <Section
              id="pdt-step-detail"
              title={`Step8-9 · 详情屏（${design.detailPages.filter((d) => d.imageUrl).length}/${design.detailPages.length}）`}
              action={
                <EcomButtonPrimary
                  size="sm"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void requestBatch("detail")}
                >
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  生成全部详情屏
                </EcomButtonPrimary>
              }
            >
              <ProductDesignRefUploader
                role="detail-style"
                references={project.references}
                visionModelKey={visionModelKey}
                imageModelKey={imageModelKey}
                onUpload={onRefUpload}
                onRemove={onRefRemove}
                busy={refBusy}
                className="mb-3"
              />
              {design.visualBrief?.detail ? (
                <div className="mb-3 rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-[11px] text-[#6e6e73]">
                  <p className="font-semibold text-[#1d1d1f]">上次视觉分析摘要</p>
                  <p className="mt-1 whitespace-pre-wrap">{design.visualBrief.detail.summary}</p>
                </div>
              ) : null}
              <div className="grid min-w-0 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {design.detailPages.map((item) => (
                  <DetailPageCard
                    key={item.index}
                    item={item}
                    ratio={project.resolved.detailPageRatio}
                    busy={Boolean(busy)}
                    generating={cardGeneratingFor("detail", item.index)}
                    onGenerate={() => void startGeneratePipeline("detail", [item.index])}
                    onPreview={() =>
                      item.imageUrl &&
                      setImagePreview({
                        url: item.imageUrl,
                        title: `第 ${item.index} 屏 · ${item.title}`,
                        ratio: project.resolved.detailPageRatio,
                      })
                    }
                    onDownload={() => {
                      if (!item.imageUrl) return;
                      downloadImageFile(
                        item.imageUrl,
                        `详情-${item.index}-${item.title.slice(0, 12)}.png`,
                      );
                    }}
                    onViewPrompt={() =>
                      void handleViewGenPrompt({
                        title: `第 ${item.index} 屏 · 生图 Prompt`,
                        genPrompt: item.genPrompt,
                        assetId: item.assetId,
                      })
                    }
                    onPatchTitle={(title) =>
                      patchDesign({
                        detailPages: design.detailPages.map((d) =>
                          d.index === item.index ? { ...d, title } : d,
                        ),
                      })
                    }
                    onPatchPurpose={(purpose) =>
                      patchDesign({
                        detailPages: design.detailPages.map((d) =>
                          d.index === item.index ? { ...d, purpose } : d,
                        ),
                      })
                    }
                    onPatchBody={(body) =>
                      patchDesign({
                        detailPages: design.detailPages.map((d) =>
                          d.index === item.index ? { ...d, body } : d,
                        ),
                      })
                    }
                  />
                ))}
              </div>
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
        dialogTitle="视觉分析"
        dialogDescription="选择 Gateway 视觉模型，分析产品图与风格参考（姿势、光影、场景、色调）。"
        confirmLabel="开始分析"
        footerHint="选好模型后点击开始分析。"
        contentClassName={cn(PRODUCT_DESIGN_WIDE_DIALOG_CLASS, "gap-0 p-0")}
        running={genPipeline?.step === "analyzing"}
        runningTitle="视觉分析中"
        runningDetail="Gateway 视觉模型正在阅读产品图与风格参考，生成出图 Prompt…"
        models={visionModels.length ? visionModels : imageModels}
        value={draftVisionKey}
        onChange={setDraftVisionKey}
        lockedFieldLabel="说明"
        lockedImageSizeLabel="本步仅分析图片内容，不生成图片；出图比例在下一步按平台规则设定"
        confirming={false}
        onConfirm={() => {
          if (!genPipeline) return;
          const next = { ...genPipeline, draftVisionKey };
          void runVisionAnalyze(next);
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
        models={imageModels}
        value={draftModelKey}
        onChange={setDraftModelKey}
        lockedImageSizeLabel={
          genPipeline?.target === "detail"
            ? `${project.resolved.detailPageRatio}（由 ${spec?.label ?? "平台"} 规则决定）`
            : `${project.resolved.mainImageRatio}（由 ${spec?.label ?? "平台"} 规则决定）`
        }
        confirming={Boolean(busy)}
        onConfirm={() => {
          const req = genPipeline;
          setGenPipeline(null);
          if (!req) return;
          onImageModelChange(draftModelKey);
          void runGenerate(req.target, req.indexes, draftModelKey);
        }}
      />

      <EcomImagePreviewDialog
        src={imagePreview?.url ?? ""}
        open={Boolean(imagePreview)}
        onOpenChange={(open) => {
          if (!open) setImagePreview(null);
        }}
        title={imagePreview?.title ?? "图片预览"}
        aspectRatio={imagePreview?.ratio}
        objectFit="contain"
        fullscreen
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
        <EcomMediaGeneratingBusy className="absolute inset-0 h-full w-full bg-white" />
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
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e8e8ed] bg-white">
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
      <div className="space-y-1.5 p-3">
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
        <EcomButtonPrimary
          size="sm"
          type="button"
          disabled={busy}
          className="mt-1 h-7 !max-w-none w-full px-2 text-[11px]"
          onClick={onGenerate}
        >
          {item.imageUrl ? "重新生成" : "生成"}
        </EcomButtonPrimary>
      </div>
    </article>
  );
}
