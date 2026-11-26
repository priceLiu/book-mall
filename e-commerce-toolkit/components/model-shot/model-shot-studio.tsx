"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { BackgroundGenerationProvider } from "@/components/generation";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { ModelShotConfigSidebar } from "@/components/model-shot/model-shot-config-sidebar";
import { ModelShotContentPanel } from "@/components/model-shot/model-shot-content-panel";
import { ModelShotProgressRail } from "@/components/model-shot/model-shot-progress-rail";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { cn } from "@/lib/utils";
import { useEcomStudioAssistantCollapse } from "@/lib/ecom-assistant-collapse";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { WorkflowShareLinkDialog } from "@/components/storyboard/workflow-share-link-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createModelShotProject,
  deleteModelShotProject,
  fetchModelShotModels,
  getModelShotProject,
  listModelShotProjectSummaries,
  updateModelShotProject,
} from "@/lib/ecom-model-shot-api";
import {
  clearEcomLastProjectId,
  readEcomLastProjectId,
  writeEcomLastProjectId,
} from "@/lib/ecom-last-project";
import type { ModelShotProject, ModelShotReferenceRole } from "@/lib/model-shot-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { defaultImageSizeForModel } from "@/lib/storyboard-gen-params";
import {
  filterImageSizeOptionsByEcomRatio,
  imageSizeOptionsForModel,
} from "@/lib/storyboard-image-size-options";

const PROJECT_STORAGE_KEY = "ecom-model-shot-active-project";
const ENTRY_PATH = "/ecom/model-shot";

type ImagePickerRequest = {
  poseIndex: number | null;
  batchIndexes: number[] | null;
};

export function ModelShotStudio() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const [project, setProject] = useState<ModelShotProject | null>(null);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState("wan2.7-image");
  const [imageSize, setImageSize] = useState(() => {
    const opts = filterImageSizeOptionsByEcomRatio(
      imageSizeOptionsForModel("wan2.7-image"),
      "3:4",
    );
    return opts[0]?.value ?? defaultImageSizeForModel("wan2.7-image", "3:4", { lockedRatio: true });
  });
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [refGenBusyRole, setRefGenBusyRole] = useState<ModelShotReferenceRole | null>(null);
  const { assistantCollapsed, setAssistantCollapsed, handleMainBlankPointerDown } =
    useEcomStudioAssistantCollapse(false);
  const [imagePicker, setImagePicker] = useState<ImagePickerRequest | null>(null);
  const [workflowShareOpen, setWorkflowShareOpen] = useState(false);
  const imageGenerateRef = useRef<
    (modelKey: string, indexes: number[], imageSize?: string) => void
  >(() => {});
  const applyProject = useCallback((p: ModelShotProject) => {
    setProject(p);
    writeEcomLastProjectId(PROJECT_STORAGE_KEY, p.id);
    if (p.settings.imageModelKey) setImageModelKey(p.settings.imageModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: ModelShotProject) => {
      applyProject(initial ?? (await getModelShotProject(id)));
    },
    [applyProject],
  );

  const handleProjectChange = useCallback(
    async (next?: ModelShotProject) => {
      if (next) {
        applyProject(next);
        return;
      }
      if (project?.id) await reload(project.id);
    },
    [applyProject, project?.id, reload],
  );

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await fetchModelShotModels();
      setImageModels(models.imageModels);
      setImageModelKey((prev) => pickBoundStoryboardModelKey(models.imageModels, prev));
      setModelsLoadError(
        models.imageModels.length === 0
          ? "Gateway 未返回支持参考图的生图模型，请检查凭证或平台 IMAGE 模型上架。"
          : null,
      );
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : "模型列表加载失败");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadModels();

    (async () => {
      try {
        const savedId = readEcomLastProjectId(PROJECT_STORAGE_KEY);
        const urlProjectId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("projectId")?.trim() || null
            : null;
        let initial: ModelShotProject | undefined;
        let projectId: string | null = null;

        if (urlProjectId) {
          try {
            initial = await getModelShotProject(urlProjectId);
            projectId = initial.id;
          } catch {
            /* invalid share / stale link */
          }
        }
        if (!projectId && savedId) {
          try {
            initial = await getModelShotProject(savedId);
            projectId = initial.id;
          } catch {
            /* stale */
          }
        }
        if (!projectId) {
          const summaries = await listModelShotProjectSummaries();
          projectId = summaries[0]?.id ?? null;
        }
        if (cancelled) return;
        if (!projectId) {
          setEmpty(true);
          return;
        }
        await reload(projectId, initial);
      } catch (e) {
        if (cancelled) return;
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
        } else {
          await alert({
            title: "加载失败",
            message: e instanceof Error ? e.message : "无法初始化工作台",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // 仅挂载时初始化；勿把 reload/loadModels 放入 deps（loadModels 更新 imageModels 会触发死循环）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewProject() {
    const hasWork =
      Boolean(project?.references?.length) ||
      (project?.chatHistory?.length ?? 0) > 0 ||
      Boolean(project?.plan?.items?.length);
    if (
      hasWork &&
      !(await confirm({
        title: "新建项目",
        message:
          "新建将清空当前编辑。已生成的成图仍保留在「我的资产 · 服装模特图」。是否继续？",
      }))
    ) {
      return;
    }
    setLoading(true);
    setEmpty(false);
    try {
      const created = await createModelShotProject({ title: "服装模特图" });
      await reload(created.id, created);
    } catch (e) {
      await alert({
        title: "新建失败",
        message: e instanceof Error ? e.message : "无法创建项目",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const loadProjectList = useCallback(async () => {
    const items = await listModelShotProjectSummaries();
    return items.map((p) => ({
      id: p.id,
      title: p.title?.trim() || "服装模特图",
      updatedAt: p.updatedAt,
      thumbnailUrl: p.thumbnailUrl,
    }));
  }, []);

  async function handleOpenProject(id: string) {
    if (project?.id === id) return;
    setLoading(true);
    try {
      await reload(id);
      setEmpty(false);
    } catch (e) {
      await alert({
        title: "打开失败",
        message: e instanceof Error ? e.message : "无法打开项目",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    const ok = await doubleConfirm({
      title: "删除服装模特图项目",
      message: `将删除「${project.title?.trim() || "服装模特图"}」的会话与姿势计划。`,
      secondTitle: "不可恢复",
      secondMessage:
        "删除后项目记录无法找回；已生成的图片仍保留在云端存储（OSS）与「我的资产」中。是否继续？",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setLoading(true);
    try {
      await deleteModelShotProject(project.id);
      clearEcomLastProjectId(PROJECT_STORAGE_KEY);
      const summaries = await listModelShotProjectSummaries();
      if (summaries[0]) {
        await reload(summaries[0].id);
      } else {
        setProject(null);
        setEmpty(true);
      }
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "无法删除项目",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const requestImagePicker = useCallback(
    (opts: { poseIndex?: number; batchIndexes?: number[] }) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setImagePicker({
            poseIndex: opts.poseIndex ?? null,
            batchIndexes:
              opts.batchIndexes && opts.batchIndexes.length > 0 ? opts.batchIndexes : null,
          });
        });
      });
    },
    [],
  );

  const imagePickerDialogTitle = useMemo(() => {
    if (!imagePicker) return "生成模特图";
    if (imagePicker.batchIndexes?.length) {
      return `生成模特图（${imagePicker.batchIndexes.length}）`;
    }
    if (imagePicker.poseIndex != null) {
      return `生成模特图 · 姿势 ${imagePicker.poseIndex}`;
    }
    return "生成全部模特图";
  }, [imagePicker]);

  const handleImageModelChange = useCallback(
    (key: string) => {
      if (!project) return;
      setImageModelKey(key);
      updateModelShotProject(project.id, { settings: { imageModelKey: key } }).catch(
        () => undefined,
      );
    },
    [project],
  );

  const registerImageGenerate = useCallback(
    (handler: (modelKey: string, indexes: number[]) => void) => {
      imageGenerateRef.current = handler;
    },
    [],
  );

  if (needLogin) {
    return (
      <EcomLoginPrompt
        returnPath={ENTRY_PATH}
        message="使用服装模特图需要登录。请点击下方按钮，经主站 Book 完成 SSO 后自动回到本页。"
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
          <h2 className="text-xl font-semibold text-[var(--ecom-ink)]">服装模特图</h2>
          <p className="max-w-md text-sm text-[var(--ecom-muted)]">
            上传服装参考图，在右侧配置采集项并生成姿势方案，确认后于中栏批量生成上身展示图。
          </p>
          <EcomButtonSecondary type="button" onClick={() => void handleNewProject()} disabled={loading}>
            {loading ? "创建中…" : "开始创作"}
          </EcomButtonSecondary>
        </div>
      </EcomWorkspaceLayout>
    );
  }

  return (
    <BackgroundGenerationProvider>
      <EcomWorkspaceLayout
        progress={<ModelShotProgressRail project={project} />}
        assistantSeamCollapse
        onMainBlankPointerDown={handleMainBlankPointerDown}
        assistantClassName={cn(
          assistantCollapsed &&
            "max-md:max-h-0 max-md:min-h-0 max-md:overflow-visible max-md:border-t-0 bg-transparent md:w-0 md:min-w-0 md:max-w-0 md:overflow-visible md:border-l-0",
        )}
        assistant={
          <ModelShotConfigSidebar
            key={project.id}
            project={project}
            disabled={refGenBusyRole != null}
            collapsed={assistantCollapsed}
            onCollapsedChange={setAssistantCollapsed}
            onProjectChange={handleProjectChange}
            onAlert={alert}
          />
        }
      >
        <ModelShotContentPanel
          project={project}
          imageModels={imageModels}
          imageModelKey={imageModelKey}
          imageSize={imageSize}
          onImageModelChange={handleImageModelChange}
          modelsLoading={modelsLoading}
          modelsLoadError={modelsLoadError}
          onRefreshModels={loadModels}
          onNewProject={() => void handleNewProject()}
          loadProjectList={loadProjectList}
          onOpenProject={(id) => void handleOpenProject(id)}
          onDeleteProject={() => void handleDeleteProject()}
          onProjectChange={handleProjectChange}
          onRefGenBusyRoleChange={setRefGenBusyRole}
          imagePickerOpen={imagePicker != null}
          onRequestImagePicker={requestImagePicker}
          onRegisterImageGenerate={registerImageGenerate}
          onShareWorkflow={() => setWorkflowShareOpen(true)}
        />
      </EcomWorkspaceLayout>

      <WorkflowShareLinkDialog
        projectId={project.id}
        projectTitle={project.title?.trim() || "服装模特图"}
        open={workflowShareOpen}
        onClose={() => setWorkflowShareOpen(false)}
        resourceType="ecom_model_shot_project"
        description="分享 10 位码或主站链接；好友领取副本后可继续编辑参考图与姿势方案并生成模特图。"
      />

      {imagePicker && project ? (
        <StoryboardModelPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setImagePicker(null);
          }}
          mode="image"
          panelIndex={imagePicker.poseIndex}
          dialogTitle={imagePickerDialogTitle}
          dialogDescription="仅列出支持参考图的 IMAGE 模型；参考顺序：服装 → 模特 → 场景。"
          footerHint="选好模型与参数后开始生成；长耗时任务可在右下角 Dock 查看。"
          previewCount={
            imagePicker.batchIndexes && imagePicker.batchIndexes.length > 0
              ? imagePicker.batchIndexes.length
              : imagePicker.poseIndex != null
                ? 1
                : Math.max(1, project.plan.items.length)
          }
          models={imageModels}
          modelsLoading={modelsLoading}
          modelsEmptyHint={modelsLoadError ?? undefined}
          onRetryLoadModels={loadModels}
          value={imageModelKey}
          onChange={handleImageModelChange}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          lockedImageSizeLabel="3:4（服装模特图标准竖版）"
          onConfirm={(modelKey) => {
            const indexes =
              imagePicker.batchIndexes && imagePicker.batchIndexes.length > 0
                ? imagePicker.batchIndexes
                : imagePicker.poseIndex != null
                  ? [imagePicker.poseIndex]
                  : project.plan.items.map((i) => i.index);
            setImagePicker(null);
            handleImageModelChange(modelKey);
            imageGenerateRef.current(modelKey, indexes, imageSize);
          }}
        />
      ) : null}
    </BackgroundGenerationProvider>
  );
}
