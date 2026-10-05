"use client";

import {
  appendImportedComposeClip,
  ComposeDialogsProvider,
  ComposeEditorFullscreen,
  ComposeFilmstripProvider,
  ComposeMiniTimelinePanel,
  ModalPortal,
  moveComposeClip,
  orderedComposeAudioClips,
  orderedComposeClips,
  useComposeDialogs,
  useComposeFilmstripLoader,
  DEFAULT_COMPOSE_PROFILE,
  type ComposeWorkbenchState,
} from "@private/platform-compose-ui/editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { uploadCanvasVideo } from "@/lib/canvas-api";
import type { JianyingLibtvConnectionSnapshot } from "@/lib/canvas/jianying-from-workspace";
import { useJianyingComposeMediaRender } from "@/lib/canvas/jianying-compose-media-render";
import { fetchVideoFilmstrip } from "@/lib/canvas/libtv-video-edit-client";
import type { JianyingAutoRenderNodeData } from "@/lib/canvas/types";

type Props = {
  base: string;
  projectId: string | null;
  nodeId: string;
  workbench: ComposeWorkbenchState;
  snapshot: JianyingLibtvConnectionSnapshot;
  upstreamLibraryClips?: import("@private/platform-compose-ui/types").ComposeWorkbenchClip[];
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

  const ordered = useMemo(() => orderedComposeClips(workbench), [workbench]);
  const orderedAudio = useMemo(
    () => orderedComposeAudioClips(workbench),
    [workbench],
  );
  const profile = workbench.profile ?? DEFAULT_COMPOSE_PROFILE;
  const filmstripActive = miniOpen || fullscreenOpen;
  const filmstrip = useComposeFilmstripLoader(
    projectId ?? "canvas-compose",
    ordered,
    filmstripActive,
  );

  const nodeMedia = useCanvasStore(
    useCallback(
      (s) => {
        const d = s.nodes.find((n) => n.id === nodeId)?.data as
          | JianyingAutoRenderNodeData
          | undefined;
        return {
          mediaRenderResult: d?.mediaRenderResult ?? null,
          videoUrl: d?.videoUrl ?? null,
        };
      },
      [nodeId],
    ),
  );

  const { composeBusy, canDownload, runCompose, runDownload } =
    useJianyingComposeMediaRender({
      nodeId,
      base,
      projectId,
      mediaRenderResult: nodeMedia.mediaRenderResult,
      videoUrl: nodeMedia.videoUrl,
    });

  const applyWorkbench = useCallback(
    (
      updater: (prev: ComposeWorkbenchState) => ComposeWorkbenchState,
      opts?: { persist?: boolean },
    ) => {
      void opts;
      const next = updater(workbenchRef.current);
      if (next === workbenchRef.current) return;
      onWorkbenchChange(next);
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
            exportBusy={composeBusy}
            canEdit={!disabled}
            onClose={() => setMiniOpen(false)}
            onApplyWorkbench={applyWorkbench}
            onReorder={moveClip}
            onCompose={() => {
              void (async () => {
                try {
                  onWorkbenchChange(workbenchRef.current);
                  await runCompose(
                    workbenchRef.current,
                    filmstrip.fullDurationByUrl,
                  );
                  toast?.({ title: "成片已更新到自动成片节点", variant: "success" });
                } catch (e) {
                  await alert({
                    title: "合成失败",
                    message: e instanceof Error ? e.message : "请稍后重试",
                    variant: "error",
                  });
                }
              })();
            }}
            canDownload={canDownload}
            onDownload={() => {
              void (async () => {
                try {
                  await runDownload();
                } catch (e) {
                  await alert({
                    title: "无法下载",
                    message: e instanceof Error ? e.message : "请稍后重试",
                    variant: "error",
                  });
                }
              })();
            }}
            onOpenFullscreen={() => {
              setMiniOpen(false);
              setFullscreenOpen(true);
            }}
            onImportClick={() => importRef.current?.click()}
            trackChrome={{ variant: "ecom-mini", showAudioAttach: false }}
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
            exportBusy={composeBusy}
            loading={filmstrip.loading}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            onClose={() => {
              setFullscreenOpen(false);
              setMiniOpen(true);
              setMiniPanelSession((s) => s + 1);
            }}
            onCompose={() => {
              void (async () => {
                try {
                  onWorkbenchChange(workbenchRef.current);
                  await runCompose(
                    workbenchRef.current,
                    filmstrip.fullDurationByUrl,
                  );
                  toast?.({ title: "成片已更新到自动成片节点", variant: "success" });
                  setFullscreenOpen(false);
                  setMiniOpen(true);
                  setMiniPanelSession((s) => s + 1);
                } catch (e) {
                  await alert({
                    title: "合成失败",
                    message: e instanceof Error ? e.message : "请稍后重试",
                    variant: "error",
                  });
                }
              })();
            }}
            canDownload={canDownload}
            onDownload={() => {
              void (async () => {
                try {
                  await runDownload();
                } catch (e) {
                  await alert({
                    title: "无法下载",
                    message: e instanceof Error ? e.message : "请稍后重试",
                    variant: "error",
                  });
                }
              })();
            }}
            onImportClick={() => importRef.current?.click()}
            onApplyWorkbench={applyWorkbench}
            setProfile={(p) => applyWorkbench((prev) => ({ ...prev, profile: p }))}
            trackChrome={{ variant: "fullscreen", zoomable: true, showAudioAttach: false }}
            upstreamLibraryClips={upstreamLibraryClips}
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
    }),
    [dialogs.alert, dialogs.toast],
  );

  return (
    <ComposeDialogsProvider value={dialogApi}>
      <ComposeFilmstripProvider fetchFilmstrip={fetchVideoFilmstrip}>
        <JianyingComposeDockPanelInner {...props} />
      </ComposeFilmstripProvider>
    </ComposeDialogsProvider>
  );
}
