"use client";

import {
  ComposeDialogsProvider,
  ComposeEditorFullscreen,
  ComposeFilmstripProvider,
  ComposeMiniTimelinePanel,
  ModalPortal,
  useComposeDialogs,
  useComposeFilmstripLoader,
  DEFAULT_COMPOSE_PROFILE,
  moveComposeClip,
  orderedComposeClips,
} from "@private/platform-compose-ui/editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomComposeClipAudioPickDialog } from "@/components/ecom-compose/ecom-compose-clip-audio-pick-dialog";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { SimpleFusionVideoSlotHoverActions } from "@/components/simple-fusion-video/simple-fusion-video-slot-hover-actions";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ECOM_WORKSPACE_RESULT_COLUMN_CLASS,
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ECOM_WORKSPACE_RESULT_LABEL_CLASS,
} from "@/lib/ecom-workspace-result-grid";
import { buildSimpleFusionComposeTtsOptions } from "@/lib/ecom-compose-tts-options";
import {
  assignSimpleFusionComposeClipExistingAudio,
  clearSimpleFusionComposeClipAudio,
  patchSimpleFusionProject,
  renderSimpleFusionCompose,
  uploadSimpleFusionComposeClip,
  uploadSimpleFusionComposeClipAudio,
  type SimpleFusionProject,
} from "@/lib/ecom-simple-fusion-video-api";
import { fetchEcomVideoFilmstrip } from "@/lib/ecom-video-edit-client";
import type { SimpleFusionPreviewSlot } from "@/lib/simple-fusion-preview-slots";
import {
  resolveComposeWorkbenchFromProject,
  type ComposeWorkbenchState,
} from "@/lib/simple-fusion-compose-workbench";
import { SIMPLE_FUSION_BGM_PRESETS } from "@/lib/simple-fusion-default-prompts";
import { cn } from "@/lib/utils";

type Props = {
  project: SimpleFusionProject;
  previewSlots: SimpleFusionPreviewSlot[];
  finalVideoUrl: string;
  composeGenerating: boolean;
  canEdit: boolean;
  onProject: (p: SimpleFusionProject) => void;
  onPreviewVideo: (src: string, title: string) => void;
  onDownloadFinal?: () => void;
  onComposeStarted?: () => void;
  onComposeFailed?: () => void;
};

function SimpleFusionComposeWorkbenchInner({
  project,
  previewSlots,
  finalVideoUrl,
  composeGenerating,
  canEdit,
  onProject,
  onPreviewVideo,
  onDownloadFinal,
  onComposeStarted,
  onComposeFailed,
}: Props) {
  const { alert, toast } = useComposeDialogs();
  const [workbench, setWorkbench] = useState<ComposeWorkbenchState>(() =>
    resolveComposeWorkbenchFromProject(project, previewSlots),
  );
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniPanelSession, setMiniPanelSession] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreenOpen]);
  const [exportBusy, setExportBusy] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const audioImportRef = useRef<HTMLInputElement>(null);
  const audioClipTargetRef = useRef<string | null>(null);
  const [audioPickOpen, setAudioPickOpen] = useState(false);
  const [audioPickClipId, setAudioPickClipId] = useState<string | null>(null);
  const [audioPickBusy, setAudioPickBusy] = useState(false);

  const ordered = useMemo(() => orderedComposeClips(workbench), [workbench]);
  const profile = workbench.profile ?? DEFAULT_COMPOSE_PROFILE;
  const filmstripActive = miniOpen || fullscreenOpen;
  const filmstrip = useComposeFilmstripLoader(project.id, ordered, filmstripActive);

  const composeSlotPoster = useMemo(() => {
    for (const c of ordered) {
      const poster = c.posterUrl?.trim();
      if (poster) return poster;
      const video = c.videoUrl?.trim();
      if (video) return video;
    }
    for (const s of previewSlots) {
      const fused = s.fusedImageUrl?.trim();
      if (fused) return fused;
    }
    return undefined;
  }, [ordered, previewSlots]);

  const finalComposeBusy = composeGenerating || exportBusy;
  const showFinalVideoHover =
    Boolean(finalVideoUrl.trim()) && !finalComposeBusy;

  useEffect(() => {
    setWorkbench(resolveComposeWorkbenchFromProject(project, previewSlots));
  }, [project.id, project.updatedAt, previewSlots]);

  useEffect(() => {
    const preset = project.settings.bgmPresetId?.trim();
    if (!preset) return;
    setWorkbench((prev) => {
      if (prev.profile?.audio?.bgmPresetId || prev.profile?.audio?.bgmUrl) return prev;
      return {
        ...prev,
        profile: {
          ...DEFAULT_COMPOSE_PROFILE,
          ...prev.profile,
          audio: {
            ...DEFAULT_COMPOSE_PROFILE.audio,
            ...prev.profile?.audio,
            bgmPresetId: preset,
            mixTts: true,
            dialogueVolume: 0.95,
            bgmFitTimeline: true,
          },
        },
      };
    });
  }, [project.id, project.settings.bgmPresetId]);

  const schedulePersist = useCallback(
    (next: ComposeWorkbenchState) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void patchSimpleFusionProject(project.id, {
          meta: { ...project.meta, composeWorkbench: next },
        })
          .then(onProject)
          .catch(() => undefined);
      }, 600);
    },
    [onProject, project.id, project.meta],
  );

  const workbenchRef = useRef(workbench);
  workbenchRef.current = workbench;

  const flushWorkbenchPersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    const next = workbenchRef.current;
    void patchSimpleFusionProject(project.id, {
      meta: { ...project.meta, composeWorkbench: next },
    })
      .then(onProject)
      .catch(() => undefined);
  }, [onProject, project.id, project.meta]);

  const applyWorkbench = useCallback(
    (
      updater: (prev: ComposeWorkbenchState) => ComposeWorkbenchState,
      opts?: { persist?: boolean },
    ) => {
      setWorkbench((prev) => {
        const next = updater(prev);
        if (opts?.persist !== false) schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const moveClip = (from: number, to: number) => {
    applyWorkbench((prev) => moveComposeClip(prev, from, to));
  };

  const runCompose = async () => {
    if (ordered.length < 1) {
      await alert({ title: "无法合成", message: "请至少保留 1 段视频", variant: "error" });
      return;
    }
    flushWorkbenchPersist();
    setExportBusy(true);
    onComposeStarted?.();
    try {
      const p = await renderSimpleFusionCompose(project.id, workbenchRef.current);
      onProject(p);
      toast?.({ title: "已开始云端合成", variant: "success" });
      setFullscreenOpen(false);
    } catch (e) {
      onComposeFailed?.();
      await alert({
        title: "合成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setExportBusy(false);
    }
  };

  const runDownload = () => {
    if (!finalVideoUrl.trim()) {
      void alert({
        title: "无法下载",
        message: "请先完成云端合成，成片会显示在「卡点成片」格子上。",
        variant: "info",
      });
      return;
    }
    onDownloadFinal?.();
  };

  const importVideo = async (file: File) => {
    try {
      const p = await uploadSimpleFusionComposeClip(project.id, file);
      onProject(p);
      toast?.({ title: "已导入片段", variant: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请稍后重试";
      await alert({
        title: "导入失败",
        message:
          msg.includes("video") || file.type.startsWith("video/")
            ? msg
            : `${msg}（当前成片轨道仅支持视频片段；图片请先转为视频再导入。）`,
        variant: "error",
      });
    }
  };

  const bgmPresets = useMemo(
    () => SIMPLE_FUSION_BGM_PRESETS.map((p) => ({ id: p.id, label: p.label })),
    [],
  );

  const pageTtsOptions = useMemo(
    () => buildSimpleFusionComposeTtsOptions(project, previewSlots, workbench.clips),
    [project, previewSlots, workbench.clips],
  );

  const audioPickClip = useMemo(
    () =>
      audioPickClipId
        ? workbench.clips.find((c) => c.id === audioPickClipId)
        : undefined,
    [audioPickClipId, workbench.clips],
  );

  const suggestedTtsOptionId = useMemo(() => {
    if (!audioPickClipId) return undefined;
    const clip = workbench.clips.find((c) => c.id === audioPickClipId);
    if (clip?.lookId) return `look-${clip.lookId}`;
    return pageTtsOptions.find((o) => o.suggestedClipId === audioPickClipId)?.id;
  }, [audioPickClipId, pageTtsOptions, workbench.clips]);

  const handleClipAudioAttach = (clipId: string) => {
    audioClipTargetRef.current = clipId;
    setAudioPickClipId(clipId);
    setAudioPickOpen(true);
  };

  const pickExistingTtsForClip = async (clipId: string, audioUrl: string, subtitle?: string) => {
    setAudioPickBusy(true);
    try {
      const p = await assignSimpleFusionComposeClipExistingAudio(project.id, clipId, {
        audioUrl,
        subtitle,
      });
      onProject(p);
      toast?.({ title: "已绑定配音", variant: "success" });
      setAudioPickOpen(false);
    } catch (e) {
      await alert({
        title: "绑定失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setAudioPickBusy(false);
    }
  };

  const openMiniCompose = () => {
    if (composeGenerating) {
      void alert({
        title: "合成进行中",
        message: "请等待卡点成片任务结束后再打开简易剪辑。",
        variant: "info",
      });
      return;
    }
    const next = resolveComposeWorkbenchFromProject(project, previewSlots);
    const clipCount = orderedComposeClips(next).length;
    if (clipCount < 1) {
      void alert({
        title: "暂无可剪辑片段",
        message: "请先完成各套「图生视频」片段，再使用简易剪辑。",
        variant: "info",
      });
      return;
    }
    setWorkbench(next);
    setMiniOpen(true);
    setMiniPanelSession((s) => s + 1);
  };

  const handleClipAudioClear = async (clipId: string) => {
    try {
      const p = await clearSimpleFusionComposeClipAudio(project.id, clipId);
      onProject(p);
    } catch (e) {
      await alert({
        title: "清除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  };

  return (
    <>
      {!fullscreenOpen ? (
        <section className="mb-6 space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">③ 卡点成片</h3>
            <p className="mt-1 text-[10px] text-[#86868b]">
              按当前片段顺序云端合成；需改顺序或精细裁剪请先「简易剪辑」。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <EcomButtonPrimary
              type="button"
              size="sm"
              disabled={!canEdit || ordered.length < 1 || finalComposeBusy}
              onClick={() => void runCompose()}
            >
              {exportBusy ? "合成中…" : "自动合成"}
            </EcomButtonPrimary>
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={composeGenerating}
              title={
                ordered.length < 1
                  ? "请先完成各套图生视频片段"
                  : !canEdit
                    ? "部分片段未完成时仍可预览时间线，完整编辑需全部片段就绪"
                    : undefined
              }
              onClick={openMiniCompose}
            >
              简易剪辑
            </EcomButtonSecondary>
          </div>

          <div className={ECOM_WORKSPACE_RESULT_GRID_CLASS}>
            <div className={ECOM_WORKSPACE_RESULT_COLUMN_CLASS}>
              <div
                className={cn(
                  "group/video relative",
                  showFinalVideoHover && "group/video-hover",
                )}
              >
                <EcomVideoSlot
                  src={finalVideoUrl.trim() || undefined}
                  aspectRatio="9:16"
                  layout="workspace"
                  generating={finalComposeBusy}
                  generatingPosterUrl={composeSlotPoster}
                  generatingLabel="合成卡点成片中…"
                  generatingBackground="light"
                  emptyLabel="待合成成片"
                  onPreview={
                    finalVideoUrl.trim()
                      ? () => onPreviewVideo(finalVideoUrl.trim(), "成片")
                      : undefined
                  }
                />
                {showFinalVideoHover ? (
                  <SimpleFusionVideoSlotHoverActions
                    onPreview={() =>
                      onPreviewVideo(finalVideoUrl.trim(), "成片")
                    }
                    onDownload={onDownloadFinal}
                  />
                ) : null}
              </div>
              <p className={ECOM_WORKSPACE_RESULT_LABEL_CLASS}>卡点成片</p>
            </div>
          </div>
        </section>
      ) : null}

      {miniOpen && !fullscreenOpen ? (
        <ModalPortal>
          <button
            type="button"
            aria-label="关闭简易剪辑"
            className="fixed inset-0 z-[3190] cursor-default bg-black/35"
            onClick={() => {
              flushWorkbenchPersist();
              setMiniOpen(false);
            }}
          />
          <ComposeMiniTimelinePanel
            key={miniPanelSession}
            projectId={project.id}
            ordered={ordered}
            workbench={workbench}
            loading={filmstrip.loading}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            exportBusy={exportBusy || composeGenerating}
            canEdit={canEdit && !composeGenerating}
            onClose={() => {
              flushWorkbenchPersist();
              setMiniOpen(false);
            }}
            onApplyWorkbench={applyWorkbench}
            onReorder={moveClip}
            onCompose={() => void runCompose()}
            canDownload={Boolean(finalVideoUrl.trim())}
            onDownload={() => runDownload()}
            onOpenFullscreen={() => {
              flushWorkbenchPersist();
              setMiniOpen(false);
              setFullscreenOpen(true);
            }}
            onImportClick={() => importRef.current?.click()}
            trackChrome={{ variant: "ecom-mini", showAudioAttach: true }}
            onClipAudioAttach={(id) => {
              audioClipTargetRef.current = id;
              void handleClipAudioAttach(id);
            }}
            onClipAudioClear={(id) => void handleClipAudioClear(id)}
          />
        </ModalPortal>
      ) : null}

      {fullscreenOpen ? (
        <ModalPortal>
          <ComposeEditorFullscreen
            projectId={project.id}
            projectModule={project.module}
            workbench={workbench}
            profile={profile}
            ordered={ordered}
            exportBusy={exportBusy || composeGenerating}
            loading={filmstrip.loading}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            onClose={() => {
              flushWorkbenchPersist();
              setFullscreenOpen(false);
              setMiniOpen(true);
            }}
            onApplyWorkbench={applyWorkbench}
            onCompose={() => void runCompose()}
            canDownload={Boolean(finalVideoUrl.trim())}
            onDownload={() => runDownload()}
            onImportClick={() => importRef.current?.click()}
            setProfile={(p) =>
              applyWorkbench((prev) => ({ ...prev, profile: p }))
            }
            bgmPresets={bgmPresets}
            trackChrome={{ variant: "fullscreen", zoomable: true, showAudioAttach: true }}
            onClipAudioAttach={(id) => void handleClipAudioAttach(id)}
            onClipAudioClear={(id) => void handleClipAudioClear(id)}
          />
        </ModalPortal>
      ) : null}

      <input
        ref={importRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importVideo(f);
        }}
      />
      {audioPickOpen ? (
        <ModalPortal>
          <EcomComposeClipAudioPickDialog
            open={audioPickOpen}
            clipLabel={audioPickClip?.label}
            options={pageTtsOptions}
            suggestedOptionId={suggestedTtsOptionId}
            busy={audioPickBusy}
            onClose={() => {
              if (audioPickBusy) return;
              setAudioPickOpen(false);
            }}
            onUploadLocal={() => {
              setAudioPickOpen(false);
              audioImportRef.current?.click();
            }}
            onPickTts={(opt) => {
              const clipId = audioPickClipId ?? audioClipTargetRef.current;
              if (!clipId) return;
              void pickExistingTtsForClip(clipId, opt.audioUrl, opt.voiceover);
            }}
          />
        </ModalPortal>
      ) : null}

      <input
        ref={audioImportRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const clipId = audioClipTargetRef.current;
          e.target.value = "";
          if (!f || !clipId) return;
          void (async () => {
            try {
              const p = await uploadSimpleFusionComposeClipAudio(project.id, clipId, f);
              onProject(p);
              toast?.({ title: "段配音已上传", variant: "success" });
            } catch (err) {
              await alert({
                title: "上传失败",
                message: err instanceof Error ? err.message : "请稍后重试",
                variant: "error",
              });
            }
          })();
        }}
      />
    </>
  );
}

export function SimpleFusionComposeWorkbench(props: Props) {
  const dialogs = useDialogs();
  const dialogApi = useMemo(
    () => ({
      alert: dialogs.alert,
      toast: dialogs.toast,
      confirm: dialogs.confirm,
      prompt: dialogs.prompt,
    }),
    [dialogs],
  );

  return (
    <ComposeDialogsProvider value={dialogApi}>
      <ComposeFilmstripProvider fetchFilmstrip={fetchEcomVideoFilmstrip}>
        <SimpleFusionComposeWorkbenchInner {...props} />
      </ComposeFilmstripProvider>
    </ComposeDialogsProvider>
  );
}
