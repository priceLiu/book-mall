"use client";

import {
  ComposeDialogsProvider,
  ComposeEditorFullscreen,
  ComposeFilmstripProvider,
  ComposeMiniTimelinePanel,
  DEFAULT_COMPOSE_PROFILE,
  ModalPortal,
  useComposeDialogs,
  orderedComposeClips,
  orderedComposeAudioClips,
  type ComposeWorkbenchState,
  useComposeFilmstripLoader,
  type ComposeDialogsApi,
} from "@private/platform-compose-ui/editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { requestCanvasGraphPersistFlush } from "@/lib/canvas/canvas-persist-request";
import { exportLibtvComposeTrim } from "@/lib/canvas/libtv-video-compose-trim-export";
import {
  fetchVideoFilmstrip,
  resolveLibtvVideoEditSourceUrl,
} from "@/lib/canvas/libtv-video-edit-client";
import {
  cloneComposeWorkbenchState,
  resolveLibtvVideoTrimWorkbench,
} from "@/lib/canvas/libtv-video-compose-workbench";
import { composeWorkbenchStructuralEquals } from "@/lib/canvas/jianying-compose-workbench-sync";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";

const PERSIST_DEBOUNCE_MS = 400;

function readPersistedDraft(
  data: Sbv1VideoEngineNodeData | undefined,
): ComposeWorkbenchState | null {
  return (
    data?.composeTrimWorkbenchDraft ??
    data?.composeTrimWorkbench ??
    null
  );
}

function readPersistedCommitted(
  data: Sbv1VideoEngineNodeData | undefined,
): ComposeWorkbenchState | null {
  return data?.composeTrimWorkbenchCommitted ?? null;
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

  const nodeLabel = nodeData?.label?.trim() || "节点视频";

  const resolveWorkbench = useCallback(
    (persisted?: ComposeWorkbenchState | null) => {
      if (!sourceVideoUrl) {
        return {
          orderedClipIds: [],
          clips: [],
          profile: DEFAULT_COMPOSE_PROFILE,
        } satisfies ComposeWorkbenchState;
      }
      return resolveLibtvVideoTrimWorkbench({
        nodeId,
        sourceVideoUrl,
        label: nodeLabel,
        nodes,
        edges,
        persisted: persisted ?? null,
      });
    },
    [nodeId, sourceVideoUrl, nodeLabel, nodes, edges],
  );

  const [miniOpen, setMiniOpen] = useState(true);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [composeStatusLine, setComposeStatusLine] = useState<string | null>(
    null,
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [draftWorkbench, setDraftWorkbench] = useState<ComposeWorkbenchState>(
    () => resolveWorkbench(readPersistedDraft(nodeData)),
  );
  const [hasEverComposed, setHasEverComposed] = useState(
    () =>
      readPersistedCommitted(nodeData) != null ||
      Boolean(nodeData?.lastComposeTrimResultNodeId),
  );
  const [committedWorkbench, setCommittedWorkbench] =
    useState<ComposeWorkbenchState>(() => {
      const committed = readPersistedCommitted(nodeData);
      if (committed) return resolveWorkbench(committed);
      return resolveWorkbench(readPersistedDraft(nodeData));
    });

  const sourceKeyRef = useRef(sourceVideoUrl);
  useEffect(() => {
    if (!sourceVideoUrl) return;
    if (sourceVideoUrl === sourceKeyRef.current) return;
    sourceKeyRef.current = sourceVideoUrl;
    setDraftWorkbench((prev) => resolveWorkbench(prev));
    setCommittedWorkbench((prev) => resolveWorkbench(prev));
  }, [sourceVideoUrl, resolveWorkbench]);

  const draftRef = useRef(draftWorkbench);
  draftRef.current = draftWorkbench;
  const committedRef = useRef(committedWorkbench);
  committedRef.current = committedWorkbench;

  const miniWorkbench = hasEverComposed ? committedWorkbench : draftWorkbench;

  const hasUncomposedDraft = useMemo(
    () =>
      hasEverComposed &&
      !composeWorkbenchStructuralEquals(draftWorkbench, committedWorkbench),
    [hasEverComposed, draftWorkbench, committedWorkbench],
  );

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPersist = useCallback(
    (draft: ComposeWorkbenchState, committed: ComposeWorkbenchState) => {
      updateNodeData(nodeId, {
        composeTrimWorkbenchDraft: draft,
        composeTrimWorkbenchCommitted: hasEverComposed ? committed : null,
        composeTrimWorkbench: null,
      });
      requestCanvasGraphPersistFlush({ immediate: true });
    },
    [nodeId, updateNodeData, hasEverComposed],
  );

  const schedulePersistDraft = useCallback(
    (draft: ComposeWorkbenchState) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        flushPersist(draft, committedRef.current);
      }, PERSIST_DEBOUNCE_MS);
    },
    [flushPersist],
  );

  useEffect(
    () => () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    },
    [],
  );

  const miniOrdered = useMemo(
    () => orderedComposeClips(miniWorkbench),
    [miniWorkbench],
  );
  const draftOrdered = useMemo(
    () => orderedComposeClips(draftWorkbench),
    [draftWorkbench],
  );
  const draftAudio = useMemo(
    () => orderedComposeAudioClips(draftWorkbench),
    [draftWorkbench],
  );
  const hasAudioTrack = draftAudio.length > 0;

  const filmstripActive = miniOpen || fullscreenOpen;
  const miniFilmstrip = useComposeFilmstripLoader(
    projectId ?? "canvas-video-trim",
    miniOrdered,
    filmstripActive && !fullscreenOpen,
  );
  const fsFilmstrip = useComposeFilmstripLoader(
    projectId ?? "canvas-video-trim",
    draftOrdered,
    fullscreenOpen,
  );

  const closeSession = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    flushPersist(draftRef.current, committedRef.current);
    updateNodeData(nodeId, { videoEditSession: { open: false } });
    setMiniOpen(false);
    setFullscreenOpen(false);
  }, [nodeId, updateNodeData, flushPersist]);

  const applyDraftWorkbench = useCallback(
    (updater: (prev: ComposeWorkbenchState) => ComposeWorkbenchState) => {
      setDraftWorkbench((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        schedulePersistDraft(next);
        return next;
      });
    },
    [schedulePersistDraft],
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
      const saved = draftRef.current;
      const targetId = await exportLibtvComposeTrim({
        sourceNodeId: nodeId,
        projectId,
        base,
        workbench: saved,
        fullDurationByUrl: fsFilmstrip.fullDurationByUrl,
        selectedClipId,
        store,
        updateNodeData: (id, patch) => updateNodeData(id, patch),
        onComposeProgress: setComposeStatusLine,
      });
      const committedSnap = cloneComposeWorkbenchState(saved);
      setHasEverComposed(true);
      setCommittedWorkbench(committedSnap);
      committedRef.current = committedSnap;
      updateNodeData(nodeId, {
        composeTrimWorkbenchDraft: saved,
        composeTrimWorkbenchCommitted: committedSnap,
        composeTrimWorkbench: null,
        lastComposeTrimResultNodeId: targetId,
      });
      requestCanvasGraphPersistFlush({ immediate: true });
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
    fsFilmstrip.fullDurationByUrl,
    nodeId,
    projectId,
    sourceVideoUrl,
    store,
    toast,
    updateNodeData,
    selectedClipId,
  ]);

  const miniPanelTitle = hasUncomposedDraft
    ? "节点剪辑 · 上次合成成片"
    : "节点剪辑";

  const trackChrome = useMemo(
    () => ({
      zoomable: true as const,
      showVideoImport: false as const,
      showAudioAttach: hasAudioTrack,
    }),
    [hasAudioTrack],
  );

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
            ordered={miniOrdered}
            workbench={miniWorkbench}
            loading={miniFilmstrip.loading}
            loadingLabel={miniFilmstrip.loadingLabel}
            filmstripByUrl={miniFilmstrip.filmstripByUrl}
            fullDurationByUrl={miniFilmstrip.fullDurationByUrl}
            exportBusy={exportBusy}
            composeStatusLine={composeStatusLine}
            canEdit={false}
            panelTitle={miniPanelTitle}
            composeActionTitle="生成剪辑片段"
            showDownloadButton={false}
            onClose={closeSession}
            onApplyWorkbench={() => undefined}
            onReorder={() => undefined}
            onCompose={() => void exportSelectedClip()}
            onOpenFullscreen={() => {
              setMiniOpen(false);
              setFullscreenOpen(true);
            }}
            onImportClick={() => undefined}
            onSelectedIdChange={setSelectedClipId}
            trackChrome={{
              variant: "ecom-mini",
              ...trackChrome,
            }}
          />
          {hasUncomposedDraft ? (
            <p className="pointer-events-none fixed bottom-6 left-1/2 z-[3200] max-w-[min(92vw,28rem)] -translate-x-1/2 rounded-full border border-amber-400/35 bg-black/75 px-4 py-1.5 text-center text-[11px] text-amber-100/95">
              全屏内有未合成修改；迷你窗仍为上次合成时间线。请进全屏确认后再点「生成剪辑片段」。
            </p>
          ) : null}
        </ModalPortal>
      ) : null}

      {fullscreenOpen ? (
        <ModalPortal>
          <ComposeEditorFullscreen
            projectId={projectId ?? "canvas-video-trim"}
            projectModule="canvas"
            workbench={draftWorkbench}
            profile={draftWorkbench.profile ?? DEFAULT_COMPOSE_PROFILE}
            ordered={draftOrdered}
            exportBusy={exportBusy}
            composeStatusLine={composeStatusLine}
            composeActionTitle="生成剪辑片段"
            showDownloadButton={false}
            brightChrome
            loading={fsFilmstrip.loading}
            loadingLabel={fsFilmstrip.loadingLabel}
            filmstripByUrl={fsFilmstrip.filmstripByUrl}
            fullDurationByUrl={fsFilmstrip.fullDurationByUrl}
            onClose={() => {
              setFullscreenOpen(false);
              setMiniOpen(true);
            }}
            onCompose={() => void exportSelectedClip()}
            onImportClick={() => undefined}
            onApplyWorkbench={applyDraftWorkbench}
            setProfile={(p) =>
              applyDraftWorkbench((prev) => ({ ...prev, profile: p }))
            }
            trackChrome={{
              variant: "fullscreen",
              ...trackChrome,
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
