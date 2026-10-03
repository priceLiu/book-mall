"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { IpMasterAssistantPanel } from "@/components/ip-master/ip-master-assistant-panel";
import { IpMasterContentPanel } from "@/components/ip-master/ip-master-content-panel";
import { IpMasterProgressRail } from "@/components/ip-master/ip-master-progress-rail";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import { useEcomStudioAssistantCollapse } from "@/lib/ecom-assistant-collapse";
import { ECOM_DEFAULT_CHAT_MODEL_KEY } from "@/lib/ecom-assistant-models";
import {
  createIpMasterProject,
  deleteIpMasterProject,
  fetchIpMasterModels,
  getIpMasterProject,
  listIpMasterProjectSummaries,
  saveIpMasterTemplate,
  saveIpMasterWorkflow,
  updateIpMasterProject,
  uploadIpMasterBenchmark,
} from "@/lib/ecom-ip-master-api";
import {
  clearEcomLastProjectId,
  readEcomLastProjectId,
  writeEcomLastProjectId,
} from "@/lib/ecom-last-project";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import type { IpMasterProject, IpMasterStepId } from "@/lib/ip-master-types";
import {
  activeTemplateMarkdown,
  inferIpMasterCurrentStep,
} from "@/lib/ip-master-workflow";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-ip-master-active-project";

export function IpMasterStudio() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const [project, setProject] = useState<IpMasterProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState(ECOM_DEFAULT_CHAT_MODEL_KEY);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saveVersionBusy, setSaveVersionBusy] = useState(false);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantWide, setAssistantWide] = useState(false);
  const { assistantCollapsed, setAssistantCollapsed, handleMainBlankPointerDown } =
    useEcomStudioAssistantCollapse(assistantStreaming);
  const [currentStepId, setCurrentStepId] = useState<IpMasterStepId>("input");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [extractInject, setExtractInject] = useState<{ text: string; token: number } | null>(
    null,
  );

  const applyProject = useCallback((p: IpMasterProject) => {
    setProject(p);
    setCurrentStepId(inferIpMasterCurrentStep(p));
    setDraftMarkdown(
      p.meta?.workflow?.draftMarkdown?.trim() || activeTemplateMarkdown(p) || "",
    );
    writeEcomLastProjectId(PROJECT_STORAGE_KEY, p.id);
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: IpMasterProject, opts?: { preserveStep?: boolean }) => {
      const p = initial ?? (await getIpMasterProject(id));
      setProject(p);
      writeEcomLastProjectId(PROJECT_STORAGE_KEY, p.id);
      if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
      setDraftMarkdown(
        p.meta?.workflow?.draftMarkdown?.trim() || activeTemplateMarkdown(p) || "",
      );
      if (!opts?.preserveStep) {
        setCurrentStepId(inferIpMasterCurrentStep(p));
      }
    },
    [],
  );

  const syncProjectFromServer = useCallback(async () => {
    const id = project?.id;
    if (!id) return;
    try {
      await reload(id, undefined, { preserveStep: true });
    } catch (e) {
      await alert({
        title: "项目同步失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    }
  }, [alert, project?.id, reload]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await fetchIpMasterModels();
      setChatModels(models.chatModels);
      setChatModelKey((prev) =>
        pickBoundStoryboardModelKey(models.chatModels, prev || models.defaultChatModelKey),
      );
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
        let initial: IpMasterProject | undefined;
        let projectId: string | null = null;
        if (savedId) {
          try {
            initial = await getIpMasterProject(savedId);
            projectId = initial.id;
          } catch {
            /* stale */
          }
        }
        if (!projectId) {
          const summaries = await listIpMasterProjectSummaries();
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
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
        else {
          await alert({
            title: "加载失败",
            message: formatEcomTransportError(e),
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
    const hasWork =
      Boolean(project?.references?.length) ||
      Boolean(draftMarkdown.trim()) ||
      (project?.meta?.templateVersions?.length ?? 0) > 0;
    await runEcomNewProjectWithSavePrompt({
      confirm,
      hasWorkToSave: Boolean(project && hasWork),
      message: "当前项目尚未保存工作流。是否先保存到「我的资产」？",
      save: async () => {
        if (!project) return;
        const snapshot = await saveIpMasterWorkflow(
          project.id,
          project.title?.trim() || "IP母版",
        );
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
          const created = await createIpMasterProject({ title: "IP 母版" });
          applyProject(created);
        } catch (e) {
          await alert({
            title: "新建失败",
            message: formatEcomTransportError(e),
            variant: "error",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function handleStartFirst() {
    setLoading(true);
    try {
      const created = await createIpMasterProject({ title: "IP 母版" });
      applyProject(created);
      setEmpty(false);
    } catch (e) {
      await alert({
        title: "创建失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const loadProjectList = useCallback(async () => {
    const items = await listIpMasterProjectSummaries();
    return items.map((p) => ({
      id: p.id,
      title: p.title?.trim() || "IP 母版",
      updatedAt: p.updatedAt,
      thumbnailUrl: p.thumbnailUrl,
    }));
  }, []);

  async function handleOpenProject(id: string) {
    if (project?.id === id || assistantStreaming) return;
    setLoading(true);
    try {
      await reload(id);
      setEmpty(false);
    } catch (e) {
      await alert({
        title: "打开失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    const ok = await doubleConfirm({
      title: "删除 IP 母版项目",
      message: `将删除「${project.title?.trim() || "IP 母版"}」的模板与会话。`,
      secondTitle: "不可恢复",
      secondMessage: "删除后项目记录无法找回；已保存的工作流镜像仍可在「我的资产」中查看。",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setLoading(true);
    try {
      await deleteIpMasterProject(project.id);
      clearEcomLastProjectId(PROJECT_STORAGE_KEY);
      const summaries = await listIpMasterProjectSummaries();
      if (summaries[0]) await reload(summaries[0].id);
      else {
        setProject(null);
        setEmpty(true);
      }
    } catch (e) {
      await alert({
        title: "删除失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefUpload(file: File) {
    if (!project) return;
    setRefBusy(true);
    setUploadProgress(10);
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
    }, 180);
    try {
      const next = await uploadIpMasterBenchmark(project.id, file);
      applyProject(next);
      setUploadProgress(100);
    } catch (e) {
      await alert({
        title: "上传失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      window.clearInterval(tick);
      setRefBusy(false);
      window.setTimeout(() => setUploadProgress(null), 450);
    }
  }

  async function changeStep(stepId: IpMasterStepId) {
    setCurrentStepId(stepId);
    if (!project) return;
    await updateIpMasterProject(project.id, {
      meta: {
        ...(project.meta ?? {}),
        workflow: {
          ...(project.meta?.workflow ?? {}),
          currentStepId: stepId,
          draftMarkdown,
        },
      },
    }).catch(() => undefined);
  }

  async function persistDraftMarkdown(md: string) {
    setDraftMarkdown(md);
    if (!project) return;
    setProject({
      ...project,
      meta: {
        ...(project.meta ?? {}),
        workflow: {
          ...(project.meta?.workflow ?? {}),
          draftMarkdown: md,
        },
      },
    });
  }

  async function handleSaveVersion() {
    if (!project || !draftMarkdown.trim()) return;
    setSaveVersionBusy(true);
    try {
      const next = await saveIpMasterTemplate(project.id, draftMarkdown);
      applyProject(next);
      toast({ title: "版本已保存", message: "模板新版本已写入项目。", variant: "success" });
      setCurrentStepId("versions");
    } catch (e) {
      await alert({
        title: "保存失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setSaveVersionBusy(false);
    }
  }

  async function handleSaveWorkflow(ipName: string) {
    if (!project) return;
    const snapshot = await saveIpMasterWorkflow(project.id, ipName);
    toast({
      title: "工作流已保存",
      message: `「${snapshot.title}」已写入我的资产。`,
      variant: "success",
    });
  }

  async function handleBriefChange(text: string) {
    if (!project) return;
    const next = await updateIpMasterProject(project.id, {
      brief: { ...(project.brief ?? {}), description: text },
    });
    setProject(next);
  }

  function handleRequestExtract() {
    setCurrentStepId("extract");
    setExtractInject((prev) => ({
      text: "请根据当前基准图与 Brief，按 IP 母版 Skill 输出完整 Markdown 模板（可直接保存为版本）。",
      token: (prev?.token ?? 0) + 1,
    }));
  }

  if (needLogin) return <EcomLoginPrompt returnPath="/brand/ip" />;
  if (loading && !project) return <ProductCreationStudioSkeleton />;
  if (empty) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">IP 母版</h1>
        <p className="max-w-md text-center text-sm text-[#6e6e73]">
          建立固定基准图与 Markdown 模板版本，供手办盲盒 SOP 与品牌VI表情包SOP 载入。
        </p>
        <EcomButtonPrimary type="button" onClick={() => void handleStartFirst()}>
          开始第一个母版
        </EcomButtonPrimary>
      </div>
    );
  }
  if (!project) return <ProductCreationStudioSkeleton />;

  return (
    <EcomWorkspaceLayout
      assistantWide={assistantWide}
      assistantCollapsed={assistantCollapsed}
      onMainBlankPointerDown={handleMainBlankPointerDown}
      progress={
        <IpMasterProgressRail
          currentStepId={currentStepId}
          onStepClick={(id) => void changeStep(id)}
        />
      }
      assistant={
        <IpMasterAssistantPanel
          key={project.id}
          project={project}
          chatModels={chatModels}
          chatModelKey={chatModelKey}
          composerWide={assistantWide}
          onComposerWideChange={setAssistantWide}
          collapsed={assistantCollapsed}
          onCollapsedChange={setAssistantCollapsed}
          onStreamingChange={setAssistantStreaming}
          onProjectChange={syncProjectFromServer}
          onAssistantMarkdown={(md) => void persistDraftMarkdown(md)}
          onAlert={alert}
          injectUserMessage={extractInject}
        />
      }
    >
      <IpMasterContentPanel
        project={project}
        currentStepId={currentStepId}
        draftMarkdown={draftMarkdown}
        onDraftMarkdownChange={(md) => void persistDraftMarkdown(md)}
        onStepChange={(id) => void changeStep(id)}
        onRefUpload={handleRefUpload}
        refBusy={refBusy}
        uploadProgress={uploadProgress}
        onSaveVersion={handleSaveVersion}
        saveVersionBusy={saveVersionBusy}
        onSaveWorkflow={handleSaveWorkflow}
        onNewProject={() => void handleNewProject()}
        loadProjectList={loadProjectList}
        onOpenProject={(id) => void handleOpenProject(id)}
        onDeleteProject={() => void handleDeleteProject()}
        onRequestExtract={handleRequestExtract}
        onBriefChange={handleBriefChange}
        streaming={assistantStreaming}
      />
    </EcomWorkspaceLayout>
  );
}
