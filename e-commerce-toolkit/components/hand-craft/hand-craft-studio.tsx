"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { HandCraftAssistantPanel } from "@/components/hand-craft/hand-craft-assistant-panel";
import { HandCraftContentPanel } from "@/components/hand-craft/hand-craft-content-panel";
import { HandCraftProgressRail } from "@/components/hand-craft/hand-craft-progress-rail";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { useEcomStudioAssistantCollapse } from "@/lib/ecom-assistant-collapse";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { WorkflowShareLinkDialog } from "@/components/storyboard/workflow-share-link-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createHandCraftProject,
  deleteHandCraftProject,
  fetchHandCraftModels,
  generateHandCraftSketch,
  getHandCraftProject,
  listHandCraftProjectSummaries,
  removeHandCraftSketch,
  attachHandCraftSketchesFromAssets,
  updateHandCraftProject,
  uploadHandCraftSketch,
} from "@/lib/ecom-hand-craft-api";
import type { HandCraftProject, HandCraftStepId } from "@/lib/hand-craft-types";
import { inferCurrentStepId } from "@/lib/hand-craft-workflow";
import { ECOM_DEFAULT_CHAT_MODEL_KEY } from "@/lib/ecom-assistant-models";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  ECOM_WORKFLOW_SHARE_DESCRIPTION,
  ECOM_WORKFLOW_SHARE_RESOURCE,
} from "@/lib/ecom-workflow-share";

const PROJECT_STORAGE_KEY = "ecom-hand-craft-active-project";
const ENTRY_PATH = "/ecom/hand-craft";

export function HandCraftStudio() {
  const { alert, confirm, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<HandCraftProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState(ECOM_DEFAULT_CHAT_MODEL_KEY);
  const [imageModelKey, setImageModelKey] = useState("wan2.7-image");
  const [concurrencyLimit, setConcurrencyLimit] = useState(1);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [workflowShareOpen, setWorkflowShareOpen] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [sketchGenBusy, setSketchGenBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantWide, setAssistantWide] = useState(false);
  const { assistantCollapsed, setAssistantCollapsed, handleMainBlankPointerDown } =
    useEcomStudioAssistantCollapse(assistantStreaming);
  const [currentStepId, setCurrentStepId] = useState<HandCraftStepId>("hero");
  const [focusStepId, setFocusStepId] = useState<HandCraftStepId | null>(null);
  const [generateRequest, setGenerateRequest] = useState<{
    stepId: HandCraftStepId;
    token: number;
  } | null>(null);

  useEffect(() => {
    if (!focusStepId) return;
    const timer = window.setTimeout(() => setFocusStepId(null), 800);
    return () => window.clearTimeout(timer);
  }, [focusStepId]);

  const applyProject = useCallback((p: HandCraftProject) => {
    setProject(p);
    setCurrentStepId(inferCurrentStepId(p));
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
    if (p.settings.imageModelKey) setImageModelKey(p.settings.imageModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: HandCraftProject) => {
      applyProject(initial ?? (await getHandCraftProject(id)));
    },
    [applyProject],
  );

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await fetchHandCraftModels();
      setChatModels(models.chatModels);
      setImageModels(models.imageModels);
      setConcurrencyLimit(models.imageGenConcurrencyLimit);
      setChatModelKey((prev) => pickBoundStoryboardModelKey(models.chatModels, prev));
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
        const savedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PROJECT_STORAGE_KEY)
            : null;

        let initial: HandCraftProject | undefined;
        let projectId: string | null = null;

        if (savedId) {
          try {
            initial = await getHandCraftProject(savedId);
            projectId = initial.id;
          } catch {
            /* 会话里的 id 已失效，走列表 */
          }
        }
        if (!projectId) {
          const summaries = await listHandCraftProjectSummaries();
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
  }, [alert, loadModels, reload]);

  async function handleNewProject() {
    setLoading(true);
    setEmpty(false);
    try {
      const created = await createHandCraftProject({ title: "手伴创作" });
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
    const items = await listHandCraftProjectSummaries();
    return items.map((p) => ({
      id: p.id,
      title: p.title?.trim() || "手伴创作",
      updatedAt: p.updatedAt,
      thumbnailUrl: p.thumbnailUrl,
    }));
  }, []);

  async function handleOpenProject(id: string) {
    if (project?.id === id) return;
    if (assistantStreaming) {
      await alert({
        title: "请稍候",
        message: "请等待助手完成当前输出后再切换项目。",
        variant: "error",
      });
      return;
    }
    setLoading(true);
    try {
      await reload(id);
      setEmpty(false);
      setAssistantWide(false);
      setFocusStepId(null);
      setGenerateRequest(null);
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
      title: "删除手伴创作项目",
      message: `将删除「${project.title?.trim() || "手伴创作"}」的 10 步产出记录与会话。`,
      secondTitle: "不可恢复",
      secondMessage:
        "删除后项目记录无法找回；已生成的图片仍保留在云端存储（OSS）与「我的资产」中。是否继续？",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setLoading(true);
    try {
      await deleteHandCraftProject(project.id);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PROJECT_STORAGE_KEY);
      }
      const summaries = await listHandCraftProjectSummaries();
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

  async function handleRefUpload(file: File) {
    if (!project) return;
    /** 换主线稿 = 重启流程，须先确认；追加线稿只是补参考 */
    const isMainSketch = project.references.length === 0;
    let resetFlow = false;
    if (!isMainSketch) {
      const state = project.plan?.steps ?? {};
      const hasOutput = Object.values(state).some(
        (s) => s?.slots?.some((slot) => slot.imageUrl) || s?.outputs?.length,
      );
      if (hasOutput) {
        resetFlow = await confirm({
          title: "更换主线稿？",
          message:
            "本项目已有成图。若这张线稿是新的主线稿，会重置 10 步产出与主形象锁定（已出图仍留在资产库）；如只是补充参考，请选「取消」后先删掉旧线稿。",
          confirmLabel: "作为新主线稿并重置",
        });
        if (!resetFlow) return;
      }
    }

    setRefBusy(true);
    setUploadProgress(10);
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
    }, 180);
    try {
      const { project: next } = await uploadHandCraftSketch(project.id, file, {
        resetFlow,
      });
      setUploadProgress(100);
      applyProject(next);
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "无法上传线稿",
        variant: "error",
      });
    } finally {
      window.clearInterval(tick);
      setRefBusy(false);
      window.setTimeout(() => setUploadProgress(null), 450);
    }
  }

  async function handleAttachSketches(assetIds: string[]) {
    if (!project || assetIds.length === 0) return;
    setRefBusy(true);
    try {
      const next = await attachHandCraftSketchesFromAssets(project.id, assetIds);
      applyProject(next);
    } catch (e) {
      await alert({
        title: "添加失败",
        message: e instanceof Error ? e.message : "无法从资产添加线稿",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  function projectHasGeneratedOutput(p: HandCraftProject): boolean {
    const state = p.plan?.steps ?? {};
    return Object.values(state).some(
      (s) => s?.slots?.some((slot) => slot.imageUrl) || (s?.outputs?.length ?? 0) > 0,
    );
  }

  async function handleGenerateSketch(prompt: string) {
    if (!project) return;

    let resetFlow = false;
    if (project.references.length > 0 && projectHasGeneratedOutput(project)) {
      resetFlow = await confirm({
        title: "重新生成主线稿？",
        message:
          "本项目已有成图。重新生成并替换第 1 张线稿会重置 10 步产出与主形象锁定（已出图仍留在资产库）。是否继续？",
        confirmLabel: "重新生成并重置",
      });
      if (!resetFlow) return;
    }

    setSketchGenBusy(true);
    setRefBusy(true);
    try {
      const { project: next } = await generateHandCraftSketch(project.id, prompt, {
        resetFlow,
      });
      applyProject(next);
    } catch (e) {
      await alert({
        title: "生成线稿失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
      throw e;
    } finally {
      setSketchGenBusy(false);
      setRefBusy(false);
    }
  }

  async function handleRefRemove(refId: string) {
    if (!project) return;
    const ok = await doubleConfirm({
      title: "删除线稿",
      message: "确定从本项目移除这张线稿？",
      secondTitle: "不可恢复",
      secondMessage:
        "删除后需重新上传；已上传文件仍保留在云端存储（OSS）。是否继续？",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setRefBusy(true);
    try {
      await removeHandCraftSketch(project.id, refId);
      await reload(project.id);
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "无法删除线稿",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  const changeCurrentStep = useCallback(
    async (stepId: HandCraftStepId) => {
      setCurrentStepId(stepId);
      setFocusStepId(stepId);
      if (!project) return;
      try {
        const next = await updateHandCraftProject(project.id, {
          meta: { workflow: { currentStepId: stepId } },
        });
        setProject(next);
      } catch {
        /* 当前步只是引导态，写失败不阻塞操作 */
      }
    },
    [project],
  );

  if (needLogin) {
    return (
      <EcomLoginPrompt
        returnPath={ENTRY_PATH}
        message="使用手伴创作需要登录。请点击下方按钮，经主站 Book 完成 SSO 后自动回到本页。"
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
          <h2 className="text-xl font-semibold text-[#1d1d1f]">手伴创作</h2>
          <p className="max-w-md text-sm text-[#6e6e73]">
            上传一张手绘线稿，分 10 步做出潮玩盲盒 IP 全案：主形象、规范三件套、盲盒卡、周边样机、包装、表情包，直到小红书长图、12 页作品集与招商授权页。
          </p>
          <EcomButtonSecondary
            type="button"
            onClick={() => void handleNewProject()}
            disabled={loading}
          >
            {loading ? "创建中…" : "开始创作"}
          </EcomButtonSecondary>
        </div>
      </EcomWorkspaceLayout>
    );
  }

  return (
    <>
    <EcomWorkspaceLayout
      assistantWide={assistantWide}
      assistantCollapsed={assistantCollapsed}
      onMainBlankPointerDown={handleMainBlankPointerDown}
      progress={
        <HandCraftProgressRail
          project={project}
          currentStepId={currentStepId}
          onStepClick={(id) => void changeCurrentStep(id)}
        />
      }
      assistant={
        <HandCraftAssistantPanel
          key={project.id}
          project={project}
          currentStepId={currentStepId}
          chatModels={chatModels}
          chatModelKey={chatModelKey}
          composerWide={assistantWide}
          onComposerWideChange={setAssistantWide}
          collapsed={assistantCollapsed}
          onCollapsedChange={setAssistantCollapsed}
          onStreamingChange={setAssistantStreaming}
          onProjectChange={async () => {
            await reload(project.id);
          }}
          onCurrentStepChange={changeCurrentStep}
          onRequestGenerateStep={(stepId) =>
            setGenerateRequest((prev) => ({
              stepId,
              token: (prev?.token ?? 0) + 1,
            }))
          }
          onAlert={alert}
        />
      }
    >
      <HandCraftContentPanel
        project={project}
        currentStepId={currentStepId}
        imageModels={imageModels}
        imageModelKey={imageModelKey}
        onImageModelChange={(key) => {
          setImageModelKey(key);
          updateHandCraftProject(project.id, {
            settings: { imageModelKey: key },
          }).catch(() => undefined);
        }}
        modelsLoading={modelsLoading}
        modelsLoadError={modelsLoadError}
        onRefreshModels={loadModels}
        imageGenConcurrencyLimit={concurrencyLimit}
        onRefUpload={handleRefUpload}
        onRefRemove={handleRefRemove}
        onAttachSketches={handleAttachSketches}
        onGenerateSketch={handleGenerateSketch}
        refBusy={refBusy}
        sketchGenBusy={sketchGenBusy}
        uploadProgress={uploadProgress}
        onNewProject={() => void handleNewProject()}
        loadProjectList={loadProjectList}
        onOpenProject={(id) => void handleOpenProject(id)}
        onDeleteProject={() => void handleDeleteProject()}
        onProjectChange={async () => {
          await reload(project.id);
        }}
        streaming={assistantStreaming}
        generateRequest={generateRequest}
        focusStepId={focusStepId}
        onShareWorkflow={() => setWorkflowShareOpen(true)}
      />
    </EcomWorkspaceLayout>
    <WorkflowShareLinkDialog
      projectId={project.id}
      projectTitle={project.title?.trim() || "手伴创作"}
      open={workflowShareOpen}
      onClose={() => setWorkflowShareOpen(false)}
      resourceType={ECOM_WORKFLOW_SHARE_RESOURCE.handCraft}
      description={ECOM_WORKFLOW_SHARE_DESCRIPTION[ECOM_WORKFLOW_SHARE_RESOURCE.handCraft]}
    />
    </>
  );
}
