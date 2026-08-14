"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { SeedVideoAssistantPanel } from "@/components/seed-video/seed-video-assistant-panel";
import { SeedVideoContentPanel } from "@/components/seed-video/seed-video-content-panel";
import { SeedVideoProgressRail } from "@/components/seed-video/seed-video-progress-rail";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createSeedVideoProject,
  fetchSeedVideoModels,
  getSeedVideoProject,
  listSeedVideoProjectSummaries,
  removeSeedVideoRef,
  uploadSeedVideoRef,
} from "@/lib/ecom-seed-video-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-seed-video-active-project";

export function SeedVideoStudio() {
  const { alert, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<SeedVideoProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState("qwen3.5-flash");
  const [videoModelKey, setVideoModelKey] = useState("wan2.7-r2v");
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantWide, setAssistantWide] = useState(false);
  const [planningPrompt, setPlanningPrompt] = useState("");
  const [startPlanningToken, setStartPlanningToken] = useState(0);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );

  const applyProject = useCallback((p: SeedVideoProject) => {
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
    if (p.settings.videoModelKey) setVideoModelKey(p.settings.videoModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: SeedVideoProject) => {
      applyProject(initial ?? (await getSeedVideoProject(id)));
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
        setChatModelKey((prev) => pickBoundStoryboardModelKey(models.chatModels, prev));
        setVideoModelKey((prev) => pickBoundStoryboardModelKey(models.videoModels, prev));
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
  }, [alert, reload]);

  async function handleNewProject() {
    setLoading(true);
    setEmpty(false);
    try {
      const created = await createSeedVideoProject({ title: "图片生种草视频" });
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

  async function handleUploadRef(file: File) {
    if (!project) return;
    setRefBusy(true);
    try {
      await uploadSeedVideoRef(project.id, file);
      await reload(project.id);
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
      await reload(project.id);
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

  async function handleStartPlanning() {
    if (!project) return;
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
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold text-[#1d1d1f]">图片生种草视频</h1>
        <p className="max-w-md text-sm text-[#6e6e73]">
          上传商品/穿搭素材，用 Skill 策划脚本与镜头，支持方案① wan3.0 直接 30s 成片或方案② 逐镜 I2V + TTS + 合成。
        </p>
        <EcomButtonPrimary type="button" onClick={() => void handleNewProject()}>
          开始创作
        </EcomButtonPrimary>
      </div>
    );
  }

  return (
    <>
      <EcomWorkspaceLayout
        assistantWide={assistantWide}
        progress={<SeedVideoProgressRail project={project} />}
        assistant={
          <SeedVideoAssistantPanel
            project={project}
            chatModelKey={chatModelKey}
            onProjectChange={() => reload(project.id)}
            onStreamingChange={setAssistantStreaming}
            onAlert={alert}
            composerWide={assistantWide}
            onComposerWideChange={setAssistantWide}
            startPlanningToken={startPlanningToken}
            planningPrompt={planningPrompt}
          />
        }
      >
        <SeedVideoContentPanel
          project={project}
          videoModels={videoModels}
          videoModelKey={videoModelKey}
          onVideoModelChange={setVideoModelKey}
          onProjectChange={() => reload(project.id)}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
          onAlert={alert}
          onUploadRef={handleUploadRef}
          onRemoveRef={handleRefRemove}
          refBusy={refBusy}
          planningPrompt={planningPrompt}
          onPlanningPromptChange={setPlanningPrompt}
          onStartPlanning={() => void handleStartPlanning()}
          onNewProject={() => void handleNewProject()}
          streaming={assistantStreaming}
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
    </>
  );
}

export { PROJECT_STORAGE_KEY as SEED_VIDEO_PROJECT_STORAGE_KEY };
