"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { SeedVideoAssistantPanel } from "@/components/seed-video/seed-video-assistant-panel";
import { SeedVideoContentPanel } from "@/components/seed-video/seed-video-content-panel";
import { SeedVideoProgressRail } from "@/components/seed-video/seed-video-progress-rail";
import { SeedVideoSkillPickerDialog } from "@/components/seed-video/seed-video-skill-picker-dialog";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createSeedVideoProject,
  fetchSeedVideoModels,
  getSeedVideoProject,
  listSeedVideoProjectSummaries,
  removeSeedVideoRef,
  attachSeedVideoRefsFromAssets,
  updateSeedVideoProject,
  uploadSeedVideoRef,
} from "@/lib/ecom-seed-video-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { commitFormalScriptFromRows } from "@/lib/seed-video-formal-script-commit";
import {
  parseSeedVideoTargetDurationFromText,
  resolveSeedVideoTargetDurationSec,
} from "@/lib/seed-video-duration";
import { inferAssistantChoices, isDirectMode, resolveSeedVideoPlanningPrompt, resolveSeedVideoVideoModelKey } from "@/lib/seed-video-workflow";
import {
  readStoryboardDraftFromMeta,
  resolveStoryboardDraftRows,
  serializeFormalScriptTable,
  type SeedVideoStoryboardDraftRow,
} from "@/lib/seed-video-storyboard-parse";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import {
  getSeedVideoSkillDefinition,
  seedVideoSkillLabel,
  type SeedVideoSkillKey,
} from "@/lib/seed-video-skills";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-seed-video-active-project";

export function SeedVideoStudio() {
  const { alert, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<SeedVideoProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState("qwen3.8-max");
  const [videoModelKey, setVideoModelKey] = useState("wan2.7-r2v");
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantWide, setAssistantWide] = useState(false);
  const [planningPrompt, setPlanningPrompt] = useState("");
  const [startPlanningToken, setStartPlanningToken] = useState(0);
  const [openProductionAfterSyncToken, setOpenProductionAfterSyncToken] = useState(0);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const planningPromptRef = useRef("");
  const planningLaunchRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const activeProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!assistantStreaming) planningLaunchRef.current = false;
  }, [assistantStreaming]);

  const applyProject = useCallback((p: SeedVideoProject) => {
    activeProjectIdRef.current = p.id;
    setProject(p);
    setPlanningPrompt(resolveSeedVideoPlanningPrompt(p));
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
    if (p.settings.videoModelKey) setVideoModelKey(p.settings.videoModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: SeedVideoProject) => {
      const generation = loadGenerationRef.current;
      const data = initial ?? (await getSeedVideoProject(id));
      if (generation !== loadGenerationRef.current) return;
      if (activeProjectIdRef.current && activeProjectIdRef.current !== id) return;
      applyProject(data);
    },
    [applyProject],
  );

  const reloadActiveProject = useCallback(async () => {
    const id = activeProjectIdRef.current;
    if (!id) return;
    await reload(id);
  }, [reload]);

  useEffect(() => {
    planningPromptRef.current = planningPrompt;
  }, [planningPrompt]);

  useEffect(() => {
    if (!project?.id) return;
    const prompt = planningPrompt.trim();
    if (!prompt) return;
    const timer = window.setTimeout(() => {
      void updateSeedVideoProject(project.id, {
        meta: { planningPrompt: prompt },
      }).catch(() => {
        /* 本地草稿，静默失败 */
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [planningPrompt, project?.id]);

  useEffect(() => {
    if (!project?.id) return;
    const flushPlanningPrompt = () => {
      const prompt = planningPromptRef.current.trim();
      if (!prompt) return;
      void updateSeedVideoProject(project.id, {
        meta: { planningPrompt: prompt },
      }).catch(() => {});
    };
    window.addEventListener("pagehide", flushPlanningPrompt);
    return () => window.removeEventListener("pagehide", flushPlanningPrompt);
  }, [project?.id]);

  const reloadOnMount = useCallback(
    async (id: string, initial?: SeedVideoProject) => {
      const data = initial ?? (await getSeedVideoProject(id));
      applyProject(data);
    },
    [applyProject],
  );

  useEffect(() => {
    let cancelled = false;

    void fetchSeedVideoModels()
      .then((models) => {
        if (cancelled) return;
        setChatModels(models.chatModels);
        setVideoModels(models.videoModels);
        const chatDefault = models.defaults?.chat;
        setChatModelKey((prev) =>
          pickBoundStoryboardModelKey(
            models.chatModels,
            chatDefault && models.chatModels.some((m) => m.modelKey === chatDefault)
              ? chatDefault
              : prev,
          ),
        );
        const videoDefault = models.defaults?.video ?? "wan2.7-r2v";
        setVideoModelKey((prev) =>
          pickBoundStoryboardModelKey(
            models.videoModels,
            videoDefault && models.videoModels.some((m) => m.modelKey === videoDefault)
              ? videoDefault
              : prev,
          ),
        );
      })
      .catch(() => {
        /* 模型列表后台加载 */
      });

    (async () => {
      try {
        const savedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PROJECT_STORAGE_KEY)
            : null;

        let projectId: string | null = null;
        let initial: SeedVideoProject | undefined;

        if (savedId) {
          try {
            const p = await getSeedVideoProject(savedId);
            projectId = p.id;
            initial = p;
          } catch {
            /* id 失效 */
          }
        }

        if (!projectId) {
          const summaries = await listSeedVideoProjectSummaries();
          if (summaries.length > 0) {
            projectId = summaries[0]!.id;
          }
        }

        if (cancelled) return;

        if (!projectId) {
          setEmpty(true);
          return;
        }

        await reloadOnMount(projectId, initial);
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
  }, [alert, reloadOnMount]);

  useEffect(() => {
    if (chatModels.length === 0) return;
    setChatModelKey((prev) => pickBoundStoryboardModelKey(chatModels, prev));
  }, [chatModels]);

  useEffect(() => {
    if (videoModels.length === 0) return;
    const productionMode = project?.meta?.workflow?.productionMode;
    setVideoModelKey((prev) => {
      const direct =
        productionMode === "direct"
          ? true
          : productionMode === "fine"
            ? false
            : project
              ? isDirectMode(project)
              : true;
      return resolveSeedVideoVideoModelKey(videoModels, prev, direct);
    });
  }, [videoModels, project?.meta?.workflow?.productionMode]);

  async function createProjectWithSkill(skillKey: SeedVideoSkillKey) {
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;
    setEmpty(false);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PROJECT_STORAGE_KEY);
      }
      activeProjectIdRef.current = null;
      const def = getSeedVideoSkillDefinition(skillKey);
      const created = await createSeedVideoProject({
        skillKey,
        title: def.defaultTitle,
      });
      if (generation !== loadGenerationRef.current) return;
      applyProject(created);
      setAssistantWide(false);
      setStartPlanningToken(0);
      setOpenProductionAfterSyncToken(0);
      planningLaunchRef.current = false;
    } catch (e) {
      await alert({
        title: "新建失败",
        message: e instanceof Error ? e.message : "无法创建项目",
        variant: "error",
      });
    }
  }

  function handleRequestNewProject() {
    setSkillPickerOpen(true);
  }

  const loadProjectList = useCallback(async () => {
    const items = await listSeedVideoProjectSummaries();
    return items.map((p) => ({
      id: p.id,
      title: p.title?.trim() || "种草视频项目",
      updatedAt: p.updatedAt,
      subtitle: p.skillLabel ?? seedVideoSkillLabel(p.skillKey),
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
    loadGenerationRef.current += 1;
    try {
      const data = await getSeedVideoProject(id);
      applyProject(data);
      setEmpty(false);
      setAssistantWide(false);
      setStartPlanningToken(0);
      setOpenProductionAfterSyncToken(0);
      planningLaunchRef.current = false;
    } catch (e) {
      await alert({
        title: "打开失败",
        message: e instanceof Error ? e.message : "无法打开项目",
        variant: "error",
      });
    }
  }

  async function handleUploadRef(file: File) {
    if (!project) return;
    setRefBusy(true);
    try {
      await uploadSeedVideoRef(project.id, file);
      await reloadActiveProject();
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleAttachRefs(assetIds: string[]) {
    if (!project || assetIds.length === 0) return;
    setRefBusy(true);
    try {
      await attachSeedVideoRefsFromAssets(project.id, assetIds);
      await reloadActiveProject();
    } catch (e) {
      await alert({
        title: "添加失败",
        message: e instanceof Error ? e.message : "无法从资产添加素材",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleRefRemove(refId: string) {
    if (!project) return;
    const ok = await doubleConfirm({
      title: "删除素材",
      message: "确定从本项目移除这张种草素材？",
      secondTitle: "不可恢复",
      secondMessage: "删除后需重新上传，是否继续？",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setRefBusy(true);
    try {
      await removeSeedVideoRef(project.id, refId);
      await reloadActiveProject();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "无法删除素材",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  async function handlePlanSyncedToProduction(fresh?: SeedVideoProject) {
    if (!project) return;
    if (fresh) {
      applyProject(fresh);
    } else {
      await reloadActiveProject();
    }
    setOpenProductionAfterSyncToken((t) => t + 1);
  }

  async function handleEditStoryboard() {
    if (!project) return;
    const rows = resolveStoryboardDraftRows(project);
    if (rows.length === 0) {
      await alert({
        title: "无法打开编辑",
        message: "未能从助手回复中解析分镜执行表，请点「重新生成」后再试。",
        variant: "error",
      });
      return;
    }
    try {
      const md = serializeFormalScriptTable(rows);
      await updateSeedVideoProject(project.id, {
        meta: {
          ...(project.meta ?? {}),
          storyboardDraft: rows,
          lastAssistantRaw: md,
          workflow: { ...(project.meta?.workflow ?? {}), editingStoryboard: true },
        },
      });
      await reloadActiveProject();
    } catch (e) {
      await alert({
        title: "打开编辑失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function handleSaveStoryboardDraft(rows: SeedVideoStoryboardDraftRow[]) {
    if (!project) return;
    const md = serializeFormalScriptTable(rows);
    await updateSeedVideoProject(project.id, {
      meta: {
        ...(project.meta ?? {}),
        storyboardDraft: rows,
        lastAssistantRaw: md,
      },
    });
    await reloadActiveProject();
  }

  async function handleProceedFromStoryboardEdit(rows: SeedVideoStoryboardDraftRow[]) {
    if (!project) return;
    try {
      const updated = await commitFormalScriptFromRows(project, rows);
      applyProject(updated);
      await reloadActiveProject();
    } catch (e) {
      await alert({
        title: "同步失败",
        message: e instanceof Error ? e.message : "未能同步正式脚本，请稍后重试",
        variant: "error",
      });
    }
  }

  async function handleStartPlanning() {
    if (!project) return;
    if (planningLaunchRef.current) return;
    if (assistantStreaming) {
      await alert({
        title: "策划进行中",
        message: "请等待助手完成当前输出后再操作。",
        variant: "error",
      });
      return;
    }
    const pendingChoices = inferAssistantChoices(project);
    if (pendingChoices.length > 0) {
      setAssistantWide(true);
      await alert({
        title: "请先完成当前步骤",
        message: "右侧助手区已有待选卡片，请直接点选继续，无需再次点击「开始策划」。",
      });
      return;
    }
    const materials = project.references.filter((r) => r.role === "seed-material");
    if (materials.length === 0) {
      await alert({
        title: "请先上传素材",
        message: "至少上传 1 张种草素材后再开始策划。",
        variant: "error",
      });
      return;
    }
    if (!planningPrompt.trim()) {
      await alert({
        title: "请填写 Prompt",
        message: "在中间工作区填写 Prompt（可 @ 图片引用素材）后再开始策划。",
        variant: "error",
      });
      return;
    }
    try {
      const prompt = planningPrompt.trim();
      const parsedDuration = parseSeedVideoTargetDurationFromText(prompt);
      await updateSeedVideoProject(project.id, {
        meta: { planningPrompt: prompt },
        settings: {
          ...project.settings,
          targetDurationSec:
            parsedDuration ??
            resolveSeedVideoTargetDurationSec({
              settingsTargetDurationSec: project.settings.targetDurationSec,
            }),
        },
      });
    } catch {
      /* 不阻断策划 */
    }
    planningLaunchRef.current = true;
    setAssistantWide(true);
    setStartPlanningToken((t) => t + 1);
  }

  if (needLogin) {
    return <EcomLoginPrompt returnPath="/ecom/seed-video" />;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#6e6e73]">
        加载工作台…
      </div>
    );
  }

  if (empty || !project) {
    return (
      <>
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-lg font-semibold text-[#1d1d1f]">图片生种草视频</h1>
          <p className="max-w-md text-sm text-[#6e6e73]">
            上传商品/穿搭素材，选择 Skill 策划脚本与镜头，支持方案①直接连贯成片或方案②逐镜 I2V + TTS +
            合成。
          </p>
          <EcomButtonPrimary type="button" onClick={() => setSkillPickerOpen(true)}>
            开始创作
          </EcomButtonPrimary>
        </div>
        <SeedVideoSkillPickerDialog
          open={skillPickerOpen}
          onOpenChange={setSkillPickerOpen}
          onConfirm={(skillKey) => createProjectWithSkill(skillKey)}
        />
      </>
    );
  }

  const skillLabel = seedVideoSkillLabel(project.settings.skillKey);

  return (
    <>
      <EcomWorkspaceLayout
        assistantWide={assistantWide}
        progress={<SeedVideoProgressRail project={project} />}
        assistant={
          <SeedVideoAssistantPanel
            key={project.id}
            project={project}
            chatModelKey={chatModelKey}
            onProjectChange={reloadActiveProject}
            onStreamingChange={setAssistantStreaming}
            onAlert={alert}
            composerWide={assistantWide}
            onComposerWideChange={setAssistantWide}
            startPlanningToken={startPlanningToken}
            planningPrompt={planningPrompt}
            onEditStoryboard={() => void handleEditStoryboard()}
            onPlanSyncedToProduction={(fresh) => void handlePlanSyncedToProduction(fresh)}
          />
        }
      >
        <SeedVideoContentPanel
          key={project.id}
          project={project}
          videoModels={videoModels}
          videoModelKey={videoModelKey}
          onVideoModelChange={setVideoModelKey}
          onProjectChange={reloadActiveProject}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
          onAlert={alert}
          onUploadRef={handleUploadRef}
          onRemoveRef={handleRefRemove}
          onAttachRefs={handleAttachRefs}
          refBusy={refBusy}
          planningPrompt={planningPrompt}
          onPlanningPromptChange={setPlanningPrompt}
          onStartPlanning={() => void handleStartPlanning()}
          onNewProject={() => void handleRequestNewProject()}
          skillLabel={skillLabel}
          loadProjectList={loadProjectList}
          onOpenProject={(id) => void handleOpenProject(id)}
          streaming={assistantStreaming}
          storyboardDraft={
            project.meta?.workflow?.editingStoryboard
              ? resolveStoryboardDraftRows(project)
              : readStoryboardDraftFromMeta(project.meta)
          }
          editingStoryboard={Boolean(project.meta?.workflow?.editingStoryboard)}
          onSaveStoryboardDraft={handleSaveStoryboardDraft}
          onProceedFromStoryboardEdit={handleProceedFromStoryboardEdit}
          openProductionAfterSyncToken={openProductionAfterSyncToken}
        />
      </EcomWorkspaceLayout>

      {previewVideo ? (
        <EcomVideoPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
          src={previewVideo.src}
          title={previewVideo.title}
        />
      ) : null}

      <SeedVideoSkillPickerDialog
        open={skillPickerOpen}
        onOpenChange={setSkillPickerOpen}
        onConfirm={(skillKey) => createProjectWithSkill(skillKey)}
      />
    </>
  );
}

export { PROJECT_STORAGE_KEY as SEED_VIDEO_PROJECT_STORAGE_KEY };
