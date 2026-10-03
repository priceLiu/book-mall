"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { IpMasterContentPanel } from "@/components/ip-master/ip-master-content-panel";
import { IpMasterProgressRail } from "@/components/ip-master/ip-master-progress-rail";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import {
  createIpMasterProject,
  deleteIpMasterProject,
  fetchIpMasterModels,
  generateIpMasterBenchmark,
  generateIpMasterTemplate,
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
import {
  ipMasterProjectHasWork,
  normalizeIpMasterBrief,
  parseIpMasterInputMode,
  validateIpMasterInputForExtract,
  type IpMasterInputMode,
} from "@/lib/ip-master-input-presets";
import type {
  IpMasterRegenerateTarget,
  IpMasterTemplate,
} from "@/lib/ip-master-template-types";
import { readDraftTemplateFromProject } from "@/lib/ip-master-template-types";
import type { IpMasterProject, IpMasterStepId } from "@/lib/ip-master-types";
import { inferIpMasterCurrentStep } from "@/lib/ip-master-workflow";
import {
  isIpMasterVisionChatModel,
  pickIpMasterTemplateChatModel,
} from "@/lib/ip-master-template-chat-model";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-ip-master-active-project";

export function IpMasterStudio() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const [project, setProject] = useState<IpMasterProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState("");
  const [defaultVisionChatModelKey, setDefaultVisionChatModelKey] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [benchmarkGenBusy, setBenchmarkGenBusy] = useState(false);
  const [templateGenBusy, setTemplateGenBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saveVersionBusy, setSaveVersionBusy] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<IpMasterStepId>("input");
  const [draftTemplate, setDraftTemplate] = useState<IpMasterTemplate | null>(null);

  const applyProject = useCallback((p: IpMasterProject) => {
    setProject(p);
    setCurrentStepId(inferIpMasterCurrentStep(p));
    setDraftTemplate(readDraftTemplateFromProject(p));
    writeEcomLastProjectId(PROJECT_STORAGE_KEY, p.id);
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: IpMasterProject, opts?: { preserveStep?: boolean }) => {
      const p = initial ?? (await getIpMasterProject(id));
      setProject(p);
      writeEcomLastProjectId(PROJECT_STORAGE_KEY, p.id);
      if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
      setDraftTemplate(readDraftTemplateFromProject(p));
      if (!opts?.preserveStep) {
        setCurrentStepId(inferIpMasterCurrentStep(p));
      }
    },
    [],
  );

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await fetchIpMasterModels();
      setChatModels(models.chatModels);
      setDefaultVisionChatModelKey(models.defaultVisionChatModelKey ?? "qwen3.8-max");
      setChatModelKey((prev) =>
        pickIpMasterTemplateChatModel({
          models: models.chatModels,
          preferred: prev || models.defaultChatModelKey,
          hasBenchmark: Boolean(project?.references.length),
          defaultChatModelKey: models.defaultChatModelKey,
          defaultVisionChatModelKey: models.defaultVisionChatModelKey,
        }),
      );
    } finally {
      setModelsLoading(false);
    }
  }, [project?.references.length]);

  useEffect(() => {
    if (!project?.references.length || chatModels.length === 0) return;
    if (isIpMasterVisionChatModel(chatModelKey)) return;
    setChatModelKey(
      pickIpMasterTemplateChatModel({
        models: chatModels,
        preferred: chatModelKey,
        hasBenchmark: true,
        defaultChatModelKey: "",
        defaultVisionChatModelKey,
      }),
    );
  }, [project?.references.length, chatModels, chatModelKey, defaultVisionChatModelKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadModels();
        const savedId = readEcomLastProjectId(PROJECT_STORAGE_KEY);
        let initial: IpMasterProject | undefined;
        if (savedId) {
          try {
            initial = await getIpMasterProject(savedId);
          } catch {
            clearEcomLastProjectId(PROJECT_STORAGE_KEY);
          }
        }
        if (cancelled) return;
        if (initial) {
          applyProject(initial);
          setEmpty(false);
        } else {
          const summaries = await listIpMasterProjectSummaries();
          if (summaries[0]) {
            await reload(summaries[0].id);
            setEmpty(false);
          } else setEmpty(true);
        }
      } catch (e) {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
        else if (!cancelled) {
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
  }, [alert, applyProject, loadModels, reload]);

  async function handleNewProject() {
    const hasWork = project ? ipMasterProjectHasWork(project, "") : false;
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
    if (project?.id === id) return;
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

  function draftPayloadForPersist(t: IpMasterTemplate) {
    const { imagePrompt, ...structured } = t;
    return {
      draftTemplate: structured as unknown as Record<string, unknown>,
      draftImagePrompt: imagePrompt,
    };
  }

  async function changeStep(stepId: IpMasterStepId) {
    setCurrentStepId(stepId);
    if (!project || !draftTemplate) return;
    const { draftTemplate: dt, draftImagePrompt } = draftPayloadForPersist(draftTemplate);
    await updateIpMasterProject(project.id, {
      meta: {
        ...(project.meta ?? {}),
        workflow: {
          ...(project.meta?.workflow ?? {}),
          currentStepId: stepId,
          draftTemplate: dt,
          draftImagePrompt,
        },
      },
    }).catch(() => undefined);
  }

  async function persistDraftTemplate(t: IpMasterTemplate) {
    setDraftTemplate(t);
    if (!project) return;
    const { draftTemplate: dt, draftImagePrompt } = draftPayloadForPersist(t);
    setProject({
      ...project,
      meta: {
        ...(project.meta ?? {}),
        workflow: {
          ...(project.meta?.workflow ?? {}),
          draftTemplate: dt,
          draftImagePrompt,
        },
      },
    });
  }

  async function handleSaveVersion(libraryLabel: string) {
    if (!project || !draftTemplate) return;
    if (project.references.length === 0) {
      await alert({
        title: "无法保存",
        message: "母版库条目须同时包含基准图与结构化模板。请先上传或生成基准图。",
        variant: "error",
      });
      return;
    }
    setSaveVersionBusy(true);
    try {
      const tpl = {
        ...draftTemplate,
        ipMeta: {
          ...draftTemplate.ipMeta,
          ipId: project.id,
          baseImageUrl: project.references[0]!.ossUrl,
        },
      };
      const next = await saveIpMasterTemplate(project.id, tpl, {
        imagePrompt: draftTemplate.imagePrompt,
        libraryLabel,
      });
      applyProject(next);
      toast({
        title: "已写入我的资产 · 母版库",
        message: `「${libraryLabel}」已保存，可在「我的资产 → 母版库」查看；手办 / 品牌 VI 可从此导入。`,
        variant: "success",
      });
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
    const inputMode = parseIpMasterInputMode(project.brief?.inputMode);
    const next = await updateIpMasterProject(project.id, {
      brief: { ...(project.brief ?? {}), description: text, inputMode },
    });
    setProject(next);
  }

  async function handleInputModeChange(mode: IpMasterInputMode) {
    if (!project) return;
    const next = await updateIpMasterProject(project.id, {
      brief: { ...(project.brief ?? {}), inputMode: mode },
    });
    setProject(next);
  }

  async function handleGenerateBenchmark() {
    if (!project || !draftTemplate) return;
    const positive = draftTemplate.imagePrompt?.positive?.trim();
    if (!positive) {
      await alert({
        title: "无法生成",
        message: "请先在审阅页填写或生成生图正向提示词。",
        variant: "error",
      });
      return;
    }
    setBenchmarkGenBusy(true);
    try {
      const next = await generateIpMasterBenchmark(project.id, {
        imagePrompt: draftTemplate.imagePrompt,
      });
      applyProject(next);
      toast({ title: "基准立绘已生成", message: "已写入基准图槽位。", variant: "success" });
    } catch (e) {
      await alert({
        title: "生成失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setBenchmarkGenBusy(false);
    }
  }

  async function runTemplateGenerate(regenerateTarget?: IpMasterRegenerateTarget) {
    if (!project || !draftTemplate) return;
    const mode = parseIpMasterInputMode(project.brief?.inputMode);
    const briefText =
      typeof project.brief?.description === "string" ? project.brief.description : "";
    const err = validateIpMasterInputForExtract({
      mode,
      hasBenchmark: project.references.length > 0,
      briefText,
    });
    if (err) {
      void alert({ title: "无法生成", message: err, variant: "error" });
      return;
    }
    const { draftTemplate: dt, draftImagePrompt } = draftPayloadForPersist(draftTemplate);
    setTemplateGenBusy(true);
    try {
      const { project: next, template, imagePrompt } = await generateIpMasterTemplate(
        project.id,
        {
          modelKey: chatModelKey || undefined,
          regenerateTarget,
          draftTemplate: regenerateTarget ? dt : undefined,
          draftImagePrompt: regenerateTarget ? draftImagePrompt : undefined,
        },
      );
      const merged = { ...template, imagePrompt };
      applyProject(next);
      setDraftTemplate(merged);
      setCurrentStepId("review");
      toast({
        title: regenerateTarget ? "已重新生成" : "草稿已生成",
        message: "请确认生图提示词与结构化字段，再生成基准图或保存入库。",
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "生成失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setTemplateGenBusy(false);
    }
  }

  async function handleGenerateTemplate() {
    await runTemplateGenerate(undefined);
  }

  async function handleRegenerateTemplate(target: IpMasterRegenerateTarget) {
    await runTemplateGenerate(target);
  }

  if (needLogin) return <EcomLoginPrompt returnPath="/brand/ip" />;
  if (loading && !project) return <ProductCreationStudioSkeleton />;
  if (empty) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">IP 母版</h1>
        <p className="max-w-md text-center text-sm text-[#6e6e73]">
          傻瓜式输入 → 大模型生成结构化模板 → 保存基准图与模板进母版库，供手办 / 品牌 VI 导入。
        </p>
        <EcomButtonPrimary type="button" onClick={() => void handleStartFirst()}>
          开始第一个母版
        </EcomButtonPrimary>
      </div>
    );
  }
  if (!project || !draftTemplate) return <ProductCreationStudioSkeleton />;

  return (
    <EcomWorkspaceLayout
      fullWidth
      progress={
        <IpMasterProgressRail
          currentStepId={currentStepId}
          onStepClick={(id) => void changeStep(id)}
        />
      }
    >
      <IpMasterContentPanel
        project={project}
        currentStepId={currentStepId}
        draftTemplate={draftTemplate}
        onDraftTemplateChange={(t) => void persistDraftTemplate(t)}
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
        onBriefChange={handleBriefChange}
        inputMode={parseIpMasterInputMode(project.brief?.inputMode)}
        onInputModeChange={(mode) => void handleInputModeChange(mode)}
        onGenerateBenchmark={handleGenerateBenchmark}
        benchmarkGenBusy={benchmarkGenBusy}
        onGenerateTemplate={() => void handleGenerateTemplate()}
        onRegenerateTemplate={(t) => void handleRegenerateTemplate(t)}
        templateGenBusy={templateGenBusy}
        modelsLoading={modelsLoading}
        chatModelKey={chatModelKey}
        onChatModelKeyChange={setChatModelKey}
        chatModels={chatModels}
      />
    </EcomWorkspaceLayout>
  );
}
