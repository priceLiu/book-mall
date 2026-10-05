"use client";

import {
  appendImportedComposeClip,
  ComposeDialogsProvider,
  ComposeEditorFullscreen,
  ComposeFilmstripProvider,
  ComposeMiniTimelinePanel,
  ModalPortal,
  moveComposeClip,
  orderedComposeClips,
  updateComposeClip,
  useComposeDialogs,
  useComposeFilmstripLoader,
  DEFAULT_COMPOSE_PROFILE,
  type ComposeWorkbenchState,
} from "@private/platform-compose-ui/editor";
import type { ComposeWorkbenchClip } from "@private/platform-compose-ui/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { uploadCanvasVideo } from "@/lib/canvas-api";
import type { JianyingLibtvConnectionSnapshot } from "@/lib/canvas/jianying-from-workspace";
import { jianyingPairedUpstreamAudioUrlForVideoNode } from "@/lib/canvas/jianying-compose-workbench";
import { fetchVideoFilmstrip } from "@/lib/canvas/libtv-video-edit-client";

type Props = {
  base: string;
  projectId: string | null;
  nodeId: string;
  workbench: ComposeWorkbenchState;
  snapshot: JianyingLibtvConnectionSnapshot;
  upstreamLibraryClips?: ComposeWorkbenchClip[];
  composeMiniOpenSeq?: number;
  onWorkbenchChange: (next: ComposeWorkbenchState) => void;
  disabled?: boolean;
};

function JianyingComposeDockPanelInner({
  base,
  projectId,
  nodeId,
  workbench,
  snapshot,
  upstreamLibraryClips = [],
  composeMiniOpenSeq = 0,
  onWorkbenchChange,
  disabled,
}: Props) {
  const { alert, toast } = useComposeDialogs();
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniPanelSession, setMiniPanelSession] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const lastOpenSeqRef = useRef(0);
  const workbenchRef = useRef(workbench);
  workbenchRef.current = workbench;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const ordered = useMemo(() => orderedComposeClips(workbench), [workbench]);
  const profile = workbench.profile ?? DEFAULT_COMPOSE_PROFILE;
  const filmstripActive = miniOpen || fullscreenOpen;
  const filmstrip = useComposeFilmstripLoader(
    projectId ?? "canvas-compose",
    ordered,
    filmstripActive,
  );

  const applyWorkbench = useCallback(
    (
      updater: (prev: ComposeWorkbenchState) => ComposeWorkbenchState,
      opts?: { persist?: boolean },
    ) => {
      void opts;
      onWorkbenchChange(updater(workbenchRef.current));
    },
    [onWorkbenchChange],
  );

  const tryOpenMini = useCallback(() => {
    if (disabled || ordered.length < 1) return;
    setMiniOpen(true);
    setMiniPanelSession((s) => s + 1);
  }, [disabled, ordered.length]);

  const composeMiniOpenNodeId = useCanvasStore(
    (s) => s.jianyingComposeMiniOpenNodeId,
  );

  useEffect(() => {
    if (composeMiniOpenNodeId !== nodeId) return;
    if (composeMiniOpenSeq < 1 || composeMiniOpenSeq === lastOpenSeqRef.current) {
      return;
    }
    lastOpenSeqRef.current = composeMiniOpenSeq;
    tryOpenMini();
  }, [composeMiniOpenNodeId, composeMiniOpenSeq, nodeId, tryOpenMini]);

  const attachUpstreamAudio = useCallback(
    (clipId: string) => {
      const snap = snapshotRef.current;
      const url = jianyingPairedUpstreamAudioUrlForVideoNode(snap, clipId);
      if (url) {
        applyWorkbench((prev) => updateComposeClip(prev, clipId, { audioUrl: url }));
        return;
      }
      const videoIndex = snap.orderNodeIds.indexOf(clipId);
      const audioNodeId =
        videoIndex >= 0 ? snap.audioOrderNodeIds[videoIndex] : undefined;
      const audioOnly = audioNodeId
        ? upstreamLibraryClips.find((c) => c.id === `upstream-audio-${audioNodeId}`)
        : undefined;
      const fallback = upstreamLibraryClips.find((c) => c.audioUrl?.trim());
      const pick = audioOnly?.audioUrl?.trim()
        ? audioOnly
        : fallback?.audioUrl?.trim()
          ? fallback
          : undefined;
      if (pick?.audioUrl?.trim()) {
        applyWorkbench((prev) =>
          updateComposeClip(prev, clipId, { audioUrl: pick.audioUrl!.trim() }),
        );
        return;
      }
      void alert({
        title: "暂无连线配音",
        message: "请确认 TTS 节点已生成音频并连到自动成片的 in_audio，或于全屏「连线资产」中选择音频。",
        variant: "info",
      });
    },
    [alert, applyWorkbench, upstreamLibraryClips],
  );

  const importVideo = async (file: File) => {
    if (!projectId) {
      await alert({
        title: "无法导入",
        message: "请先保存画布项目后再导入视频。",
        variant: "error",
      });
      return;
    }
    try {
      const videoUrl = await uploadCanvasVideo(base, file);
      applyWorkbench((prev) =>
        appendImportedComposeClip(prev, {
          videoUrl,
          label: file.name.replace(/\.[^.]+$/, "") || "导入片段",
        }),
      );
      toast?.({ title: "已导入片段", variant: "success" });
    } catch (e) {
      await alert({
        title: "导入失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  };

  const moveClip = (from: number, to: number) => {
    applyWorkbench((prev) => moveComposeClip(prev, from, to));
  };

  return (
    <>
      {miniOpen && !fullscreenOpen ? (
        <ModalPortal>
          <button
            type="button"
            aria-label="关闭简易剪辑"
            className="fixed inset-0 z-[3190] cursor-default bg-black/35"
            onClick={() => setMiniOpen(false)}
          />
          <ComposeMiniTimelinePanel
            key={miniPanelSession}
            projectId={projectId ?? "canvas-compose"}
            ordered={ordered}
            workbench={workbench}
            loading={filmstrip.loading}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            exportBusy={false}
            canEdit={!disabled}
            onClose={() => setMiniOpen(false)}
            onApplyWorkbench={applyWorkbench}
            onReorder={moveClip}
            onExport={() => {
              void alert({
                title: "云端合成",
                message: "请点右上角全屏图标，在全屏剪辑台内使用「导出」提交云端合成。",
                variant: "info",
              });
            }}
            onOpenFullscreen={() => {
              setMiniOpen(false);
              setFullscreenOpen(true);
            }}
            onImportClick={() => importRef.current?.click()}
            trackChrome={{ variant: "ecom-mini", showAudioAttach: true }}
            onClipAudioAttach={(clipId) => attachUpstreamAudio(clipId)}
            onClipAudioClear={(clipId) =>
              applyWorkbench((prev) =>
                updateComposeClip(prev, clipId, { audioUrl: undefined }),
              )
            }
          />
        </ModalPortal>
      ) : null}

      {fullscreenOpen ? (
        <ModalPortal>
          <ComposeEditorFullscreen
            projectId={projectId ?? "canvas-compose"}
            projectModule="canvas"
            workbench={workbench}
            profile={profile}
            ordered={ordered}
            exportBusy={false}
            loading={filmstrip.loading}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            onClose={() => {
              setFullscreenOpen(false);
              setMiniOpen(true);
              setMiniPanelSession((s) => s + 1);
            }}
            onExport={() => {
              void alert({
                title: "云端合成",
                message: "请在本全屏页点击顶部「导出」提交云端合成。",
                variant: "info",
              });
            }}
            onImportClick={() => importRef.current?.click()}
            onApplyWorkbench={applyWorkbench}
            setProfile={(p) => applyWorkbench((prev) => ({ ...prev, profile: p }))}
            trackChrome={{ variant: "fullscreen", zoomable: true, showAudioAttach: true }}
            upstreamLibraryClips={upstreamLibraryClips}
            onClipAudioAttach={(clipId) => attachUpstreamAudio(clipId)}
            onClipAudioClear={(clipId) =>
              applyWorkbench((prev) =>
                updateComposeClip(prev, clipId, { audioUrl: undefined }),
              )
            }
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
    </>
  );
}

export function JianyingComposeDockPanel(props: Props) {
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
      <ComposeFilmstripProvider
        fetchFilmstrip={(args) =>
          fetchVideoFilmstrip({
            ...args,
            projectId: props.projectId ?? undefined,
          })
        }
      >
        <JianyingComposeDockPanelInner {...props} />
      </ComposeFilmstripProvider>
    </ComposeDialogsProvider>
  );
}
