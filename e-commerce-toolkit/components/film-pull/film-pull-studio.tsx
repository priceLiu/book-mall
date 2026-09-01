"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { BackgroundGenerationProvider, useBackgroundGeneration } from "@/components/generation";
import { FilmPullWorkspace } from "@/components/film-pull/film-pull-workspace";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { installEcomWorkspaceNavGuards } from "@/lib/ecom-block-browser-nav";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import {
  streamFilmPullAnalyze,
  attachFilmPullAsset,
  cancelFilmPullAnalyze,
  clearFilmPullMedia,
  createFilmPullProject,
  fetchFilmPullModels,
  getFilmPullProject,
  listFilmPullProjectSummaries,
  downloadFilmPullExportZip,
  mockFilmPullAnalyze,
  setFilmPullVideoFromUrl,
  startFilmPullReplicaFlow,
  updateFilmPullProject,
  uploadFilmPullVideo,
} from "@/lib/ecom-film-pull-api";
import { fetchMediaDecomposeModels } from "@/lib/ecom-media-decompose-api";
import type { FilmPullProject } from "@/lib/film-pull-types";
import {
  FILM_PULL_PROJECT_STATUS,
  isFilmPullAnalyzeActive,
} from "@/lib/film-pull-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-film-pull-active-project";
const FILM_PULL_DEFAULT_CHAT_MODEL = "qwen3.8-max";
const FILM_PULL_ANALYZE_EXPECTED_MS = 10 * 60 * 1000;

function filmPullAnalyzeTaskId(projectId: string) {
  return `film-pull-analyze-${projectId}`;
}

export function FilmPullStudio() {
  return (
    <BackgroundGenerationProvider>
      <FilmPullStudioInner />
    </BackgroundGenerationProvider>
  );
}

function FilmPullStudioInner() {
  const { alert, toast, doubleConfirm } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const analyzeSubmitLockRef = useRef(false);
  const [project, setProject] = useState<FilmPullProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState(FILM_PULL_DEFAULT_CHAT_MODEL);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [replicaBusy, setReplicaBusy] = useState(false);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModelKey, setVideoModelKey] = useState("wan2.7-r2v");
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState("");
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(null);

  const filmPullChatModels = useMemo(
    () => chatModels.filter((m) => m.supportsVideo === true),
    [chatModels],
  );
  const analyzing =
    isFilmPullAnalyzeActive(project) ||
    backgroundGen.tasks.some(
      (t) =>
        t.status === "running" &&
        project &&
        t.id === filmPullAnalyzeTaskId(project.id),
    );

  const applyProject = useCallback((p: FilmPullProject) => {
    setProject(p);
    setStreamText(p.analyzeResult?.rawText ?? "");
    if (typeof window !== "undefined") sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const [m, decomposeModels] = await Promise.all([
        fetchFilmPullModels(),
        fetchMediaDecomposeModels().catch(() => null),
      ]);
      setChatModels(m.chatModels);
      setChatModelKey((prev) =>
        pickBoundStoryboardModelKey(
          m.chatModels.filter((cm) => cm.supportsVideo === true),
          m.defaults?.chat ?? prev,
        ),
      );
      if (decomposeModels?.imageModels?.length) {
        setImageModels(decomposeModels.imageModels);
        setImageModelKey((prev) =>
          pickBoundStoryboardModelKey(
            decomposeModels.imageModels!,
            decomposeModels.defaults?.image &&
              decomposeModels.imageModels!.some(
                (im) => im.modelKey === decomposeModels.defaults?.image,
              )
              ? decomposeModels.defaults.image
              : prev,
          ),
        );
      }
      if (m.videoModels?.length) {
        setVideoModels(m.videoModels);
        setVideoModelKey((prev) =>
          pickBoundStoryboardModelKey(m.videoModels, m.defaults?.video ?? prev),
        );
      }
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
          ? await getFilmPullProject(savedId)
          : await createFilmPullProject({ title: "专业拉片" });
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

  useEffect(() => {
    if (filmPullChatModels.length === 0) return;
    setChatModelKey((prev) => pickBoundStoryboardModelKey(filmPullChatModels, prev));
  }, [filmPullChatModels]);

  useEffect(() => installEcomWorkspaceNavGuards(), []);

  const loadProjectList = useCallback(async () => listFilmPullProjectSummaries(), []);

  async function wrapMedia(fn: () => Promise<FilmPullProject>) {
    setMediaBusy(true);
    try {
      applyProject(await fn());
      setStreamText("");
    } catch (e) {
      await alert({
        title: "素材处理失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleNewProject() {
    if (analyzing) {
      await alert({
        title: "请稍候",
        message: "拉片进行中，请等待完成后再新建项目。",
        variant: "error",
      });
      return;
    }
    try {
      applyProject(await createFilmPullProject({ title: "专业拉片" }));
      setStreamText("");
    } catch (e) {
      await alert({
        title: "新建失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    }
  }

  async function handleOpenProject(id: string) {
    if (project?.id === id) return;
    if (analyzing) {
      await alert({
        title: "请稍候",
        message: "拉片进行中，请等待完成后再切换项目。",
        variant: "error",
      });
      return;
    }
    try {
      applyProject(await getFilmPullProject(id));
    } catch (e) {
      await alert({
        title: "打开失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    }
  }

  async function handleSaveProject() {
    if (!project) return;
    setSaveBusy(true);
    try {
      const updated = await updateFilmPullProject(project.id, {
        settings: {
          ...project.settings,
          chatModelKey,
        },
      });
      applyProject(updated);
      await toast({ variant: "success", title: "已保存项目" });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: formatEcomTransportError(e),
        variant: "error",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  const startFilmPullStatusJob = useCallback(
    (
      taskId: string,
      label: string,
      expectedDurationMs: number,
      opts: {
        projectId: string;
        fire?: () => Promise<unknown>;
        isDone: (p: FilmPullProject) => boolean;
        failError: (p: FilmPullProject) => string | null;
        successMessage: string;
        onCancel?: () => void | Promise<void>;
        cancelLabel?: string;
      },
    ) => {
      const existing = backgroundGen.tasks.find((t) => t.id === taskId);
      const wasRunning = existing?.status === "running";

      if (existing && existing.status !== "running") {
        if (!opts.fire) return;
        backgroundGen.dismissTask(taskId);
      }

      backgroundGen.registerTask({
        id: taskId,
        label,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        expectedDurationMs,
        onCancel: opts.onCancel,
        cancelLabel: opts.cancelLabel,
        status: wasRunning ? "running" : undefined,
        minimized: existing?.minimized,
        poll: async () => {
          try {
            const p = await getFilmPullProject(opts.projectId);
            applyProject(p);
            const err = opts.failError(p);
            if (err) return { status: "failed" as const, error: err };
            if (opts.isDone(p)) return { status: "succeeded" as const };
            return { status: "running" as const };
          } catch {
            return { status: "running" as const };
          }
        },
        onSucceeded: async () => {
          await toast({ variant: "success", title: opts.successMessage });
        },
        onFailed: async () => {
          try {
            const p = await getFilmPullProject(opts.projectId);
            applyProject(p);
            const err = opts.failError(p);
            if (err && err !== "拉片已中止") {
              await alert({
                title: `${label}失败`,
                message: err ?? "请稍后重试",
                variant: "error",
              });
            }
          } catch (e) {
            await alert({
              title: `${label}失败`,
              message: formatEcomTransportError(e),
              variant: "error",
            });
          }
        },
      });

      if (!opts.fire || wasRunning) return;

      void opts.fire?.().catch(async (e) => {
        if (!backgroundGen.tasks.some((t) => t.id === taskId && t.status === "running")) {
          return;
        }
        try {
          const p = await getFilmPullProject(opts.projectId);
          applyProject(p);
          const err = opts.failError(p) ?? (e instanceof Error ? e.message : "拉片失败");
          backgroundGen.failTask(taskId, err);
          if (err !== "拉片已中止") {
            await alert({ title: `${label}失败`, message: err, variant: "error" });
          }
        } catch (inner) {
          backgroundGen.failTask(
            taskId,
            inner instanceof Error ? inner.message : "拉片失败",
          );
          await alert({
            title: `${label}失败`,
            message: formatEcomTransportError(inner),
            variant: "error",
          });
        }
      });
    },
    [alert, applyProject, backgroundGen, toast],
  );

  const abortAnalyzeForProject = useCallback(
    async (projectId: string) => {
      const taskId = filmPullAnalyzeTaskId(projectId);
      try {
        applyProject(await cancelFilmPullAnalyze(projectId));
      } catch (e) {
        await alert({
          title: "中止失败",
          message: formatEcomTransportError(e),
          variant: "error",
        });
        return;
      }
      backgroundGen.dismissTask(taskId);
      await toast({ title: "已中止拉片" });
    },
    [alert, applyProject, backgroundGen, toast],
  );

  const startAnalyzeJob = useCallback(
    (projectId: string, opts?: { fire?: boolean; modelKey?: string; prompt?: string }) => {
      startFilmPullStatusJob(
        filmPullAnalyzeTaskId(projectId),
        "视频拉片分析",
        FILM_PULL_ANALYZE_EXPECTED_MS,
        {
          projectId,
          fire:
            opts?.fire === false
              ? undefined
              : async () => {
                  await streamFilmPullAnalyze(
                    projectId,
                    {
                      modelKey: opts?.modelKey ?? chatModelKey,
                      prompt: opts?.prompt,
                    },
                    setStreamText,
                  );
                  return getFilmPullProject(projectId);
                },
          onCancel: () => abortAnalyzeForProject(projectId),
          cancelLabel: "中止",
          isDone: (p) =>
            Boolean(p.analyzeResult?.structured) ||
            p.status === FILM_PULL_PROJECT_STATUS.ANALYZED,
          failError: (p) => {
            if (p.analyzeResult?.parseError === "拉片已中止") return "拉片已中止";
            if (p.status === FILM_PULL_PROJECT_STATUS.FAILED) {
              return p.analyzeResult?.parseError ?? "拉片失败";
            }
            if (
              p.analyzeResult?.parseError &&
              p.analyzeResult.completedAt &&
              !p.analyzeResult.structured
            ) {
              return p.analyzeResult.parseError;
            }
            if (p.status === FILM_PULL_PROJECT_STATUS.ANALYZING) {
              const startedAt =
                (p.meta as { analyzeStartedAt?: string } | null)?.analyzeStartedAt ??
                p.updatedAt;
              if (Date.now() - new Date(startedAt).getTime() > 12 * 60 * 1000) {
                return "拉片超时，请重试";
              }
            }
            return null;
          },
          successMessage: "拉片完成",
        },
      );
    },
    [abortAnalyzeForProject, chatModelKey, startFilmPullStatusJob],
  );

  useEffect(() => {
    if (!analyzing) analyzeSubmitLockRef.current = false;
  }, [analyzing]);

  useEffect(() => {
    if (loading || !project) return;
    const analyzeId = filmPullAnalyzeTaskId(project.id);
    if (!isFilmPullAnalyzeActive(project)) {
      backgroundGen.dismissTask(analyzeId);
    } else {
      startAnalyzeJob(project.id, { fire: false });
    }
  }, [
    loading,
    project,
    project?.id,
    project?.status,
    project?.analyzeResult?.completedAt,
    backgroundGen.dismissTask,
    startAnalyzeJob,
  ]);

  if (needLogin) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <EcomLoginPrompt returnPath="/ecom/film-pull" />
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
        <FilmPullWorkspace
          project={project}
          chatModels={filmPullChatModels}
          chatModelKey={chatModelKey}
          modelsLoading={modelsLoading}
          mediaBusy={mediaBusy}
          analyzing={analyzing}
          streamText={streamText}
          saveBusy={saveBusy}
          exportBusy={exportBusy}
          replicaBusy={replicaBusy}
          videoModels={videoModels}
          videoModelKey={videoModelKey}
          onVideoModelChange={setVideoModelKey}
          imageModels={imageModels}
          imageModelKey={imageModelKey}
          onImageModelChange={setImageModelKey}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
          onStartReplica={async () => {
            setReplicaBusy(true);
            try {
              applyProject(await startFilmPullReplicaFlow(project.id));
            } catch (e) {
              await alert({
                title: "无法开始复刻",
                message: formatEcomTransportError(e),
                variant: "error",
              });
            } finally {
              setReplicaBusy(false);
            }
          }}
          onNewProject={() => void handleNewProject()}
        loadProjectList={loadProjectList}
        onOpenProject={(id) => void handleOpenProject(id)}
        onRefreshModels={() => void loadModels()}
        onChatModelChange={(key) => {
          setChatModelKey(key);
          void updateFilmPullProject(project.id, {
            settings: { ...project.settings, chatModelKey: key },
          }).then(applyProject);
        }}
        onUploadFile={(file) => wrapMedia(() => uploadFilmPullVideo(project.id, file))}
        onImportUrl={(url) => wrapMedia(() => setFilmPullVideoFromUrl(project.id, url))}
        onAttachAsset={(assetId) => wrapMedia(() => attachFilmPullAsset(project.id, assetId))}
        onClearMedia={async () => {
          if (analyzing) {
            await alert({
              title: "无法删除",
              message: "拉片进行中，请等待完成或失败后再更换源视频",
              variant: "error",
            });
            return;
          }
          const ok = await doubleConfirm({
            title: "删除素材",
            message: "确定从本项目移除这条视频？",
            secondTitle: "不可恢复",
            secondMessage: "删除后需重新上传，是否继续？",
            confirmLabel: "删除",
          });
          if (!ok) return;
          await wrapMedia(() => clearFilmPullMedia(project.id));
        }}
        onAnalyze={(prompt, modelKey) => {
          if (analyzing || analyzeSubmitLockRef.current) return;
          analyzeSubmitLockRef.current = true;
          setStreamText("");
          setChatModelKey(modelKey);
          applyProject({
            ...project,
            status: FILM_PULL_PROJECT_STATUS.ANALYZING,
            analyzeResult: null,
            refMatch: null,
            productionPlan: null,
            meta: {
              ...(project.meta ?? {}),
              analyzeStartedAt: new Date().toISOString(),
              analyzeCancelRunId: null,
              refMatchConfirmedAt: null,
              productionScriptConfirmedAt: null,
              replicaSeedVideoProjectId: null,
              replicaResultAt: null,
            },
            settings: {
              ...project.settings,
              chatModelKey: modelKey,
              lastAnalyzePrompt: prompt,
            },
          });
          startAnalyzeJob(project.id, { modelKey, prompt });
        }}
        onMockAnalyze={async (prompt) => {
          setStreamText("");
          try {
            const fresh = await mockFilmPullAnalyze(project.id, { prompt });
            applyProject(fresh);
            setStreamText(fresh.analyzeResult?.rawText ?? "");
            await toast({ variant: "success", title: "Mock 拉片完成" });
          } catch (e) {
            await alert({
              title: "Mock 拉片失败",
              message: formatEcomTransportError(e),
              variant: "error",
            });
          }
        }}
        onAbortAnalyze={() => {
          void abortAnalyzeForProject(project.id);
        }}
        onExportZip={() => {
          void (async () => {
            setExportBusy(true);
            try {
              await downloadFilmPullExportZip(project.id);
            } catch (e) {
              await alert({
                title: "导出失败",
                message: formatEcomTransportError(e),
                variant: "error",
              });
            } finally {
              setExportBusy(false);
            }
          })();
        }}
        onSaveProject={() => void handleSaveProject()}
        onProjectUpdated={applyProject}
        onAlert={alert}
      />
      </EcomWorkspaceLayout>
      {previewVideo ? (
        <EcomVideoPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
          src={previewVideo.src}
          title={previewVideo.title ?? "制作成片"}
        />
      ) : null}
    </>
  );
}
