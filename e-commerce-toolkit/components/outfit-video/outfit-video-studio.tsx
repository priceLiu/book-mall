"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { BackgroundGenerationProvider, useBackgroundGeneration } from "@/components/generation";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { OutfitVideoWorkspace } from "@/components/outfit-video/outfit-video-workspace";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import {
  applyOutfitSceneFusionToAll,
  attachOutfitVideoRefs,
  attachOutfitReferenceVideoAsset,
  batchGenerateOutfitVideoShots,
  clearOutfitReferenceVideo,
  createOutfitVideoProject,
  fetchOutfitVideoModels,
  fuseOutfitShotScene,
  getOutfitVideoProject,
  listOutfitVideoProjectSummaries,
  lockOutfitVideoRefs,
  patchOutfitShotSceneFusionConfig,
  patchOutfitVideoScenes,
  pollOutfitVideoRender,
  renderOutfitVideo,
  saveOutfitVideoDeliverableSnapshot,
  setOutfitReferenceVideoFromUrl,
  splitOutfitVideoScenes,
  updateOutfitVideoProject,
  uploadOutfitReferenceVideo,
  uploadOutfitSceneRefImage,
  uploadOutfitVideoRefImage,
} from "@/lib/ecom-outfit-video-api";
import type { OutfitSceneFusionMode, OutfitVideoProject } from "@/lib/ecom-outfit-video-api";
import {
  isOutfitSplitActive,
  outfitSplitTaskId,
} from "@/lib/outfit-video-split-progress";
import { isOutfitVideoMockDevUiEnabled } from "@/lib/outfit-video-mock-dev";
import {
  ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL,
  pickMediaDecomposeChatModelKey,
} from "@/lib/media-decompose-model-pick";
import type { MediaDecomposeChatModel } from "@/lib/media-decompose-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  appendSeedVideoRenderStepLog,
  resolveSeedVideoRenderPhase,
  type SeedVideoRenderProgressState,
} from "@/lib/seed-video-render-progress";
import type { SceneShot } from "@/lib/video-workflow/shot-spine";
import {
  buildOutfitShotPrefilledGeneratePrompt,
  resolveOutfitShotGeneratePrompt,
} from "@/lib/ecom-outfit-video-generate-prompts";
import {
  buildOutfitSplitSystemPromptDisplay,
  outfitSplitUserPromptDisplay,
} from "@/lib/outfit-video-split-prompts";
import {
  formatOutfitSplitPromptValidationError,
  validateOutfitSplitPrompts,
} from "@/lib/outfit-video-split-prompt-validate";
import {
  inferOutfitPhase,
  isOutfitRefsReadyToLock,
  type OutfitGarmentMode,
  type OutfitRefMode,
  type OutfitWorkflowPhase,
} from "@/lib/video-workflow/templates/outfit-v1/ui-config";

const PROJECT_STORAGE_KEY = "ecom-outfit-video-active-project";
const DEFAULT_SPLIT_SYSTEM_PROMPT = buildOutfitSplitSystemPromptDisplay();
const DEFAULT_SPLIT_USER_PROMPT = outfitSplitUserPromptDisplay();
const RENDER_POLL_MS = 2500;
const RENDER_POLL_MAX = 120;
const GENERATE_EXPECTED_MS = 3 * 60 * 1000;

function outfitGenerateTaskId(projectId: string) {
  return `outfit-video-generate-${projectId}`;
}

function outfitRenderTaskId(projectId: string) {
  return `outfit-video-render-${projectId}`;
}

export function OutfitVideoStudio() {
  return (
    <BackgroundGenerationProvider>
      <OutfitVideoStudioInner />
    </BackgroundGenerationProvider>
  );
}

function OutfitVideoStudioInner() {
  const { alert, toast, doubleConfirm, confirm } = useDialogs();
  const backgroundGen = useBackgroundGeneration();

  const [project, setProject] = useState<OutfitVideoProject | null>(null);
  const [chatModels, setChatModels] = useState<MediaDecomposeChatModel[]>([]);
  const [splitModelKey, setSplitModelKey] = useState(ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModelKey, setVideoModelKey] = useState("wan2.7-r2v");
  const [fusionModelKey, setFusionModelKey] = useState("qwen-image-edit");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const splitSubmitLockRef = useRef(false);
  /** 点击拆解后立即反馈，不等 meta / 后台任务轮询 */
  const [splitUiPending, setSplitUiPending] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [generatingIndices, setGeneratingIndices] = useState<ReadonlySet<number>>(new Set());
  const [fusingIndices, setFusingIndices] = useState<ReadonlySet<number>>(new Set());
  const [renderProgress, setRenderProgress] = useState<SeedVideoRenderProgressState | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(null);
  const [splitSystemDraft, setSplitSystemDraft] = useState(DEFAULT_SPLIT_SYSTEM_PROMPT);
  const [splitUserDraft, setSplitUserDraft] = useState(DEFAULT_SPLIT_USER_PROMPT);
  const [splitPromptErrors, setSplitPromptErrors] = useState<string[]>([]);
  const [splitPromptBusy, setSplitPromptBusy] = useState(false);
  const splitPromptSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyProject = useCallback((p: OutfitVideoProject) => {
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
  }, []);

  useEffect(() => {
    if (!project) return;
    if (project.settings.fusionModelKey) {
      setFusionModelKey(project.settings.fusionModelKey);
    }
  }, [project?.id, project?.settings.fusionModelKey]);

  useEffect(() => {
    if (!project || videoModels.length === 0) return;
    setVideoModelKey(
      pickBoundStoryboardModelKey(
        videoModels,
        project.settings.videoModelKey ?? "kling-3.0/motion-control",
      ),
    );
  }, [project?.id, project?.settings.videoModelKey, videoModels]);

  useEffect(() => {
    if (!project || chatModels.length === 0) return;
    setSplitModelKey(
      pickMediaDecomposeChatModelKey(
        chatModels,
        project.settings.splitModelKey ?? ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL,
        "video",
      ),
    );
  }, [project?.id, project?.settings.splitModelKey, chatModels]);

  useEffect(() => {
    if (!project) return;
    setSplitSystemDraft(
      project.settings.splitSystemPrompt?.trim() || DEFAULT_SPLIT_SYSTEM_PROMPT,
    );
    setSplitUserDraft(project.settings.splitUserPrompt?.trim() || DEFAULT_SPLIT_USER_PROMPT);
    setSplitPromptErrors([]);
  }, [project?.id, project?.settings.splitSystemPrompt, project?.settings.splitUserPrompt]);

  const validateSplitPromptDrafts = useCallback((system: string, user: string) => {
    const validation = validateOutfitSplitPrompts(system, user);
    setSplitPromptErrors(validation.errors);
    return validation;
  }, []);

  const persistSplitPrompts = useCallback(
    async (opts?: { system?: string; user?: string }) => {
      if (!project) return;
      const system = (opts?.system ?? splitSystemDraft).trim();
      const user = (opts?.user ?? splitUserDraft).trim();
      setSplitPromptBusy(true);
      try {
        const updated = await updateOutfitVideoProject(project.id, {
          settings: {
            ...project.settings,
            splitSystemPrompt: system === DEFAULT_SPLIT_SYSTEM_PROMPT ? undefined : system,
            splitUserPrompt: user === DEFAULT_SPLIT_USER_PROMPT ? undefined : user,
          },
        });
        applyProject(updated);
      } finally {
        setSplitPromptBusy(false);
      }
    },
    [applyProject, project, splitSystemDraft, splitUserDraft],
  );

  const scheduleSplitPromptSave = useCallback(
    (next: { system?: string; user?: string }) => {
      if (splitPromptSaveTimerRef.current) {
        clearTimeout(splitPromptSaveTimerRef.current);
      }
      const system = next.system ?? splitSystemDraft;
      const user = next.user ?? splitUserDraft;
      validateSplitPromptDrafts(system, user);
      splitPromptSaveTimerRef.current = setTimeout(() => {
        void persistSplitPrompts({ system, user });
      }, 800);
    },
    [persistSplitPrompts, splitSystemDraft, splitUserDraft, validateSplitPromptDrafts],
  );

  const flushSplitPrompts = useCallback(async () => {
    if (splitPromptSaveTimerRef.current) {
      clearTimeout(splitPromptSaveTimerRef.current);
      splitPromptSaveTimerRef.current = null;
    }
    await persistSplitPrompts();
  }, [persistSplitPrompts]);

  const phase = useMemo((): OutfitWorkflowPhase => {
    if (!project) return "upload";
    return inferOutfitPhase({
      hasReferenceVideo: Boolean(project.references.referenceVideo?.ossUrl),
      sceneCount: project.sceneList.length,
      hasDressedImage: Boolean(project.references.dressedImage?.ossUrl),
      allShotsHaveVideo:
        project.sceneList.length > 0 &&
        project.sceneList.every((s) => Boolean(s.videoUrl?.trim())),
      hasComposeVideo: Boolean(project.composeResult?.videoUrl?.trim()),
    });
  }, [project]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await fetchOutfitVideoModels();
      setVideoModels(models.videoModels);
      setChatModels(models.chatModels);
      setFusionModelKey(
        pickBoundStoryboardModelKey(
          models.fusionModels,
          models.defaults?.fusion ?? "qwen-image-edit",
        ),
      );
      setVideoModelKey((prev) =>
        pickBoundStoryboardModelKey(models.videoModels, models.defaults?.video ?? prev),
      );
      setSplitModelKey((prev) =>
        pickMediaDecomposeChatModelKey(
          models.chatModels,
          models.defaults?.split ?? prev,
          "video",
        ),
      );
    } catch (e) {
      if (isEcomUnauthorizedError(e)) setNeedLogin(true);
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
          typeof window !== "undefined" ? sessionStorage.getItem(PROJECT_STORAGE_KEY) : null;
        const p = savedId
          ? await getOutfitVideoProject(savedId)
          : await createOutfitVideoProject({ title: "穿搭视频" });
        if (!cancelled) applyProject(p);
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
  }, [applyProject, alert, loadModels]);

  const loadProjectList = useCallback(async () => {
    const items = await listOutfitVideoProjectSummaries();
    return items.map((item) => ({
      id: item.id,
      title: item.title?.trim() || "穿搭视频",
      updatedAt: item.updatedAt,
      subtitle: item.phase,
    }));
  }, []);

  async function persistVideoModelKey(key: string) {
    if (!project) return;
    const updated = await updateOutfitVideoProject(project.id, {
      settings: { ...project.settings, videoModelKey: key },
    });
    applyProject(updated);
  }

  async function handleUploadReferenceVideo(file: File) {
    if (!project) return;
    setMediaBusy(true);
    try {
      applyProject(await uploadOutfitReferenceVideo(project.id, file));
    } catch (e) {
      await alert({
        title: "上传失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleImportReferenceUrl(url: string) {
    if (!project) return;
    setMediaBusy(true);
    try {
      applyProject(await setOutfitReferenceVideoFromUrl(project.id, url));
    } catch (e) {
      await alert({
        title: "链接导入失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleAttachReferenceAsset(assetId: string) {
    if (!project) return;
    setMediaBusy(true);
    try {
      applyProject(await attachOutfitReferenceVideoAsset(project.id, assetId));
    } catch (e) {
      await alert({
        title: "挂载失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleClearReferenceVideo() {
    if (!project) return;
    if (
      !(await doubleConfirm({
        title: "删除参考视频",
        message: "确定从本项目移除参考视频？",
        secondTitle: "不可恢复",
        secondMessage: "删除后分镜与成片进度将清空，需重新上传。",
        confirmLabel: "删除",
      }))
    ) {
      return;
    }
    setMediaBusy(true);
    try {
      applyProject(await clearOutfitReferenceVideo(project.id));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setMediaBusy(false);
    }
  }

  const splittingCore = useMemo(() => {
    if (!project) return false;
    // 分镜已落库/已渲染 → 拆解 UI 必须结束（勿等 POST 返回或 poll 下一 tick）
    if (project.sceneList.length > 0) return false;
    return (
      isOutfitSplitActive(project) ||
      backgroundGen.tasks.some(
        (t) => t.status === "running" && t.id === outfitSplitTaskId(project.id),
      )
    );
  }, [backgroundGen.tasks, project]);

  const splitting = splittingCore || splitUiPending;

  const syncOutfitSplitProject = useCallback(
    async (projectId: string): Promise<OutfitVideoProject | null> => {
      try {
        const p = await getOutfitVideoProject(projectId);
        applyProject(p);
        return p;
      } catch {
        // 拆镜 POST 长连接期间轮询 GET 可能 transient 失败，勿抛到 React  overlay
        return null;
      }
    },
    [applyProject],
  );

  const startOutfitSplitStatusJob = useCallback(
    (
      projectId: string,
      opts?: { fire?: boolean; splitModelKey?: string; forceResplit?: boolean },
    ) => {
      const taskId = outfitSplitTaskId(projectId);
      const existing = backgroundGen.tasks.find((t) => t.id === taskId);

      if (existing && existing.status !== "running") {
        backgroundGen.dismissTask(taskId);
      }

      backgroundGen.registerTask({
        id: taskId,
        label: "穿搭视频 · 拆镜",
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        expectedDurationMs: 180_000,
        minimized: false,
        status: "running",
        poll: async () => {
          const p = await syncOutfitSplitProject(projectId);
          if (!p) return { status: "running" as const };
          if (p.sceneList.length > 0) return { status: "succeeded" as const };
          if (!isOutfitSplitActive(p)) {
            return {
              status: "failed" as const,
              error: "拆镜未完成，请重试",
            };
          }
          return { status: "running" as const };
        },
        onSucceeded: async () => {
          try {
            const p = await getOutfitVideoProject(projectId);
            applyProject(p);
            const enrichCount =
              typeof p.meta?.splitEnrichCallCount === "number"
                ? p.meta.splitEnrichCallCount
                : 0;
            const enrichNote = enrichCount > 0 ? "（整段视频 1 次视觉分析）" : "";
            await toast({
              title: "拆解完成",
              message: `共 ${p.sceneList.length} 镜${enrichNote}`,
              variant: "success",
            });
          } catch (e) {
            await alert({
              title: "拆解完成",
              message: `拆解已完成，但刷新项目失败：${formatEcomTransportError(e)}`,
              variant: "error",
            });
          }
        },
        onFailed: async () => {
          try {
            const p = await syncOutfitSplitProject(projectId);
            if (!p || p.sceneList.length === 0) {
              await alert({
                title: "拆解失败",
                message: "拆镜未完成，请重试",
                variant: "error",
              });
            }
          } catch (e) {
            await alert({
              title: "拆解失败",
              message: formatEcomTransportError(e),
              variant: "error",
            });
          }
        },
      });

      void syncOutfitSplitProject(projectId).catch(() => undefined);

      if (opts?.fire === false) return;

      const modelKey = opts?.splitModelKey ?? splitModelKey;
      void (async () => {
        try {
          setSplitModelKey(modelKey);
          await splitOutfitVideoScenes(projectId, {
            mock: isOutfitVideoMockDevUiEnabled(),
            splitModelKey: modelKey,
            forceResplit: opts?.forceResplit,
          });
          await syncOutfitSplitProject(projectId);
        } catch (e) {
          if (
            !backgroundGen.tasks.some((t) => t.id === taskId && t.status === "running")
          ) {
            return;
          }
          try {
            await syncOutfitSplitProject(projectId);
          } catch {
            /* ignore */
          }
          backgroundGen.failTask(taskId, formatEcomTransportError(e));
          setSplitUiPending(false);
          await alert({
            title: "拆解失败",
            message: formatEcomTransportError(e),
            variant: "error",
          });
        } finally {
          splitSubmitLockRef.current = false;
        }
      })();
    },
    [
      alert,
      applyProject,
      backgroundGen,
      splitModelKey,
      syncOutfitSplitProject,
      toast,
    ],
  );

  async function handleSplitScenes(modelKey: string): Promise<void> {
    if (!project) return;
    if (splitSubmitLockRef.current) {
      await toast({ title: "请稍候", message: "拆解请求处理中…" });
      return;
    }
    if (!project.references.referenceVideo?.ossUrl?.trim()) {
      await toast({ title: "无法拆解", message: "请先上传参考视频" });
      return;
    }
    const forceResplit = project.sceneList.length > 0;
    if (forceResplit) {
      if (
        !(await doubleConfirm({
          title: "重新拆解",
          message:
            "将重新切分参考视频并覆盖当前分镜表。模特/服装参考可保留，但逐镜生成进度与成片将被清空。",
          secondTitle: "确认重置",
          secondMessage: "此操作不可撤销，确定继续？",
          confirmLabel: "重新拆解",
        }))
      ) {
        return;
      }
    }
    if (splitting) {
      await toast({ title: "拆解进行中", message: "请等待当前任务完成…" });
      return;
    }
    const validation = validateSplitPromptDrafts(splitSystemDraft, splitUserDraft);
    if (!validation.ok) {
      await alert({
        title: "拆镜指令校验未通过",
        message: formatOutfitSplitPromptValidationError(validation),
        variant: "error",
      });
      return;
    }
    try {
      await flushSplitPrompts();
    } catch (e) {
      await alert({
        title: "保存拆镜指令失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
      return;
    }
    splitSubmitLockRef.current = true;
    setSplitUiPending(true);
    startOutfitSplitStatusJob(project.id, { fire: true, splitModelKey: modelKey, forceResplit });
  }

  useEffect(() => {
    if (!splittingCore) {
      setSplitUiPending(false);
      splitSubmitLockRef.current = false;
    }
  }, [splittingCore]);

  useEffect(() => {
    if (!project || project.sceneList.length === 0) return;
    const taskId = outfitSplitTaskId(project.id);
    backgroundGen.dismissTask(taskId);
    setSplitUiPending(false);
    splitSubmitLockRef.current = false;
  }, [project?.id, project?.sceneList.length, backgroundGen.dismissTask]);

  useEffect(() => {
    if (loading || !project) return;
    const taskId = outfitSplitTaskId(project.id);
    if (!isOutfitSplitActive(project)) {
      backgroundGen.dismissTask(taskId);
    } else {
      startOutfitSplitStatusJob(project.id, { fire: false });
    }
  }, [
    loading,
    project,
    project?.id,
    project?.status,
    project?.meta,
    project?.sceneList.length,
    backgroundGen.dismissTask,
    startOutfitSplitStatusJob,
  ]);

  async function handleSceneChange(scenes: SceneShot[]) {
    if (!project) return;
    try {
      applyProject(await patchOutfitVideoScenes(project.id, scenes));
    } catch (e) {
      await alert({
        title: "保存分镜失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    }
  }

  const promptPatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPromptScenesRef = useRef<SceneShot[] | null>(null);

  async function flushScenePromptPatch() {
    if (!project || !pendingPromptScenesRef.current) return;
    const scenes = pendingPromptScenesRef.current;
    pendingPromptScenesRef.current = null;
    if (promptPatchTimerRef.current) {
      clearTimeout(promptPatchTimerRef.current);
      promptPatchTimerRef.current = null;
    }
    try {
      applyProject(await patchOutfitVideoScenes(project.id, scenes));
    } catch {
      /* 生成前会再次 flush；静默失败避免打断编辑 */
    }
  }

  function handleScenePromptChange(sceneId: string, prompt: string) {
    if (!project) return;
    const next = project.sceneList.map((s) =>
      s.sceneId === sceneId ? { ...s, userGeneratePrompt: prompt } : s,
    );
    applyProject({ ...project, sceneList: next });
    pendingPromptScenesRef.current = next;
    if (promptPatchTimerRef.current) clearTimeout(promptPatchTimerRef.current);
    promptPatchTimerRef.current = setTimeout(() => {
      void flushScenePromptPatch();
    }, 600);
  }

  function handleScenePromptReset(sceneId: string) {
    if (!project) return;
    const scene = project.sceneList.find((s) => s.sceneId === sceneId);
    if (!scene) return;
    handleScenePromptChange(sceneId, buildOutfitShotPrefilledGeneratePrompt(scene));
  }

  async function handleDeleteScene(index: number) {
    if (!project) return;
    if (
      !(await doubleConfirm({
        title: `删除分镜 ${index}？`,
        message: "将从当前项目中移除此镜。",
        secondTitle: "确认删除分镜",
        secondMessage: "删除后不可恢复，需重新拆镜或手动调整排序。",
      }))
    ) {
      return;
    }
    const next = project.sceneList
      .filter((s) => s.index !== index)
      .map((s, i) => ({ ...s, index: i + 1 }));
    await handleSceneChange(next);
  }

  async function handleUploadModel(file: File) {
    if (!project) return;
    setRefBusy(true);
    try {
      applyProject(await uploadOutfitVideoRefImage(project.id, "model", file));
    } catch (e) {
      await alert({ title: "模特图上传失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleUploadClothing(file: File) {
    if (!project) return;
    setRefBusy(true);
    try {
      applyProject(await uploadOutfitVideoRefImage(project.id, "clothing", file));
    } catch (e) {
      await alert({ title: "服装图上传失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleUploadTopGarment(file: File) {
    if (!project) return;
    setRefBusy(true);
    try {
      applyProject(await uploadOutfitVideoRefImage(project.id, "topGarment", file));
    } catch (e) {
      await alert({ title: "上装上传失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleUploadBottomGarment(file: File) {
    if (!project) return;
    setRefBusy(true);
    try {
      applyProject(await uploadOutfitVideoRefImage(project.id, "bottomGarment", file));
    } catch (e) {
      await alert({ title: "下装上传失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleOutfitRefModeChange(mode: OutfitRefMode) {
    if (!project) return;
    try {
      applyProject(
        await updateOutfitVideoProject(project.id, {
          settings: { ...project.settings, outfitRefMode: mode },
        }),
      );
    } catch (e) {
      await alert({ title: "切换模式失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  async function handleGarmentModeChange(mode: OutfitGarmentMode) {
    if (!project) return;
    try {
      applyProject(
        await updateOutfitVideoProject(project.id, {
          settings: { ...project.settings, garmentMode: mode },
        }),
      );
    } catch (e) {
      await alert({ title: "切换服装形态失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  async function handlePickModelFromLibrary(ossUrl: string, label?: string) {
    if (!project) return;
    setRefBusy(true);
    try {
      applyProject(
        await attachOutfitVideoRefs(project.id, {
          model: { ossUrl, source: "library", label: label ?? "模特库" },
        }),
      );
    } catch (e) {
      await alert({ title: "选择模特失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleLockRefs() {
    if (!project) return;
    const settings = {
      outfitRefMode: project.settings.outfitRefMode ?? "need_tryon",
      garmentMode: project.settings.garmentMode ?? "two_piece",
    };
    if (!isOutfitRefsReadyToLock(settings, project.references)) {
      await alert({
        title: "请先补齐穿搭参考",
        message:
          settings.outfitRefMode === "already_dressed"
            ? "请上传已穿搭全身照后再锁定。"
            : settings.garmentMode === "two_piece"
              ? "请上传模特全身照、上装与下装后再锁定。"
              : "请上传模特全身照与服装图后再锁定。",
        variant: "error",
      });
      return;
    }
    setRefBusy(true);
    try {
      applyProject(await lockOutfitVideoRefs(project.id));
      await toast({
        title: "特征已锁定",
        message:
          settings.outfitRefMode === "need_tryon"
            ? "AI 试衣完成，请在分镜表逐镜融图后再生成视频"
            : "请在分镜表逐镜融图后再生成视频",
        variant: "success",
      });
    } catch (e) {
      await alert({ title: "锁定失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setRefBusy(false);
    }
  }

  async function handlePickSceneFusionMode(
    index: number,
    mode: OutfitSceneFusionMode,
    libraryEntryId?: string,
  ) {
    if (!project) return;
    try {
      applyProject(
        await patchOutfitShotSceneFusionConfig(project.id, index, {
          mode,
          libraryEntryId,
          libraryEntryName: undefined,
          fusedImageUrl: undefined,
          sharedFromShotIndex: undefined,
          status: undefined,
          failReason: undefined,
        }),
      );
    } catch (e) {
      await alert({ title: "设置场景失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  async function handleUploadSceneRef(index: number, file: File) {
    if (!project) return;
    setFusingIndices((prev) => new Set(prev).add(index));
    try {
      applyProject(await uploadOutfitSceneRefImage(project.id, index, file));
      await toast({ title: "场景参考图已上传", message: "可点击「融图」生成", variant: "success" });
    } catch (e) {
      await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setFusingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }

  async function handleFuseScene(index: number) {
    if (!project) return;
    const shot = project.sceneList.find((s) => s.index === index);
    const mode = shot?.sceneFusion?.mode ?? "follow_reference";
    setFusingIndices((prev) => new Set(prev).add(index));
    try {
      applyProject(
        await fuseOutfitShotScene(project.id, index, {
          mode,
          libraryEntryId: shot?.sceneFusion?.libraryEntryId,
          sceneRefUrl: shot?.sceneFusion?.sceneRefUrl,
          fusionModelKey,
        }),
      );
      void updateOutfitVideoProject(project.id, {
        settings: { ...project.settings, fusionModelKey },
      }).catch(() => undefined);
      await toast({ title: `镜 ${index} 场景融图完成`, variant: "success" });
    } catch (e) {
      await alert({ title: "场景融图失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setFusingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }

  async function handleApplySceneFusionToAll(sourceIndex: number) {
    if (!project) return;
    try {
      applyProject(await applyOutfitSceneFusionToAll(project.id, sourceIndex));
      await toast({
        title: "已应用全部",
        message: `全部分镜已共用镜 ${sourceIndex} 的场景融合图`,
        variant: "success",
      });
    } catch (e) {
      await alert({ title: "应用全部失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  async function handleCancelGeneratingSelection(index: number) {
    setGeneratingIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  async function handleGenerateShots(indices: number[], modelKeyOverride?: string) {
    if (!project || indices.length === 0) return;
    const sceneListForGen = pendingPromptScenesRef.current ?? project.sceneList;
    await flushScenePromptPatch();
    const modelKey = modelKeyOverride ?? videoModelKey;
    setVideoModelKey(modelKey);
    void persistVideoModelKey(modelKey);
    setGenerateBusy(true);
    setGeneratingIndices(new Set(indices));
    const taskId = outfitGenerateTaskId(project.id);
    const mock = isOutfitVideoMockDevUiEnabled();

    backgroundGen.registerTask({
      id: taskId,
      label: `穿搭视频 · 生成 ${indices.length} 镜`,
      startedAt: new Date().toISOString(),
      expectedDurationMs: GENERATE_EXPECTED_MS * indices.length,
      minimized: false,
      poll: async () => {
        try {
          const p = await getOutfitVideoProject(project.id);
          applyProject(p);
          const pending = indices.some((idx) => {
            const shot = p.sceneList.find((s) => s.index === idx);
            return !shot?.videoUrl?.trim() && shot?.status !== "failed";
          });
          if (!pending) return { status: "succeeded" as const };
          return { status: "running" as const };
        } catch {
          return { status: "running" as const };
        }
      },
      onSucceeded: async () => {
        await toast({ title: "镜头生成完成", variant: "success" });
      },
      onFailed: async () => {
        await alert({ title: "镜头生成失败", message: "部分镜头可能未成功，请重试。", variant: "error" });
      },
    });

    try {
      const scenePrompts: Record<string, string> = {};
      for (const index of indices) {
        const shot = sceneListForGen.find((s) => s.index === index);
        if (shot) {
          scenePrompts[shot.sceneId] = resolveOutfitShotGeneratePrompt(shot);
        }
      }
      const updated = await batchGenerateOutfitVideoShots(project.id, indices, {
        mock,
        videoModelKey: modelKey,
        scenePrompts,
      });
      applyProject(updated);
      backgroundGen.dismissTask(taskId);
      await toast({
        title: "生成完成",
        message: `已完成 ${indices.length} 镜动作迁移`,
        variant: "success",
      });
    } catch (e) {
      backgroundGen.failTask(taskId, formatEcomTransportError(e));
      await alert({
        title: "生成失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setGenerateBusy(false);
      setGeneratingIndices(new Set());
    }
  }

  async function waitForOutfitRender(projectId: string): Promise<string> {
    for (let i = 0; i < RENDER_POLL_MAX; i++) {
      await new Promise((r) => setTimeout(r, RENDER_POLL_MS));
      const job = await pollOutfitVideoRender(projectId);
      if (job.status === "idle") continue;
      const progress = job.progress ?? 0;
      const label = job.progressLabel?.trim() || "处理中…";
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              jobId: job.jobId ?? prev.jobId,
              progress,
              progressLabel: label,
              phase: resolveSeedVideoRenderPhase(job.status, progress),
              stepLog: appendSeedVideoRenderStepLog(prev.stepLog, label),
            }
          : prev,
      );
      const status = job.status.toUpperCase();
      if ((status === "SUCCEEDED" || status === "DONE") && job.outputUrl) {
        return job.outputUrl;
      }
      if (status === "FAILED" || status === "EXPIRED") {
        throw new Error(job.failMessage ?? "合成失败");
      }
    }
    throw new Error("合成超时");
  }

  async function handleCompose() {
    if (!project) return;
    const missing = project.sceneList.some((s) => !s.videoUrl?.trim());
    if (missing) {
      await alert({
        title: "暂不能合成",
        message: "请先生成全部镜头视频。",
        variant: "error",
      });
      return;
    }

    setRenderBusy(true);
    const startedAt = Date.now();
    const taskId = outfitRenderTaskId(project.id);
    setRenderProgress({
      panelOpen: true,
      collapsed: false,
      jobId: "",
      progress: 0,
      progressLabel: "校验镜头…",
      stepLog: ["校验镜头素材"],
      startedAt,
      phase: "queued",
    });

    backgroundGen.registerTask({
      id: taskId,
      label: "穿搭视频 · 合成成片",
      startedAt: new Date().toISOString(),
      expectedDurationMs: 5 * 60 * 1000,
      minimized: true,
      poll: async () => {
        try {
          const p = await getOutfitVideoProject(project.id);
          if (p.composeResult?.videoUrl?.trim()) return { status: "succeeded" as const };
          const job = await pollOutfitVideoRender(project.id);
          if (job.status === "failed") {
            return { status: "failed" as const, error: job.failMessage ?? "合成失败" };
          }
          return { status: "running" as const };
        } catch {
          return { status: "running" as const };
        }
      },
      onSucceeded: async () => {
        await toast({ title: "合成完成", message: "成片已就绪", variant: "success" });
      },
    });

    try {
      await renderOutfitVideo(project.id);
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              progressLabel: "排队中…",
              stepLog: appendSeedVideoRenderStepLog(prev.stepLog, "任务已提交"),
            }
          : prev,
      );
      await waitForOutfitRender(project.id);
      const fresh = await getOutfitVideoProject(project.id);
      applyProject(fresh);
      setRenderProgress((prev) =>
        prev ? { ...prev, phase: "done", progress: 100, progressLabel: "合成完成" } : prev,
      );
      backgroundGen.dismissTask(taskId);
    } catch (e) {
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: "failed",
              progressLabel: e instanceof Error ? e.message : "合成失败",
            }
          : prev,
      );
      backgroundGen.failTask(taskId, formatEcomTransportError(e));
      await alert({
        title: "合成失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setRenderBusy(false);
    }
  }

  async function handleSaveSnapshot() {
    if (!project) return;
    const defaultName = project.title?.trim() || "穿搭视频";
    if (
      !(await confirm({
        title: "保存作品",
        message: `将当前进度保存到资产库，作品名：「${defaultName}」。`,
        confirmLabel: "保存",
      }))
    ) {
      return;
    }
    setSaveBusy(true);
    try {
      const { title } = await saveOutfitVideoDeliverableSnapshot(project.id, defaultName);
      await toast({ title: "已保存", message: title, variant: "success" });
    } catch (e) {
      await alert({ title: "保存失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleNewProject() {
    if (generateBusy || splitting || renderBusy) {
      await alert({ title: "请稍候", message: "当前任务进行中，请完成后再新建。", variant: "error" });
      return;
    }
    try {
      applyProject(await createOutfitVideoProject({ title: "穿搭视频" }));
    } catch (e) {
      await alert({ title: "新建失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  async function handleOpenProject(id: string) {
    try {
      applyProject(await getOutfitVideoProject(id));
    } catch (e) {
      await alert({ title: "打开失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  if (needLogin) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <EcomLoginPrompt returnPath="/ecom/outfit-video" />
      </EcomWorkspaceLayout>
    );
  }

  if (loading || !project) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <div className="flex h-full min-h-0 animate-pulse flex-col gap-4 p-5">
          <div className="h-10 w-48 rounded-lg bg-[#e8e8ed]" />
          <div className="h-32 rounded-xl bg-[#e8e8ed]" />
          <div className="h-48 rounded-xl bg-[#f0f0f2]" />
        </div>
      </EcomWorkspaceLayout>
    );
  }

  return (
    <>
      <EcomWorkspaceLayout fullWidth>
        <OutfitVideoWorkspace
          project={project}
          phase={phase}
          chatModels={chatModels}
          splitModelKey={splitModelKey}
          videoModels={videoModels}
          videoModelKey={videoModelKey}
          modelsLoading={modelsLoading}
          mediaBusy={mediaBusy}
          splitting={splitting}
          refBusy={refBusy}
          generateBusy={generateBusy}
          renderBusy={renderBusy}
          saveBusy={saveBusy}
          generatingIndices={generatingIndices}
          renderProgress={renderProgress}
          onSplitModelChange={(key) => {
            setSplitModelKey(key);
            if (project) {
              void updateOutfitVideoProject(project.id, {
                settings: { ...project.settings, splitModelKey: key },
              }).then(applyProject);
            }
          }}
          onVideoModelChange={(key) => {
            setVideoModelKey(key);
            void persistVideoModelKey(key);
          }}
          onRefreshModels={() => void loadModels()}
          onUploadReferenceVideo={handleUploadReferenceVideo}
          onImportReferenceUrl={handleImportReferenceUrl}
          onAttachReferenceAsset={handleAttachReferenceAsset}
          onClearReferenceVideo={handleClearReferenceVideo}
          onSplitScenes={handleSplitScenes}
          onSceneChange={handleSceneChange}
          onScenePromptChange={handleScenePromptChange}
          onScenePromptReset={handleScenePromptReset}
          onDeleteScene={handleDeleteScene}
          onUploadModel={handleUploadModel}
          onUploadClothing={handleUploadClothing}
          onUploadTopGarment={handleUploadTopGarment}
          onUploadBottomGarment={handleUploadBottomGarment}
          onOutfitRefModeChange={(mode) => void handleOutfitRefModeChange(mode)}
          onGarmentModeChange={(mode) => void handleGarmentModeChange(mode)}
          onPickModelFromLibrary={handlePickModelFromLibrary}
          onLockRefs={handleLockRefs}
          onGenerateShots={handleGenerateShots}
          onCancelGeneratingSelection={handleCancelGeneratingSelection}
          onCompose={handleCompose}
          onSaveSnapshot={handleSaveSnapshot}
          onNewProject={handleNewProject}
          loadProjectList={loadProjectList}
          onOpenProject={handleOpenProject}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
          onRenderProgressPanelOpenChange={(open) =>
            setRenderProgress((prev) => (prev ? { ...prev, panelOpen: open } : prev))
          }
          onRenderProgressCollapsedChange={(collapsed) =>
            setRenderProgress((prev) => (prev ? { ...prev, collapsed } : prev))
          }
          onRenderProgressDismiss={() => setRenderProgress(null)}
          splitSystemDraft={splitSystemDraft}
          splitUserDraft={splitUserDraft}
          splitPromptErrors={splitPromptErrors}
          splitPromptBusy={splitPromptBusy}
          onSplitSystemChange={(value) => {
            setSplitSystemDraft(value);
            scheduleSplitPromptSave({ system: value });
          }}
          onSplitUserChange={(value) => {
            setSplitUserDraft(value);
            scheduleSplitPromptSave({ user: value });
          }}
          onResetSplitSystem={() => {
            setSplitSystemDraft(DEFAULT_SPLIT_SYSTEM_PROMPT);
            scheduleSplitPromptSave({ system: DEFAULT_SPLIT_SYSTEM_PROMPT });
          }}
          onResetSplitUser={() => {
            setSplitUserDraft(DEFAULT_SPLIT_USER_PROMPT);
            scheduleSplitPromptSave({ user: DEFAULT_SPLIT_USER_PROMPT });
          }}
          fusionModelKey={fusionModelKey}
          fusingIndices={fusingIndices}
          onPickSceneFusionMode={handlePickSceneFusionMode}
          onUploadSceneRef={handleUploadSceneRef}
          onFuseScene={handleFuseScene}
          onApplySceneFusionToAll={handleApplySceneFusionToAll}
        />
      </EcomWorkspaceLayout>

      {previewVideo ? (
        <EcomVideoPreviewDialog
          open
          src={previewVideo.src}
          title={previewVideo.title}
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
        />
      ) : null}
    </>
  );
}
