"use client";

import {
  ComposeDialogsProvider,
  ComposeEditorFullscreen,
  ComposeFilmstripProvider,
  ComposeMiniTimelinePanel,
  DEFAULT_COMPOSE_PROFILE,
  ModalPortal,
  useComposeDialogs,
  moveComposeClip,
  orderedComposeClips,
  type ComposeWorkbenchState,
  useComposeFilmstripLoader,
  type ComposeDialogsApi,
} from "@private/platform-compose-ui/editor";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { exportLibtvComposeTrim } from "@/lib/canvas/libtv-video-compose-trim-export";
import {
  fetchVideoFilmstrip,
  resolveLibtvVideoEditSourceUrl,
} from "@/lib/canvas/libtv-video-edit-client";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";

function buildSingleClipWorkbench(
  videoUrl: string,
  label: string,
): ComposeWorkbenchState {
  const id = `libtv-trim-${nanoid(8)}`;
  return {
    orderedClipIds: [id],
    clips: [
      {
        id,
        videoUrl,
        label,
        source: "import",
      },
    ],
    orderedAudioClipIds: [],
    audioClips: [],
    profile: DEFAULT_COMPOSE_PROFILE,
  };
}

function LibtvVideoComposeTrimPanelInner({ nodeId }: { nodeId: string }) {
  const { alert, toast } = useComposeDialogs();
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const nodeData = useCanvasStore(
    useCallback(
      (s) =>
        s.nodes.find((n) => n.id === nodeId)?.data as
          | Sbv1VideoEngineNodeData
          | undefined,
      [nodeId],
    ),
  );

  const { succeeded } = useNodeTaskHistory(nodeId);
  const latestSucceeded = succeeded[succeeded.length - 1];
  const taskMediaUrl =
    pickTaskResultMediaUrl(latestSucceeded ?? {}) ??
    latestSucceeded?.ossUrl ??
    undefined;

  const sourceVideoUrl = useMemo(
    () =>
      resolveLibtvVideoEditSourceUrl({
        ossUrl: nodeData?.ossUrl,
        runtime: nodeData?.runtime,
        fallbackTaskMediaUrl: taskMediaUrl,
      }),
    [nodeData?.ossUrl, nodeData?.runtime, taskMediaUrl],
  );

  const [miniOpen, setMiniOpen] = useState(true);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [composeStatusLine, setComposeStatusLine] = useState<string | null>(
    null,
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [workbench, setWorkbench] = useState<ComposeWorkbenchState>(() =>
    sourceVideoUrl
      ? buildSingleClipWorkbench(
          sourceVideoUrl,
          nodeData?.label?.trim() || "节点视频",
        )
      : {
          orderedClipIds: [],
          clips: [],
          profile: DEFAULT_COMPOSE_PROFILE,
        },
  );

  const sourceKeyRef = useRef(sourceVideoUrl);
  useEffect(() => {
    if (!sourceVideoUrl || sourceVideoUrl === sourceKeyRef.current) return;
    sourceKeyRef.current = sourceVideoUrl;
    setWorkbench(
      buildSingleClipWorkbench(
        sourceVideoUrl,
        nodeData?.label?.trim() || "节点视频",
      ),
    );
  }, [sourceVideoUrl, nodeData?.label]);

  const workbenchRef = useRef(workbench);
  workbenchRef.current = workbench;

  const ordered = useMemo(() => orderedComposeClips(workbench), [workbench]);
  const filmstripActive = miniOpen || fullscreenOpen;
  const filmstrip = useComposeFilmstripLoader(
    projectId ?? "canvas-video-trim",
    ordered,
    filmstripActive,
  );

  const closeSession = useCallback(() => {
    updateNodeData(nodeId, { videoEditSession: { open: false } });
    setMiniOpen(false);
    setFullscreenOpen(false);
  }, [nodeId, updateNodeData]);

  const applyWorkbench = useCallback(
    (updater: (prev: ComposeWorkbenchState) => ComposeWorkbenchState) => {
      setWorkbench((prev) => updater(prev));
    },
    [],
  );

  const store = useMemo(
    () => ({ nodes, edges, addNode, addNodeInGroup, setNodes, setEdges }),
    [nodes, edges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const exportSelectedClip = useCallback(async () => {
    if (!sourceVideoUrl || exportBusy) return;
    setExportBusy(true);
    setComposeStatusLine(null);
    try {
      await exportLibtvComposeTrim({
        sourceNodeId: nodeId,
        projectId,
        base,
        workbench: workbenchRef.current,
        fullDurationByUrl: filmstrip.fullDurationByUrl,
        selectedClipId,
        store,
        updateNodeData: (id, patch) => updateNodeData(id, patch),
        onComposeProgress: setComposeStatusLine,
      });
      closeSession();
      if (toast) {
        toast({ title: "剪辑完成", variant: "success" });
      } else {
        await alert({
          title: "剪辑完成",
          message: "已在源节点右侧生成剪辑片段节点。",
          variant: "success",
        });
      }
    } catch (e) {
      await alert({
        title: "剪辑失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setExportBusy(false);
      setComposeStatusLine(null);
    }
  }, [
    alert,
    base,
    closeSession,
    exportBusy,
    filmstrip.fullDurationByUrl,
    nodeId,
    projectId,
    sourceVideoUrl,
    store,
    toast,
    updateNodeData,
    selectedClipId,
  ]);

  if (!sourceVideoUrl) {
    return null;
  }

  return (
    <>
      {miniOpen && !fullscreenOpen ? (
        <ModalPortal>
          <button
            type="button"
            aria-label="关闭剪辑"
            className="fixed inset-0 z-[3190] cursor-default bg-black/35"
            onClick={closeSession}
          />
          <ComposeMiniTimelinePanel
            projectId={projectId ?? "canvas-video-trim"}
            ordered={ordered}
            workbench={workbench}
            loading={filmstrip.loading}
            loadingLabel={filmstrip.loadingLabel}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            exportBusy={exportBusy}
            composeStatusLine={composeStatusLine}
            canEdit={!exportBusy}
            panelTitle="节点剪辑"
            composeActionTitle="生成剪辑片段"
            showDownloadButton={false}
            onClose={closeSession}
            onApplyWorkbench={applyWorkbench}
            onReorder={(from, to) =>
              applyWorkbench((prev) => moveComposeClip(prev, from, to))
            }
            onCompose={() => void exportSelectedClip()}
            onOpenFullscreen={() => {
              setMiniOpen(false);
              setFullscreenOpen(true);
            }}
            onImportClick={() => undefined}
            onSelectedIdChange={setSelectedClipId}
            trackChrome={{
              variant: "ecom-mini",
              zoomable: true,
              showVideoImport: false,
              showAudioAttach: false,
            }}
          />
        </ModalPortal>
      ) : null}

      {fullscreenOpen ? (
        <ModalPortal>
          <ComposeEditorFullscreen
            projectId={projectId ?? "canvas-video-trim"}
            projectModule="canvas"
            workbench={workbench}
            profile={workbench.profile ?? DEFAULT_COMPOSE_PROFILE}
            ordered={ordered}
            exportBusy={exportBusy}
            composeStatusLine={composeStatusLine}
            composeActionTitle="生成剪辑片段"
            showDownloadButton={false}
            brightChrome
            loading={filmstrip.loading}
            loadingLabel={filmstrip.loadingLabel}
            filmstripByUrl={filmstrip.filmstripByUrl}
            fullDurationByUrl={filmstrip.fullDurationByUrl}
            onClose={() => {
              setFullscreenOpen(false);
              setMiniOpen(true);
            }}
            onCompose={() => void exportSelectedClip()}
            onImportClick={() => undefined}
            onApplyWorkbench={applyWorkbench}
            setProfile={(p) =>
              applyWorkbench((prev) => ({ ...prev, profile: p }))
            }
            trackChrome={{
              variant: "fullscreen",
              zoomable: true,
              showVideoImport: false,
              showAudioAttach: false,
            }}
            upstreamLibraryClips={[]}
            onSelectedIdChange={setSelectedClipId}
          />
        </ModalPortal>
      ) : null}
    </>
  );
}

export function LibtvVideoComposeTrimPanel() {
  const activeNodeId = useCanvasStore((s) => {
    for (const n of s.nodes) {
      if (n.type !== "sbv1-video-engine") continue;
      const session = (n.data as Sbv1VideoEngineNodeData | undefined)
        ?.videoEditSession;
      if (!session?.open) continue;
      const mode = session.mode as string;
      if (mode === "compose-trim" || mode === "trim-clip") {
        return n.id;
      }
    }
    return null;
  });

  const dialogs = useDialogs();
  const dialogApi = useMemo<ComposeDialogsApi>(
    () => ({
      alert: (opts) =>
        dialogs.alert({
          title: opts.title,
          message: opts.message,
          variant: opts.variant,
        }),
    }),
    [dialogs],
  );

  if (!activeNodeId) return null;

  return (
    <ComposeDialogsProvider value={dialogApi}>
      <ComposeFilmstripProvider fetchFilmstrip={fetchVideoFilmstrip}>
        <LibtvVideoComposeTrimPanelInner key={activeNodeId} nodeId={activeNodeId} />
      </ComposeFilmstripProvider>
    </ComposeDialogsProvider>
  );
}
