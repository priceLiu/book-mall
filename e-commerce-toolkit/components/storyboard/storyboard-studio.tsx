"use client";

import html2canvas from "html2canvas";
import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { StoryboardAssistantPanel } from "@/components/storyboard/storyboard-assistant-panel";
import { StoryboardContentPanel } from "@/components/storyboard/storyboard-content-panel";
import { StoryboardProSheetView } from "@/components/storyboard/storyboard-pro-sheet-view";
import { StoryboardProgressRail } from "@/components/storyboard/storyboard-progress-rail";
import { StoryboardRefUploader } from "@/components/storyboard/storyboard-ref-uploader";
import {
  StoryboardSettingsDialog,
  type StoryboardSettingsValue,
} from "@/components/storyboard/storyboard-settings-dialog";
import { listAssets, type EcomAsset } from "@/lib/ecom-api";
import {
  createStoryboardProject,
  fetchStoryboardModels,
  getStoryboardProject,
  listStoryboardProjects,
  removeStoryboardRef,
  updateStoryboardProject,
  uploadStoryboardRef,
} from "@/lib/ecom-storyboard-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { inferCollectUploadRole, type StoryboardUploadRole } from "@/lib/storyboard-workflow";
import type { StoryboardReference } from "@/lib/storyboard-types";
import type {
  StoryboardGatewayModel,
  StoryboardProject,
} from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-storyboard-active-project";

export function StoryboardStudio() {
  const { alert, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<StoryboardProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [durationSec, setDurationSec] = useState(15);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");
  const [videoAspectRatio, setVideoAspectRatio] = useState<
    "16:9" | "9:16" | "1:1"
  >("9:16");
  const [videoAsset, setVideoAsset] = useState<EcomAsset | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refBusy, setRefBusy] = useState(false);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [settings, setSettings] = useState<StoryboardSettingsValue>({
    chatModelKey: "qwen3.5-flash",
    imageModelKey: "wan2.7-image",
    videoModelKey: "doubao-seedance-2.0",
    aspectRatio: "9:16",
    imageSize: "720*1280",
    videoResolution: "1080p",
    durationSec: 15,
    dialogueLang: "zh",
    videoR2vRatio: "9:16",
    videoSeed: "",
    videoPromptExtend: true,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [exportSheet, setExportSheet] = useState<StoryboardProject["sheet"]>(null);
  const [uploadRole, setUploadRole] = useState<StoryboardUploadRole>("product");
  const [generateAllImagesToken, setGenerateAllImagesToken] = useState(0);
  const [generateFullVideoToken, setGenerateFullVideoToken] = useState(0);
  const [mergePanelVideosToken, setMergePanelVideosToken] = useState(0);

  const reload = useCallback(async (id: string) => {
    const p = await getStoryboardProject(id);
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, id);
    }
    const d =
      typeof p.settings?.durationSec === "number" ? p.settings.durationSec : 15;
    setDurationSec(Math.max(4, Math.min(15, d)));
    if (p.settings?.aspectRatio === "16:9" || p.settings?.aspectRatio === "9:16") {
      setAspectRatio(p.settings.aspectRatio);
      setVideoAspectRatio(p.settings.aspectRatio);
    }
    setSettings((prev) => ({
      ...prev,
      durationSec: Math.max(4, Math.min(15, d)),
      aspectRatio:
        p.settings?.aspectRatio === "16:9" || p.settings?.aspectRatio === "9:16"
          ? p.settings.aspectRatio
          : prev.aspectRatio,
      imageModelKey:
        (p.meta?.workflow?.imageModelKey as string | undefined) ?? prev.imageModelKey,
      videoModelKey:
        (p.meta?.workflow?.videoModelKey as string | undefined) ??
        (typeof p.settings?.videoModelKey === "string"
          ? p.settings.videoModelKey
          : prev.videoModelKey),
      imageSize:
        (p.meta?.workflow?.imageSize as StoryboardSettingsValue["imageSize"] | undefined) ??
        prev.imageSize,
      videoResolution:
        (p.meta?.workflow?.videoResolution as
          | StoryboardSettingsValue["videoResolution"]
          | undefined) ?? prev.videoResolution,
      videoR2vRatio:
        (typeof p.settings?.videoR2vRatio === "string"
          ? p.settings.videoR2vRatio
          : undefined) ?? prev.videoR2vRatio,
      videoSeed:
        (typeof p.settings?.videoSeed === "string" ? p.settings.videoSeed : undefined) ??
        prev.videoSeed,
      videoPromptExtend:
        typeof p.settings?.videoPromptExtend === "boolean"
          ? p.settings.videoPromptExtend
          : prev.videoPromptExtend,
    }));
    if (p.videoOssUrl) {
      setVideoAsset({
        id: p.videoAssetId ?? "",
        module: "storyboard-micro-drama",
        kind: "video",
        title: p.sheet?.overview.title ?? null,
        prompt: null,
        ossUrl: p.videoOssUrl,
        thumbnailUrl: null,
        createdAt: p.updatedAt,
      });
    } else if (p.videoAssetId) {
      try {
        const assets = await listAssets("storyboard-micro-drama");
        const found = assets.find((a) => a.id === p.videoAssetId);
        setVideoAsset(found ?? null);
      } catch {
        setVideoAsset(null);
      }
    } else {
      setVideoAsset(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await fetchStoryboardModels();
        if (cancelled) return;
        setChatModels(models.chatModels);
        setImageModels(models.imageModels);
        setVideoModels(models.videoModels);
        setSettings((prev) => ({
          ...prev,
          chatModelKey: pickBoundStoryboardModelKey(
            models.chatModels,
            prev.chatModelKey,
          ),
          imageModelKey: pickBoundStoryboardModelKey(
            models.imageModels,
            prev.imageModelKey,
          ),
          videoModelKey: pickBoundStoryboardModelKey(
            models.videoModels,
            prev.videoModelKey,
          ),
        }));

        const savedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PROJECT_STORAGE_KEY)
            : null;
        let projectId: string | null = savedId;

        if (projectId) {
          try {
            await getStoryboardProject(projectId);
          } catch {
            projectId = null;
          }
        }

        if (!projectId) {
          const items = await listStoryboardProjects();
          if (items.length > 0) {
            projectId = items[0]!.id;
          }
        }

        if (!projectId) {
          const created = await createStoryboardProject({ title: "微剧故事版" });
          projectId = created.id;
        }

        if (cancelled) return;
        await reload(projectId);
      } catch (e) {
        if (!cancelled) {
          if (isEcomUnauthorizedError(e)) {
            setNeedLogin(true);
          } else {
            await alert({
              title: "加载失败",
              message: e instanceof Error ? e.message : "无法初始化工作室",
              variant: "error",
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alert, reload]);

  useEffect(() => {
    if (!project) return;
    setUploadRole(inferCollectUploadRole(project));
  }, [
    project?.id,
    project?.chatHistory,
    project?.sheet,
    project?.meta?.workflow,
    project?.meta?.deliverable,
  ]);

  const capturePng = useCallback(async () => {
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    const el = document.getElementById("storyboard-sheet-export");
    if (!el) throw new Error("找不到故事版区域");
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            setTimeout(done, 4000);
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 300));
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      width: 1920,
      windowWidth: 1920,
    });
    return canvas.toDataURL("image/png");
  }, []);

  async function handleNewProject() {
    setLoading(true);
    try {
      const created = await createStoryboardProject({ title: "微剧故事版" });
      await reload(created.id);
    } catch (e) {
      await alert({
        title: "新建失败",
        message: e instanceof Error ? e.message : "无法创建故事版",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefUpload(
    file: File,
    opts: { label: string; role: "character" | "product" | "scene" | "other" },
  ) {
    if (!project) return;
    setRefBusy(true);
    try {
      await uploadStoryboardRef(project.id, file, opts);
      await reload(project.id);
    } finally {
      setRefBusy(false);
    }
  }

  async function handleRefRemove(refId: string) {
    if (!project) return;
    const ref = project.references.find((r) => r.id === refId);
    const roleLabel =
      ref?.role === "product" ? "产品图" : ref?.role === "character" ? "角色图" : "场景图";
    if (
      !(await doubleConfirm({
        title: `删除${roleLabel}`,
        message: `确定从本故事版移除这张${roleLabel}？`,
        secondTitle: "不可恢复",
        secondMessage: "删除后需重新上传，是否继续？",
        confirmLabel: "删除",
      }))
    ) {
      return;
    }
    setRefBusy(true);
    try {
      await removeStoryboardRef(project.id, refId);
      await reload(project.id);
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "无法删除参考图",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  if (needLogin) {
    return (
      <EcomLoginPrompt
        returnPath="/ecom/storyboard/micro-drama"
        message="加载微剧故事版需要登录。请点击下方按钮，经主站 Book 完成 SSO 后自动回到本页。"
      />
    );
  }

  if (loading || !project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#6e6e73]">
        正在打开故事版工作室…
      </div>
    );
  }

  return (
    <>
      <EcomWorkspaceLayout
        assistantHeader={
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-[#1d1d1f]">微剧故事版</h1>
                <p className="text-xs text-[#6e6e73]">厨卫清洁 · 10秒4镜 · Skill 策划</p>
              </div>
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={loading || refBusy}
                onClick={() => void handleNewProject()}
              >
                新建微剧故事版
              </EcomButtonSecondary>
            </div>
            <div className="mt-3">
              <StoryboardRefUploader
                references={project.references}
                onUpload={handleRefUpload}
                onRemove={handleRefRemove}
                busy={refBusy}
                activeRole={uploadRole}
                onActiveRoleChange={setUploadRole}
              />
            </div>
          </>
        }
        progress={
          <StoryboardProgressRail project={project} hasVideo={Boolean(videoAsset)} />
        }
        assistant={
          <StoryboardAssistantPanel
            project={project}
            chatModels={chatModels}
            imageModels={imageModels}
            videoModels={videoModels}
            settings={settings}
            onStreamingChange={setAssistantStreaming}
            onOpenSettings={() => setSettingsOpen(true)}
            onDeliverableReady={async () => {
              await reload(project.id);
            }}
            onRequestGenerateAllImages={() =>
              setGenerateAllImagesToken((t) => t + 1)
            }
            onRequestGenerateFullVideo={() =>
              setGenerateFullVideoToken((t) => t + 1)
            }
            onRequestMergePanelVideos={() =>
              setMergePanelVideosToken((t) => t + 1)
            }
            onAlert={alert}
          />
        }
      >
        <StoryboardContentPanel
          project={project}
          references={project.references}
          imageModels={imageModels}
          videoModels={videoModels}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
          onImageModelChange={(key) => {
            setSettings((s) => ({ ...s, imageModelKey: key }));
            updateStoryboardProject(project.id, {
              meta: {
                ...project.meta,
                workflow: { ...project.meta?.workflow, imageModelKey: key },
              },
            }).catch(() => undefined);
          }}
          onVideoModelChange={(key) => {
            setSettings((s) => ({ ...s, videoModelKey: key }));
            updateStoryboardProject(project.id, {
              settings: { ...project.settings, videoModelKey: key },
              meta: {
                ...project.meta,
                workflow: { ...project.meta?.workflow, videoModelKey: key },
              },
            }).catch(() => undefined);
          }}
          onImageSizeChange={(imageSize) => {
            setSettings((s) => ({ ...s, imageSize }));
            updateStoryboardProject(project.id, {
              meta: {
                ...project.meta,
                workflow: { ...project.meta?.workflow, imageSize },
              },
            }).catch(() => undefined);
          }}
          onVideoResolutionChange={(videoResolution) => {
            setSettings((s) => ({ ...s, videoResolution }));
            updateStoryboardProject(project.id, {
              meta: {
                ...project.meta,
                workflow: { ...project.meta?.workflow, videoResolution },
              },
            }).catch(() => undefined);
          }}
          onVideoR2vRatioChange={(videoR2vRatio) => {
            setSettings((s) => ({ ...s, videoR2vRatio }));
            updateStoryboardProject(project.id, {
              settings: { ...project.settings, videoR2vRatio },
            }).catch(() => undefined);
          }}
          onVideoSeedChange={(videoSeed) => {
            setSettings((s) => ({ ...s, videoSeed }));
            updateStoryboardProject(project.id, {
              settings: { ...project.settings, videoSeed },
            }).catch(() => undefined);
          }}
          onVideoPromptExtendChange={(videoPromptExtend) => {
            setSettings((s) => ({ ...s, videoPromptExtend }));
            updateStoryboardProject(project.id, {
              settings: { ...project.settings, videoPromptExtend },
            }).catch(() => undefined);
          }}
          durationSec={durationSec}
          aspectRatio={aspectRatio}
          videoAspectRatio={videoAspectRatio}
          onVideoAspectChange={setVideoAspectRatio}
          videoOssUrl={videoAsset?.ossUrl}
          streaming={assistantStreaming}
          onProjectChange={setProject}
          onDurationChange={(v) => {
            setDurationSec(v);
            updateStoryboardProject(project.id, {
              settings: { ...project.settings, durationSec: v, aspectRatio },
            }).catch(() => undefined);
          }}
          onAspectChange={(v) => {
            setAspectRatio(v);
            setVideoAspectRatio(v);
            updateStoryboardProject(project.id, {
              settings: { ...project.settings, durationSec, aspectRatio: v },
            }).catch(() => undefined);
          }}
          onPngReady={(url) =>
            setProject((p) => (p ? { ...p, sheetPngUrl: url } : p))
          }
          onVideoReady={() => reload(project.id)}
          onPrepareExport={setExportSheet}
          capturePng={capturePng}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
          onAlert={alert}
          generateAllImagesToken={generateAllImagesToken}
          generateFullVideoToken={generateFullVideoToken}
          mergePanelVideosToken={mergePanelVideosToken}
        />
      </EcomWorkspaceLayout>

      <StoryboardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        value={settings}
        onChange={(patch) => {
          const next = { ...settings, ...patch };
          setSettings(next);
          setDurationSec(next.durationSec);
          setAspectRatio(next.aspectRatio);
          updateStoryboardProject(project.id, {
            settings: {
              ...project.settings,
              durationSec: next.durationSec,
              aspectRatio: next.aspectRatio,
              videoModelKey: next.videoModelKey,
              dialogueLang: next.dialogueLang,
            },
            meta: {
              ...project.meta,
              workflow: {
                ...project.meta?.workflow,
                imageModelKey: next.imageModelKey,
                videoModelKey: next.videoModelKey,
              },
            },
          }).catch(() => undefined);
        }}
        chatModels={chatModels}
        onConfirm={() => setSettingsOpen(false)}
      />

      <EcomVideoPreviewDialog
        open={!!previewVideo}
        src={previewVideo?.src ?? ""}
        title={previewVideo?.title}
        onOpenChange={(open) => {
          if (!open) setPreviewVideo(null);
        }}
      />

      {(exportSheet ?? project.sheet) ? (
        <div className="pointer-events-none fixed -left-[9999px] top-0 z-0" aria-hidden>
          <StoryboardProSheetView
            sheet={(exportSheet ?? project.sheet)!}
            references={project.references}
            productName={project.meta?.deliverable?.productName}
            productHighlight={
              (exportSheet ?? project.sheet)?.overview.productHighlight ??
              (typeof project.meta?.deliverable?.params?.卖点 === "string"
                ? project.meta.deliverable.params.卖点
                : undefined)
            }
            projectKeywords={
              (typeof project.meta?.deliverable?.params?.关键词 === "string"
                ? project.meta.deliverable.params.关键词
                : undefined) ??
              project.meta?.deliverable?.productName ??
              undefined
            }
          />
        </div>
      ) : null}
    </>
  );
}
