"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductImageSetConfigSidebar } from "@/components/product-image-set/product-image-set-config-sidebar";
import { ProductImageSetContentPanel } from "@/components/product-image-set/product-image-set-content-panel";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { WorkflowShareLinkDialog } from "@/components/storyboard/workflow-share-link-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createProductImageSetProject,
  generateProductImageSetBatch,
  getProductImageSetProject,
  listProductImageSetSummaries,
  planProductImageSetProject,
  removeProductImageSetRef,
  saveProductImageSetWorkflow,
  updateProductImageSetProject,
  uploadProductImageSetRef,
} from "@/lib/ecom-product-image-set-api";
import { fetchStoryboardModels } from "@/lib/ecom-storyboard-api";
import {
  ECOM_WORKFLOW_SHARE_DESCRIPTION,
  ECOM_WORKFLOW_SHARE_RESOURCE,
} from "@/lib/ecom-workflow-share";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import {
  isProductImageSetGenerating,
  isProductImageSetPlanning,
} from "@/lib/product-image-set-busy";
import { readEcomLastProjectId, writeEcomLastProjectId } from "@/lib/ecom-last-project";
import type { ProductImageSetProject, ProductImageSetSlot } from "@/lib/product-image-set-types";
import { totalStructureCount } from "@/lib/product-image-set-types";
import type { EcomImageRatio } from "@/lib/product-design-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { defaultImageSizeForModel } from "@/lib/storyboard-gen-params";
import {
  filterImageSizeOptionsByEcomRatio,
  imageSizeOptionsForModel,
} from "@/lib/storyboard-image-size-options";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const STORAGE_KEY = "ecom-product-image-set-active-project";
const DEFAULT_IMAGE_MODEL = "wan2.7-image";

function initialImageSize(modelKey: string, ratio: EcomImageRatio): string {
  const opts = filterImageSizeOptionsByEcomRatio(
    imageSizeOptionsForModel(modelKey, { lockedRatio: true }),
    ratio,
  );
  return (
    opts[0]?.value ??
    defaultImageSizeForModel(modelKey, ratio, { lockedRatio: true }) ??
    "1:1_2K"
  );
}

export function ProductImageSetStudio() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const [project, setProject] = useState<ProductImageSetProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generatingSlotIds, setGeneratingSlotIds] = useState<Set<string>>(new Set());
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [imageModelKey, setImageModelKey] = useState(DEFAULT_IMAGE_MODEL);
  const [imageSize, setImageSize] = useState(() =>
    initialImageSize(DEFAULT_IMAGE_MODEL, "1:1"),
  );
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [workflowShareOpen, setWorkflowShareOpen] = useState(false);
  const prevPhaseRef = useRef<string | undefined>();
  const generateChainRef = useRef(Promise.resolve());

  const serverPlanning = project ? isProductImageSetPlanning(project) : false;
  const serverGenerating = project ? isProductImageSetGenerating(project) : false;
  const planningActive = planning || serverPlanning;
  const clientGenerating = generatingSlotIds.size > 0;
  const generatingActive = clientGenerating || serverGenerating;

  const imageRatio = (project?.settings.imageRatio ?? "1:1") as EcomImageRatio;

  const lockedRatioLabel = useMemo(
    () => `${imageRatio}（侧栏「生成设置」可改出图比例）`,
    [imageRatio],
  );

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsLoadError(null);
    try {
      const data = await fetchStoryboardModels();
      setImageModels(data.imageModels);
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : "无法加载模型列表");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const syncModelFromProject = useCallback(
    (p: ProductImageSetProject, models: StoryboardGatewayModel[]) => {
      const ratio = (p.settings.imageRatio ?? "1:1") as EcomImageRatio;
      const key = pickBoundStoryboardModelKey(
        models,
        p.settings.imageModelKey?.trim() || DEFAULT_IMAGE_MODEL,
      );
      setImageModelKey(key);
      if (p.settings.imageGenSize?.trim()) {
        setImageSize(p.settings.imageGenSize.trim());
      } else {
        setImageSize(initialImageSize(key, ratio));
      }
    },
    [],
  );

  useEffect(() => {
    if (project && imageModels.length > 0) {
      syncModelFromProject(project, imageModels);
    }
  }, [
    project?.id,
    project?.settings.imageModelKey,
    project?.settings.imageGenSize,
    project?.settings.imageRatio,
    imageModels,
    syncModelFromProject,
    project,
  ]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    setImageSize((prev) => {
      const opts = filterImageSizeOptionsByEcomRatio(
        imageSizeOptionsForModel(imageModelKey, { lockedRatio: true }),
        imageRatio,
      );
      if (opts.some((o) => o.value === prev)) return prev;
      return initialImageSize(imageModelKey, imageRatio);
    });
  }, [imageModelKey, imageRatio, modelPickerOpen]);

  const reload = useCallback(async (id: string) => {
    const p = await getProductImageSetProject(id);
    setProject(p);
    writeEcomLastProjectId(STORAGE_KEY, id);
    return p;
  }, []);

  useEffect(() => {
    if (!project?.id) return;
    const clientGenerating = generatingSlotIds.size > 0;
    if (!serverPlanning && !serverGenerating && !clientGenerating) return;
    const timer = window.setInterval(() => {
      void reload(project.id).catch(() => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [
    project?.id,
    serverPlanning,
    serverGenerating,
    generatingSlotIds.size,
    reload,
  ]);

  useEffect(() => {
    if (!project) return;
    const phase = project.meta.phase;
    const was = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (planning) return;
    if (was !== "planning" || phase !== "planned") return;
    const usedLlm = project.meta.planPromptSource === "llm";
    toast({
      title: "套图占位已就绪",
      message: usedLlm
        ? `共 ${totalStructureCount(project.settings.structure)} 张，AI 已生成各槽位 Prompt。`
        : `共 ${totalStructureCount(project.settings.structure)} 张（AI 规划未成功，已用规则 Prompt）。`,
      variant: usedLlm ? "success" : "error",
    });
  }, [project, planning, toast]);

  useEffect(() => {
    if (!project?.meta.lastBusyStaleAt) return;
    const staleAt = project.meta.lastBusyStaleAt;
    const key = `stale-${project.id}-${staleAt}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void alert({
      title: "任务状态已超时",
      message:
        "上次占位或出图任务可能因网络中断未正常结束，已自动解除「进行中」状态。若中栏无结果，请重新点击生成。",
      variant: "error",
    });
  }, [project?.id, project?.meta.lastBusyStaleAt, alert]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lastId = readEcomLastProjectId(STORAGE_KEY);
        let projectId: string | null = lastId;
        let initial: ProductImageSetProject | undefined;

        if (lastId) {
          try {
            initial = await getProductImageSetProject(lastId);
            projectId = initial.id;
          } catch {
            projectId = null;
          }
        }
        if (!projectId) {
          const summaries = await listProductImageSetSummaries();
          projectId = summaries[0]?.id ?? null;
        }
        if (!cancelled && projectId) {
          const p = initial ?? (await getProductImageSetProject(projectId));
          setProject(p);
          setEmpty(false);
          writeEcomLastProjectId(STORAGE_KEY, p.id);
        } else if (!cancelled) {
          setEmpty(true);
        }
      } catch (e) {
        if (isEcomUnauthorizedError(e)) {
          if (!cancelled) setNeedLogin(true);
        } else if (!cancelled) {
          setEmpty(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProjectList = useCallback(async () => {
    const items = await listProductImageSetSummaries();
    return items.map((p) => ({
      id: p.id,
      title: p.title?.trim() || "AI 商品套图",
      updatedAt: p.updatedAt,
      thumbnailUrl: p.thumbnailUrl,
    }));
  }, []);

  async function handleOpenProject(id: string) {
    if (project?.id === id) return;
    setLoading(true);
    try {
      await reload(id);
    } catch (e) {
      await alert({
        title: "打开失败",
        message: e instanceof Error ? e.message : "无法加载项目",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleNewProject() {
    const hasWork =
      Boolean(project?.references?.length) ||
      Boolean(project?.output.slots.length) ||
      Boolean(project?.meta.sellpointDocument?.trim());
    const defaultName = project?.title?.trim() || "AI 商品套图";
    await runEcomNewProjectWithSavePrompt({
      confirm,
      hasWorkToSave: Boolean(project && hasWork),
      message: "当前项目尚未保存工作流。是否先保存？",
      save: async () => {
        if (!project) return;
        const snapshot = await saveProductImageSetWorkflow(project.id, defaultName);
        toast({
          title: "工作流已保存",
          message: `「${snapshot.title}」已保存，可继续新建。`,
          variant: "success",
        });
      },
      onProceed: async () => {
        setLoading(true);
        setEmpty(false);
        try {
          const created = await createProductImageSetProject({ title: "AI 商品套图" });
          setProject(created);
          writeEcomLastProjectId(STORAGE_KEY, created.id);
        } catch (e) {
          await alert({
            title: "创建失败",
            message: e instanceof Error ? e.message : "无法创建项目",
            variant: "error",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function persistModelSettings(modelKey: string, size: string) {
    if (!project) return;
    setImageModelKey(modelKey);
    setImageSize(size);
    const p = await updateProductImageSetProject(project.id, {
      settings: { imageModelKey: modelKey, imageGenSize: size },
    });
    setProject(p);
  }

  async function handlePlan() {
    if (!project) return;
    if (planningActive) return;
    setPlanning(true);
    try {
      await updateProductImageSetProject(project.id, {
        settings: { imageModelKey, imageGenSize: imageSize },
      });
      const p = await planProductImageSetProject(project.id, {
        visionModelKey: project.settings.visionModelKey,
      });
      setProject(p);
      const usedLlm = p.meta.planPromptSource === "llm";
      if (usedLlm) {
        toast({
          title: "套图占位已就绪",
          message: `共 ${totalStructureCount(p.settings.structure)} 张，AI 已按结构生成各槽位文生图 Prompt，请在中栏勾选出图。`,
          variant: "success",
        });
      } else {
        await alert({
          title: "占位已生成，但 AI 规划失败",
          message: [
            p.meta.planPromptError?.trim() ||
              "视觉模型未返回有效 Prompt，当前为规则模板，请检查 Gateway 与默认视觉模型后重试。",
            "建议：先点「AI 帮写」填写卖点，再重新「生成套图占位」。",
          ].join("\n\n"),
          variant: "error",
        });
      }
    } catch (e) {
      await alert({
        title: "生成占位失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setPlanning(false);
    }
  }

  function handleGenerateSlots(slotIds: string[], opts?: { regenerate?: boolean }) {
    if (!project) return;
    if (planningActive) return;

    const ids = slotIds.filter(Boolean);
    if (ids.length === 0) return;

    setGeneratingSlotIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });

    const run = async () => {
      try {
        const result = await generateProductImageSetBatch(project.id, {
          slotIds: ids,
          modelKey: imageModelKey,
          imageSize,
          regenerate: opts?.regenerate === true,
        });
        setProject(result.project);
        if (result.failures.length > 0) {
          toast({
            title: "部分图片生成失败",
            message: `成功 ${result.generated} 张，失败 ${result.failures.length} 张`,
            variant: "error",
          });
        } else if (result.generated > 0) {
          toast({
            title: "出图完成",
            message: `本次 ${result.generated} 张`,
            variant: "success",
          });
        }
      } catch (e) {
        await alert({
          title: "生成失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setGeneratingSlotIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
      }
    };

    generateChainRef.current = generateChainRef.current.then(run, run);
  }

  if (needLogin) {
    return (
      <EcomLoginPrompt
        returnPath="/ecom/product-image-set"
        message="使用 AI 商品套图需要登录。"
      />
    );
  }

  if (loading && !project) {
    return <ProductCreationStudioSkeleton />;
  }

  if (empty || !project) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">AI 商品套图</h2>
          <p className="max-w-md text-sm text-[#6e6e73]">
            白底 / 卖点 / 场景套图。点击开始创作。
          </p>
          <EcomButtonSecondary type="button" onClick={() => void handleNewProject()} disabled={loading}>
            开始创作
          </EcomButtonSecondary>
        </div>
      </EcomWorkspaceLayout>
    );
  }

  return (
    <>
      <EcomWorkspaceLayout
        assistant={
          <ProductImageSetConfigSidebar
            project={project}
            disabled={refBusy}
            planning={planningActive}
            generating={generatingActive}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            modelsLoading={modelsLoading}
            onProjectChange={async () => {
              await reload(project.id);
            }}
            onOpenModelPicker={() => setModelPickerOpen(true)}
            onRequestPlan={() => void handlePlan()}
          />
        }
      >
        <ProductImageSetContentPanel
          project={project}
          ratio={imageRatio}
          refBusy={refBusy}
          planning={planningActive}
          generating={generatingActive}
          workspaceDisabled={planningActive}
          generatingSlotIds={generatingSlotIds}
          onNewProject={() => void handleNewProject()}
          loadProjectList={loadProjectList}
          onOpenProject={(id) => void handleOpenProject(id)}
          onReplan={() => void handlePlan()}
          onShareWorkflow={() => setWorkflowShareOpen(true)}
          onProjectChange={async () => {
            await reload(project.id);
          }}
          onSaveSlots={async (slots: ProductImageSetSlot[]) => {
            const p = await updateProductImageSetProject(project.id, {
              output: { slots, listingCopy: project.output.listingCopy },
            });
            setProject(p);
          }}
          onGenerateSlots={(slotIds) => handleGenerateSlots(slotIds)}
          onUpload={async (file) => {
            setRefBusy(true);
            try {
              const p = await uploadProductImageSetRef(project.id, file);
              setProject(p);
            } catch (e) {
              await alert({
                title: "上传失败",
                message: e instanceof Error ? e.message : "无法上传",
                variant: "error",
              });
            } finally {
              setRefBusy(false);
            }
          }}
          onRemoveRef={(refId) => {
            void (async () => {
              const ok = await doubleConfirm({
                title: "删除商品原图",
                message: "确定移除这张原图？",
                secondTitle: "不可恢复",
                secondMessage: "删除后需重新上传。",
                confirmLabel: "删除",
              });
              if (!ok) return;
              setRefBusy(true);
              try {
                const p = await removeProductImageSetRef(project.id, refId);
                setProject(p);
              } finally {
                setRefBusy(false);
              }
            })();
          }}
        />
      </EcomWorkspaceLayout>

      <StoryboardModelPickerDialog
        open={modelPickerOpen}
        nativeOverlay
        onOpenChange={setModelPickerOpen}
        mode="image"
        dialogTitle="选择生图模型与参数"
        dialogDescription="套图出图会使用侧栏已保存的模型；商品原图作为参考图传入 Gateway。"
        footerHint="确认后写入项目设置，用于中栏槽位出图。"
        confirmLabel="确认"
        models={imageModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint={
          modelsLoadError ??
          "暂无可用生图模型。平台代付用户请联系管理员在 Gateway 上架 IMAGE 模型；自付用户请先在 Gateway 绑定厂商凭证。"
        }
        onRetryLoadModels={() => void loadModels()}
        value={imageModelKey}
        onChange={setImageModelKey}
        imageSize={imageSize}
        onImageSizeChange={setImageSize}
        lockedImageSizeLabel={lockedRatioLabel}
        onConfirm={(modelKey) => {
          setModelPickerOpen(false);
          void persistModelSettings(modelKey, imageSize);
        }}
      />

      {project ? (
        <WorkflowShareLinkDialog
          projectId={project.id}
          projectTitle={project.title?.trim() || "AI 商品套图"}
          open={workflowShareOpen}
          onClose={() => setWorkflowShareOpen(false)}
          resourceType={ECOM_WORKFLOW_SHARE_RESOURCE.productImageSet}
          description={
            ECOM_WORKFLOW_SHARE_DESCRIPTION[ECOM_WORKFLOW_SHARE_RESOURCE.productImageSet]
          }
        />
      ) : null}
    </>
  );
}
