"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { MediaDecomposeWorkspace } from "@/components/media-decompose/media-decompose-workspace";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  attachMediaDecomposeAsset,
  clearMediaDecomposeMedia,
  createMediaDecomposeProject,
  fetchMediaDecomposeModels,
  getMediaDecomposeProject,
  listMediaDecomposeProjectSummaries,
  setMediaDecomposeFromUrl,
  startMediaDecomposeReplica,
  streamMediaDecompose,
  updateMediaDecomposeProject,
  uploadMediaDecomposeFile,
} from "@/lib/ecom-media-decompose-api";
import { fetchSeedVideoModels, getSeedVideoProject } from "@/lib/ecom-seed-video-api";
import type { MediaDecomposeChatModel, MediaDecomposeProject } from "@/lib/media-decompose-types";
import { ECOM_DEFAULT_CHAT_MODEL_KEY } from "@/lib/ecom-assistant-models";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { resolveSeedVideoVideoModelKey } from "@/lib/seed-video-workflow";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-media-decompose-active-project";

export function MediaDecomposeStudio() {
  const { alert, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<MediaDecomposeProject | null>(null);
  const [chatModels, setChatModels] = useState<MediaDecomposeChatModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState(ECOM_DEFAULT_CHAT_MODEL_KEY);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [replicaSeedVideo, setReplicaSeedVideo] = useState<SeedVideoProject | null>(null);
  const [replicaBusy, setReplicaBusy] = useState(false);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModelKey, setVideoModelKey] = useState("wan2.7-r2v");
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(null);

  const applyProject = useCallback((p: MediaDecomposeProject) => {
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
    setStreamText(p.result?.rawText ?? "");
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const [models, seedModels] = await Promise.all([
        fetchMediaDecomposeModels(),
        fetchSeedVideoModels().catch(() => null),
      ]);
      setChatModels(models.chatModels);
      const def = models.defaults?.chat;
      setChatModelKey((prev) =>
        pickBoundStoryboardModelKey(
          models.chatModels,
          def && models.chatModels.some((m) => m.modelKey === def) ? def : prev,
        ),
      );
      if (seedModels?.videoModels?.length) {
        setVideoModels(seedModels.videoModels);
        setVideoModelKey((prev) =>
          resolveSeedVideoVideoModelKey(
            seedModels.videoModels,
            seedModels.defaults?.video ?? prev,
            false,
          ),
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
        let p: MediaDecomposeProject;
        if (savedId) {
          try {
            p = await getMediaDecomposeProject(savedId);
          } catch {
            p = await createMediaDecomposeProject();
          }
        } else {
          p = await createMediaDecomposeProject();
        }
        if (!cancelled) {
          applyProject(p);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          if (isEcomUnauthorizedError(e)) setNeedLogin(true);
          else {
            await alert({
              title: "加载失败",
              message: e instanceof Error ? e.message : "无法打开拆图拆视频",
              variant: "error",
            });
          }
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [alert, applyProject, loadModels]);

  useEffect(() => {
    if (chatModels.length === 0) return;
    setChatModelKey((prev) => pickBoundStoryboardModelKey(chatModels, prev));
  }, [chatModels]);

  useEffect(() => {
    const replicaId =
      typeof project?.meta?.replicaSeedVideoProjectId === "string"
        ? project.meta.replicaSeedVideoProjectId.trim()
        : "";
    if (!project || !replicaId) {
      setReplicaSeedVideo(null);
      return;
    }
    let cancelled = false;
    void getSeedVideoProject(replicaId)
      .then((sv) => {
        if (!cancelled) setReplicaSeedVideo(sv);
      })
      .catch(() => {
        if (!cancelled) setReplicaSeedVideo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.meta?.replicaSeedVideoProjectId]);

  async function wrapMedia(fn: () => Promise<MediaDecomposeProject>) {
    setMediaBusy(true);
    try {
      const p = await fn();
      applyProject(p);
      setStreamText("");
    } catch (e) {
      await alert({
        title: "素材处理失败",
        message: e instanceof Error ? e.message : "请重试",
        variant: "error",
      });
    } finally {
      setMediaBusy(false);
    }
  }

  const loadProjectList = useCallback(async () => {
    const items = await listMediaDecomposeProjectSummaries();
    return items.map((p) => ({
      id: p.id,
      title: p.title?.trim() || "拆图拆视频",
      updatedAt: p.updatedAt,
      subtitle: p.mediaKind === "video" ? "视频" : p.mediaKind === "image" ? "图片" : "未上传素材",
    }));
  }, []);

  async function handleNewProject() {
    if (decomposing) {
      await alert({
        title: "请稍候",
        message: "拆解进行中，请等待完成后再新建项目。",
        variant: "error",
      });
      return;
    }
    try {
      const created = await createMediaDecomposeProject();
      applyProject(created);
      setStreamText("");
    } catch (e) {
      await alert({
        title: "新建失败",
        message: e instanceof Error ? e.message : "无法创建项目",
        variant: "error",
      });
    }
  }

  async function handleOpenProject(id: string) {
    if (project?.id === id) return;
    if (decomposing) {
      await alert({
        title: "请稍候",
        message: "拆解进行中，请等待完成后再切换项目。",
        variant: "error",
      });
      return;
    }
    try {
      const fresh = await getMediaDecomposeProject(id);
      applyProject(fresh);
      setStreamText(fresh.result?.rawText ?? "");
    } catch (e) {
      await alert({
        title: "打开失败",
        message: e instanceof Error ? e.message : "无法打开项目",
        variant: "error",
      });
    }
  }

  if (needLogin) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <EcomLoginPrompt returnPath="/ecom/media-decompose" />
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
    <MediaDecomposeWorkspace
      project={project}
      chatModels={chatModels}
      chatModelKey={chatModelKey}
      modelsLoading={modelsLoading}
      mediaBusy={mediaBusy}
      decomposing={decomposing}
      streamText={streamText}
      onNewProject={() => void handleNewProject()}
      loadProjectList={loadProjectList}
      onOpenProject={(id) => void handleOpenProject(id)}
      replicaSeedVideo={replicaSeedVideo}
      replicaBusy={replicaBusy}
      videoModels={videoModels}
      videoModelKey={videoModelKey}
      onVideoModelChange={setVideoModelKey}
      onStartReplica={async () => {
        setReplicaBusy(true);
        try {
          const { project: next, seedVideo } = await startMediaDecomposeReplica(project.id);
          applyProject(next);
          setReplicaSeedVideo(seedVideo);
          if (seedVideo.settings.videoModelKey) {
            setVideoModelKey((prev) =>
              resolveSeedVideoVideoModelKey(videoModels, seedVideo.settings.videoModelKey ?? prev, false),
            );
          }
        } catch (e) {
          await alert({
            title: "无法开始复刻",
            message: e instanceof Error ? e.message : "请稍后重试",
            variant: "error",
          });
        } finally {
          setReplicaBusy(false);
        }
      }}
      onReplicaProjectChange={async () => {
        const replicaId =
          typeof project.meta?.replicaSeedVideoProjectId === "string"
            ? project.meta.replicaSeedVideoProjectId.trim()
            : replicaSeedVideo?.id;
        if (!replicaId) return;
        try {
          const sv = await getSeedVideoProject(replicaId);
          setReplicaSeedVideo(sv);
        } catch {
          /* ignore */
        }
      }}
      onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
      onAlert={alert}
      onProjectUpdated={applyProject}
      onRefreshModels={() => void loadModels()}
      onChatModelChange={(key) => {
        setChatModelKey(key);
        void updateMediaDecomposeProject(project.id, {
          settings: { ...project.settings, chatModelKey: key },
        }).then(applyProject);
      }}
      onUploadFile={(file) => wrapMedia(() => uploadMediaDecomposeFile(project.id, file))}
      onImportUrl={(url) => wrapMedia(() => setMediaDecomposeFromUrl(project.id, url))}
      onAttachAsset={(assetId) => wrapMedia(() => attachMediaDecomposeAsset(project.id, assetId))}
      onClearMedia={async () => {
        const ok = await doubleConfirm({
          title: "删除素材",
          message: "确定从本项目移除这条素材？",
          secondTitle: "不可恢复",
          secondMessage: "删除后需重新上传，是否继续？",
          confirmLabel: "删除",
        });
        if (!ok) return;
        await wrapMedia(() => clearMediaDecomposeMedia(project.id));
      }}
      onDecompose={async (prompt, modelKey) => {
        setDecomposing(true);
        setStreamText("");
        setReplicaSeedVideo(null);
        try {
          await streamMediaDecompose(project.id, { prompt, modelKey }, setStreamText);
          const fresh = await getMediaDecomposeProject(project.id);
          applyProject(fresh);
        } catch (e) {
          await alert({
            title: "拆解失败",
            message: e instanceof Error ? e.message : "请重试",
            variant: "error",
          });
        } finally {
          setDecomposing(false);
        }
      }}
    />
    </EcomWorkspaceLayout>
    {previewVideo ? (
      <EcomVideoPreviewDialog
        open
        onOpenChange={(open) => {
          if (!open) setPreviewVideo(null);
        }}
        src={previewVideo.src}
        title={previewVideo.title ?? "一键复刻"}
      />
    ) : null}
    </>
  );
}
