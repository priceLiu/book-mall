"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { handleCanvasWheel } from "@/lib/canvas/canvas-form-wheel";
import { registerCanvasNotifier } from "@/lib/canvas/canvas-notify";
import { CanvasCreditsToastHost } from "@/components/canvas/canvas-credits-toast-host";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { Pro2CanvasLayout } from "@/components/canvas/pro2/pro2-canvas-layout";
import { Sbv1CanvasLayout } from "@/components/canvas/sbv1/sbv1-canvas-layout";
import { ScriptWritingAssistantPanel } from "@/components/canvas/script-writing-assistant-panel";
import { MyTemplatesPanel } from "@/components/canvas/my-templates-panel";
import { MyCharactersPanel } from "@/components/canvas/my-characters-panel";
import { MySavedScriptsPanel } from "@/components/canvas/my-saved-scripts-panel";
import { MyVideoLibraryPanel } from "@/components/canvas/my-video-library-panel";
import { MyProjectCharacterAssetsPanel } from "@/components/canvas/my-project-character-assets-panel";
import { StyleLibraryModal } from "@/components/canvas/style-library-modal";
import { NodePalette } from "@/components/canvas/node-palette";
import { CanvasToolbar } from "@/components/canvas/toolbar";
import { useCanvasStore } from "@/lib/canvas/store";
import { useCanvasGraphSnapshot } from "@/lib/canvas/canvas-store-hooks";
import {
  busEnqueueNodesSequential,
  busEnqueueStoryRunsSequential,
} from "@/lib/canvas/canvas-run-bus";
import { collectStoryWorkspaceRunJobs } from "@/lib/canvas/story-run-all";
import {
  CanvasRunnerHost,
  useCanvasInflightTaskCount,
} from "@/lib/canvas/run-queue";
import { stripRuntimeForTemplate } from "@/lib/canvas/sanitize";
import { stripStoryProUploadedScriptMdForPersist } from "@/lib/canvas/story-pro-upload-script";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
import { buildImageEngineDataFromPreset } from "@/lib/canvas/image-engine-presets";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import { topoSort } from "@/lib/canvas/topo";
import type {
  CanvasContentNodeType,
  CanvasNodeType,
} from "@/lib/canvas/types";
import { isRunnableNodeType } from "@/lib/canvas/types";
import {
  clearCanvasProjectTasksForbidden,
  getCanvasProject,
  listCanvasProjectHistory,
  patchCanvasProject,
  saveCanvasTemplate,
  type CanvasCharacterRecord,
  type CanvasProjectDetail,
} from "@/lib/canvas-api";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import { GatewayLinkBanner } from "@/components/canvas/gateway-link-banner";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";
import { prefetchUserProviders } from "@/lib/canvas/use-user-providers";
import { hasStoryComicPipeline } from "@/lib/canvas/story-comic-layout";
import { hasStoryProPipeline } from "@/lib/canvas/story-pro-workspace-layout";
import { resolveCanvasLayoutShell } from "@/lib/canvas/canvas-layout-mode";
import { canAddStoryNodeType } from "@/lib/canvas/story-edition-isolation";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { resolveStoryProAssistantImport } from "@/lib/canvas/story-pro-script-assistant";
import { STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT } from "@/lib/canvas/story-pro-theme-templates";
import { spawnStoryProScriptHub } from "@/lib/canvas/spawn-story-pro-workspace";
import { spawnStoryPro2ScriptHub } from "@/lib/canvas/spawn-story-pro2-workspace";
import { reflowStoryProWorkspace } from "@/lib/canvas/story-pro-workspace-layout";
import { reflowStoryPro2Workspace } from "@/lib/canvas/story-pro2-workspace-layout";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { pickProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";
import { cn } from "@/lib/utils";
import { useCanvasImmersiveMode } from "@/lib/canvas/use-canvas-immersive-mode";
import { getBuiltinCanvasTemplate } from "@/lib/canvas/templates";
import { SBV1_BUILTIN_TEMPLATE_ID } from "@/lib/canvas/project-edition";
import { SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";
import { MyCanvasHistoryPanel } from "@/components/canvas/my-canvas-history-panel";
import { MyCanvasGenerationRecordsPanel } from "@/components/canvas/my-canvas-generation-records-panel";
import { SaveProjectAssetDialogHost } from "@/components/canvas/save-project-asset-dialog";
import { PortraitImportProgressHost } from "@/components/canvas/portrait-import-progress-dialog";
import { useRegisterProjectAssetCanvasInsert } from "@/lib/canvas/use-register-project-asset-canvas-insert";
import { CANVAS_AUTOSAVE_DEBOUNCE_MS, getCanvasAutosaveIntervalMs } from "@/lib/canvas/canvas-autosave-settings";
import { getCanvasProjectHistoryEntry } from "@/lib/canvas-api";
const STORY_COMIC_TEMPLATE_ID = "builtin/story-comic-pipeline";

function Inner({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const {
    linked: gatewayLinked,
    accountUrl: gatewayAccountUrl,
    loading: gatewayLinkLoading,
  } = useGatewayLinkStatus();
  const gatewayLinkBlocked = !gatewayLinkLoading && !gatewayLinked;
  const dialogs = useDialogs();

  useEffect(() => {
    prefetchUserProviders(base);
  }, [base]);
  const hydrate = useCanvasStore((s) => s.hydrate);
  const toGraph = useCanvasStore((s) => s.toGraph);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const { nodes, edges } = useCanvasGraphSnapshot();
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );
  const isStoryComicCanvas = hasStoryComicPipeline(nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const focusCanvasNode = useCanvasStore((s) => s.focusCanvasNode);

  const onImportScriptFromAssistant = useCallback(
    async (md: string) => {
      const state = useCanvasStore.getState();
      const plan = resolveStoryProAssistantImport(state.nodes, state.edges);
      if (!plan.allowed) {
        await dialogs.alert({
          title: "无法导入",
          message: plan.reason,
          variant: "warning",
        });
        return;
      }

      const isPro2 = plan.edition === "pro2";
      const starterType = isPro2 ? "story-pro2-starter" : "story-pro-starter";
      const seedStarter = state.nodes.find((n) => n.type === starterType);
      const seedData = (seedStarter?.data ?? {}) as StoryProStarterNodeData;
      const llmSeed = {
        providerId: seedData.providerId ?? "",
        modelKey: seedData.modelKey ?? "",
        params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(seedData.params ?? {}) },
        systemPrompt:
          seedData.systemPrompt?.trim() ||
          STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT,
      };

      if (plan.spawnNew) {
        const starterId = addNode(starterType, plan.position, {
          starterMode: "upload",
          uploadedScriptMd: md,
          systemPrompt: llmSeed.systemPrompt,
          systemPromptTemplateId: seedData.systemPromptTemplateId ?? "director-from-script",
          providerId: llmSeed.providerId,
          modelKey: llmSeed.modelKey,
          params: llmSeed.params,
          pipelineStage: "idle",
        });
        if (!starterId) {
          await dialogs.alert({
            title: "导入失败",
            message: "未能新建故事启动节点，请稍后重试或刷新画布。",
            variant: "error",
          });
          return;
        }
        const afterStarter = useCanvasStore.getState();
        const spawnArgs = {
          starterNodeId: starterId,
          systemPrompt: llmSeed.systemPrompt,
          providerId: llmSeed.providerId,
          modelKey: llmSeed.modelKey,
          params: llmSeed.params,
          nodes: afterStarter.nodes,
          edges: afterStarter.edges,
          addNode: (type: CanvasContentNodeType, position: { x: number; y: number }, data?: Record<string, unknown>) =>
            addNode(type, position, data),
          setEdges,
          updateNodeData,
        };
        if (isPro2) {
          spawnStoryPro2ScriptHub(spawnArgs);
        } else {
          spawnStoryProScriptHub(spawnArgs);
        }
        const laid = useCanvasStore.getState();
        setNodes(() =>
          isPro2
            ? reflowStoryPro2Workspace(laid.nodes, laid.edges)
            : reflowStoryProWorkspace(laid.nodes, laid.edges),
        );
        return;
      }

      updateNodeData(plan.starterId, {
        uploadedScriptMd: md,
        starterMode: "upload",
      });
    },
    [addNode, dialogs, setEdges, setNodes, updateNodeData],
  );

  const [project, setProject] = useState<CanvasProjectDetail | null>(null);

  const isSbv1Project = project?.edition === "sbv1";
  const isStoryPro2Project = project?.edition === "pro2";
  const layoutShell = resolveCanvasLayoutShell({
    projectEdition: project?.edition,
    nodes,
  });
  const isStoryPro2Canvas = layoutShell === "pro2";
  const isSbv1Canvas = layoutShell === "sbv1";
  const isStoryProCanvas =
    hasStoryProPipeline(nodes) && !isStoryPro2Canvas && !isSbv1Canvas;
  const showImmersiveChrome = isSbv1Canvas || isStoryPro2Canvas;
  const canvasEditorRef = useRef<HTMLDivElement>(null);
  const { immersive, topChromeVisible, toggleImmersive, exitImmersive } =
    useCanvasImmersiveMode(canvasEditorRef);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [myCharactersOpen, setMyCharactersOpen] = useState(false);
  const [mySavedScriptsOpen, setMySavedScriptsOpen] = useState(false);
  const [myVideoLibraryOpen, setMyVideoLibraryOpen] = useState(false);
  const [videoLibraryRefreshKey, setVideoLibraryRefreshKey] = useState(0);
  const [myProjectCharacterAssetsOpen, setMyProjectCharacterAssetsOpen] =
    useState(false);
  const { insertAtViewportCenter: insertProjectAssetAtViewportCenter } =
    useRegisterProjectAssetCanvasInsert();
  const [styleLibraryOpen, setStyleLibraryOpen] = useState(false);
  const [myHistoryOpen, setMyHistoryOpen] = useState(false);
  const [myGenerationRecordsOpen, setMyGenerationRecordsOpen] = useState(false);
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => handleCanvasWheel(e);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () =>
      document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  useEffect(() => {
    const guard = () => {
      window.history.pushState({ canvasSwipeGuard: true }, "", window.location.href);
    };
    guard();
    const onPopState = () => guard();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [projectId]);

  useEffect(() => {
    const open = () => setStyleLibraryOpen(true);
    window.addEventListener("canvas:open-style-library", open);
    return () => window.removeEventListener("canvas:open-style-library", open);
  }, []);

  useEffect(() => {
    const open = () => setMyHistoryOpen(true);
    window.addEventListener("canvas:open-my-history", open);
    return () => window.removeEventListener("canvas:open-my-history", open);
  }, []);

  /** 加载完成时的节点数；用于阻止误把「有内容的画布」自动保存成空。 */
  const loadedNodeCountRef = useRef(0);
  const canvasReadyRef = useRef(false);
  const generationRecordDeepLinkRef = useRef<string | null>(null);
  /** 上次成功写入服务端的 graphRevision + viewport，用于判断是否需要自动保存 */
  const lastPersistedSnapshotRef = useRef<{
    revision: number;
    viewport: string;
  } | null>(null);
  const syncLastPersistedSnapshotRef = useRef<(() => void) | null>(null);
  const isCanvasDirtyRef = useRef<(() => boolean) | null>(null);

  const inflightTaskCount = useCanvasInflightTaskCount();

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscrollX = document.documentElement.style.overscrollBehaviorX;
    const prevBodyOverscrollX = document.body.style.overscrollBehaviorX;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehaviorX = prevHtmlOverscrollX;
      document.body.style.overscrollBehaviorX = prevBodyOverscrollX;
    };
  }, []);

  useEffect(() => {
    registerCanvasNotifier(({ title, message, variant }) => {
      void dialogs.alert({
        title,
        message,
        variant: variant === "error" ? "error" : "info",
      });
    });
    return () => registerCanvasNotifier(null);
  }, [dialogs]);

  useEffect(() => {
    const onChanged = () => setVideoLibraryRefreshKey((k) => k + 1);
    window.addEventListener("canvas:video-library-changed", onChanged);
    return () =>
      window.removeEventListener("canvas:video-library-changed", onChanged);
  }, []);

  // Load project
  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    canvasReadyRef.current = false;
    generationRecordDeepLinkRef.current = null;
    setProject(null);
    setLoading(true);
    clearCanvasProjectTasksForbidden(projectId);
    void (async () => {
      try {
        const p = await getCanvasProject(base, projectId);
        if (cancelled) return;
        const rawCanvas = p.canvas as { nodes?: unknown[] } | null;
        loadedNodeCountRef.current = Array.isArray(rawCanvas?.nodes)
          ? rawCanvas.nodes.length
          : 0;
        useCanvasStore.temporal.getState().pause();
        hydrate(projectId, p.canvas as never);
        useCanvasStore.temporal.getState().clear();
        useCanvasStore.temporal.getState().resume();
        setProject(p);
        setNameDraft(p.name);
        canvasReadyRef.current = true;
        const syncLoadedPersistedSnapshot = () => {
          const s = useCanvasStore.getState();
          lastPersistedSnapshotRef.current = {
            revision: s.graphRevision,
            viewport: JSON.stringify(s.viewport),
          };
        };
        syncLoadedPersistedSnapshot();
        // hydrate 可能 queueMicrotask 二次 finalize，延迟对齐 revision 避免误判已保存
        queueMicrotask(syncLoadedPersistedSnapshot);
        requestAnimationFrame(syncLoadedPersistedSnapshot);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, projectId, hydrate]);

  // Autosave on changes (debounced) — store 订阅，避免 nodes 变化触发整页重渲染
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveIntervalRef = useRef<number | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosavePendingRef = useRef(false);
  const autosaveProjectRef = useRef(project);
  const autosaveBaseRef = useRef(base);
  const runAutosaveRef = useRef<(force?: boolean) => Promise<void>>(
    async () => {},
  );
  autosaveProjectRef.current = project;
  autosaveBaseRef.current = base;

  useEffect(() => {
    if (!project || !base || loading) return;

    const syncLastPersistedSnapshot = () => {
      const s = useCanvasStore.getState();
      lastPersistedSnapshotRef.current = {
        revision: s.graphRevision,
        viewport: JSON.stringify(s.viewport),
      };
    };
    syncLastPersistedSnapshotRef.current = syncLastPersistedSnapshot;

    const isCanvasDirty = () => {
      const persisted = lastPersistedSnapshotRef.current;
      if (!persisted) return true;
      const s = useCanvasStore.getState();
      return (
        s.graphRevision !== persisted.revision ||
        JSON.stringify(s.viewport) !== persisted.viewport
      );
    };
    isCanvasDirtyRef.current = isCanvasDirty;

    const clearAutosaveTimer = () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };

    const runAutosave = async (
      force = false,
      opts: { writeHistory?: boolean } = {},
    ) => {
      let writeHistory = opts.writeHistory ?? false;
      const autosaveIntervalMs = getCanvasAutosaveIntervalMs();
      // debounce / flush 落盘：间隔未关闭时同步写「自动保存」历史
      if (!writeHistory && autosaveIntervalMs > 0) {
        writeHistory = true;
      }
      if (autosaveInFlightRef.current) {
        autosavePendingRef.current = true;
        return;
      }
      const proj = autosaveProjectRef.current;
      const bookBase = autosaveBaseRef.current;
      if (!proj || !bookBase || !canvasReadyRef.current) return;
      if (!force && !isCanvasDirty()) return;

      autosaveInFlightRef.current = true;
      setSaving(true);
      try {
        window.dispatchEvent(new CustomEvent("canvas:flush-text-drafts"));
        await new Promise<void>((resolve) => {
          queueMicrotask(() => resolve());
        });
        const graph = stripStoryProUploadedScriptMdForPersist(
          useCanvasStore.getState().toGraph(),
        );
        if (
          graph.nodes.length === 0 &&
          loadedNodeCountRef.current > 0
        ) {
          setSaveError("检测到画布被清空，已阻止自动保存。");
          return;
        }
        const thumb = pickProjectThumbnailUrl(graph);
        const patch: {
          canvas: typeof graph;
          thumbnailUrl?: string;
          historySnapshot?: { source: "autosave" };
        } = { canvas: graph };
        if (writeHistory) {
          patch.historySnapshot = { source: "autosave" };
        }
        if (thumb && thumb !== proj.thumbnailUrl) {
          patch.thumbnailUrl = thumb;
        }
        const { historyItem } = await patchCanvasProject(
          bookBase,
          projectId,
          patch,
        );
        syncLastPersistedSnapshot();
        if (historyItem) {
          window.dispatchEvent(new CustomEvent("canvas:history-updated"));
        }
        loadedNodeCountRef.current = graph.nodes.length;
        if (patch.thumbnailUrl) {
          setProject((p) =>
            p ? { ...p, thumbnailUrl: patch.thumbnailUrl! } : p,
          );
        }
        setLastSavedAt(new Date());
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "保存失败");
      } finally {
        autosaveInFlightRef.current = false;
        setSaving(false);
        if (autosavePendingRef.current) {
          autosavePendingRef.current = false;
          void runAutosave(force, opts);
        }
      }
    };

    const scheduleAutosave = () => {
      if (!canvasReadyRef.current) return;
      if (!isCanvasDirty()) return;
      const state = useCanvasStore.getState();
      if (
        state.nodes.length === 0 &&
        loadedNodeCountRef.current > 0 &&
        state.edges.length === 0
      ) {
        setSaveError("检测到画布被清空，已阻止自动保存。请刷新或点「恢复漫剧模板」。");
        return;
      }
      clearAutosaveTimer();
      autosaveTimerRef.current = window.setTimeout(() => {
        autosaveTimerRef.current = null;
        void runAutosave(false);
      }, CANVAS_AUTOSAVE_DEBOUNCE_MS);
    };

    const restartAutosaveInterval = () => {
      if (autosaveIntervalRef.current !== null) {
        window.clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
      const intervalMs = getCanvasAutosaveIntervalMs();
      if (intervalMs === 0) return;
      autosaveIntervalRef.current = window.setInterval(() => {
        if (!canvasReadyRef.current) return;
        if (!isCanvasDirty()) return;
        // 按用户设置的间隔（如 5 分钟）写入一条历史版本
        void runAutosave(false, { writeHistory: true });
      }, intervalMs);
    };

    const unsub = useCanvasStore.subscribe((state, prev) => {
      // 仅 graphRevision 变更视为「内容脏」；viewport 平移不重置 debounce 计时
      if (state.graphRevision === prev.graphRevision) {
        return;
      }
      scheduleAutosave();
    });

    runAutosaveRef.current = runAutosave;

    const flushAutosaveNow = () => {
      clearAutosaveTimer();
      void runAutosave(true, { writeHistory: getCanvasAutosaveIntervalMs() > 0 });
    };

    const onFlushAutosave = () => flushAutosaveNow();
    const onIntervalChanged = () => {
      restartAutosaveInterval();
      scheduleAutosave();
    };

    restartAutosaveInterval();
    window.addEventListener("canvas:flush-autosave", onFlushAutosave);
    window.addEventListener("pagehide", onFlushAutosave);
    window.addEventListener("canvas:autosave-interval-changed", onIntervalChanged);

    return () => {
      unsub();
      syncLastPersistedSnapshotRef.current = null;
      isCanvasDirtyRef.current = null;
      window.removeEventListener("canvas:flush-autosave", onFlushAutosave);
      window.removeEventListener("pagehide", onFlushAutosave);
      window.removeEventListener(
        "canvas:autosave-interval-changed",
        onIntervalChanged,
      );
      clearAutosaveTimer();
      if (autosaveIntervalRef.current !== null) {
        window.clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
    };
  }, [project, base, projectId, loading]);

  const undo = useCallback(() => {
    const tStore = useCanvasStore.temporal.getState();
    tStore.undo();
  }, []);

  const redo = useCallback(() => {
    const tStore = useCanvasStore.temporal.getState();
    tStore.redo();
  }, []);

  const manualSave = useCallback(async () => {
    if (!base || !project) return;

    try {
      const { meta } = await listCanvasProjectHistory(base, projectId, {
        source: "manual",
      });
      if (
        meta.manualCount >= meta.maxPerSource &&
        meta.oldestManual
      ) {
        const ok = await dialogs.confirm({
          title: "手动保存已满",
          message: `手动保存最多 ${meta.maxPerSource} 条。继续将覆盖最旧的一条「${meta.oldestManual.label}」（${new Date(meta.oldestManual.createdAt).toLocaleString("zh-CN")}）。也可在「我的历史 → 手动保存」中删除旧版本腾出空间。`,
          confirmLabel: "覆盖最旧并保存",
          danger: true,
        });
        if (!ok) return;
      }
    } catch {
      /* 元数据失败不阻断保存 */
    }

    setSaving(true);
    try {
      const graph = stripStoryProUploadedScriptMdForPersist(toGraph());
      const thumb = pickProjectThumbnailUrl(graph);
      const patch: {
        canvas: typeof graph;
        thumbnailUrl?: string;
        historySnapshot: { source: "manual"; label: string };
      } = {
        canvas: graph,
        historySnapshot: { source: "manual", label: "手动保存" },
      };
      if (thumb && thumb !== project.thumbnailUrl) {
        patch.thumbnailUrl = thumb;
      }
      const { historyItem } = await patchCanvasProject(base, projectId, patch);
      loadedNodeCountRef.current = graph.nodes.length;
      if (patch.thumbnailUrl) {
        setProject((p) =>
          p ? { ...p, thumbnailUrl: patch.thumbnailUrl! } : p,
        );
      }
      setLastSavedAt(new Date());
      syncLastPersistedSnapshotRef.current?.();
      if (historyItem) {
        window.dispatchEvent(new CustomEvent("canvas:history-updated"));
        setSaveError(null);
      } else {
        setSaveError("项目已保存，但写入「我的历史」失败，请稍后重试。");
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [base, project, projectId, toGraph, dialogs]);

  const restoreFromHistory = useCallback(
    async (canvas: unknown) => {
      useCanvasStore.temporal.getState().pause();
      hydrate(projectId, canvas as never);
      useCanvasStore.temporal.getState().clear();
      useCanvasStore.temporal.getState().resume();
      await new Promise<void>((resolve) => {
        queueMicrotask(() => resolve());
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      syncLastPersistedSnapshotRef.current?.();
      setLastSavedAt(new Date());
      setSaveError(null);
      await exitImmersive();
    },
    [exitImmersive, hydrate, projectId],
  );

  // 生成记录 · 恢复画布 / 定位节点（?restoreHistory=&focusNode=）
  useEffect(() => {
    if (!base || loading || !project) return;
    const sp = new URLSearchParams(window.location.search);
    const restoreHistory = sp.get("restoreHistory")?.trim();
    const focusNode = sp.get("focusNode")?.trim();
    if (!restoreHistory && !focusNode) return;

    const key = `${restoreHistory ?? ""}:${focusNode ?? ""}`;
    if (generationRecordDeepLinkRef.current === key) return;
    generationRecordDeepLinkRef.current = key;

    void (async () => {
      if (restoreHistory) {
        try {
          const detail = await getCanvasProjectHistoryEntry(
            base,
            projectId,
            restoreHistory,
          );
          await restoreFromHistory(detail.canvas);
        } catch (e) {
          await dialogs.alert({
            title: "无法恢复画布",
            message: e instanceof Error ? e.message : String(e),
            variant: "error",
          });
        }
      }
      if (focusNode) {
        focusCanvasNode(focusNode);
      }
      window.history.replaceState(null, "", `/canvas/${projectId}`);
    })();
  }, [base, dialogs, focusCanvasNode, loading, project, projectId, restoreFromHistory]);

  const commitProjectName = useCallback(async () => {
    if (!base || !project) return;
    const next = nameDraft.trim() || defaultCanvasProjectName();
    if (next === project.name) {
      setNameDraft(project.name);
      return;
    }
    try {
      await patchCanvasProject(base, projectId, { name: next });
      setProject((p) => (p ? { ...p, name: next } : p));
      setNameDraft(next);
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "名称保存失败");
      setNameDraft(project.name);
    }
  }, [base, nameDraft, project, projectId]);

  const onAddViaPalette = useCallback(
    (type: CanvasContentNodeType, presetId?: string) => {
      const blocked = canAddStoryNodeType(
        type,
        useCanvasStore.getState().nodes,
      );
      if (!blocked.ok) {
        void dialogs.alert({
          title: "无法添加该节点",
          message: blocked.message,
          variant: "warning",
        });
        return;
      }
      const initialData =
        type === "text" && presetId
          ? buildTextNodeDataFromPreset(presetId)
          : type === "image-engine" && presetId
            ? buildImageEngineDataFromPreset(presetId)
            : undefined;
      const position = flowPositionAtViewportCenter(type, initialData);
      addNode(type, position, initialData);
    },
    [addNode, dialogs],
  );

  const onInsertCharacter = useCallback(
    (character: CanvasCharacterRecord) => {
      const data = {
        ossUrl: character.imageUrl,
        label: character.name,
      };
      const position = flowPositionAtViewportCenter("image", data);
      addNode("image", position, data);
    },
    [addNode],
  );

  const onSaveTemplate = useCallback(async () => {
    if (!base) return;
    const tplName = await dialogs.prompt({
      title: "保存为我的模板",
      message: "模板仅你可见，可在「新建画布」时复用。",
      label: "模板名",
      defaultValue: `${project?.name ?? "未命名"} 模板`,
      placeholder: "请输入模板名",
      confirmLabel: "保存",
      validate: (v) => (v.trim() ? null : "模板名不能为空"),
    });
    if (!tplName) return;
    try {
      const cleaned = stripRuntimeForTemplate(toGraph());
      await saveCanvasTemplate(base, {
        name: tplName.trim(),
        canvas: cleaned,
        category: "user",
      });
      setSaveError(null);
      setTemplatesRefreshKey((k) => k + 1);
      await dialogs.alert({
        title: "已保存",
        message: "模板已保存，可在工具栏「我的模板」中查看。",
        variant: "success",
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存模板失败");
    }
  }, [base, project?.name, toGraph, dialogs]);

  const restoreStoryComicTemplate = useCallback(async () => {
    const tpl = getBuiltinCanvasTemplate(STORY_COMIC_TEMPLATE_ID);
    if (!tpl) return;
    const ok = await dialogs.confirm({
      title: "载入漫剧全链路模板？",
      message: "将用官方向导模板（漫剧启动 + 导出）覆盖当前画布结构。",
      confirmLabel: "载入",
    });
    if (!ok) return;
    useCanvasStore.temporal.getState().pause();
    hydrate(projectId, tpl);
    useCanvasStore.temporal.getState().clear();
    useCanvasStore.temporal.getState().resume();
    loadedNodeCountRef.current = tpl.nodes.length;
    setSaveError(null);
    reflowStoryComicLayout();
    await manualSave();
  }, [dialogs, hydrate, manualSave, projectId, reflowStoryComicLayout]);

  const restoreSbv1Template = useCallback(async () => {
    const tpl = getBuiltinCanvasTemplate(SBV1_BUILTIN_TEMPLATE_ID);
    if (!tpl) return;
    const ok = await dialogs.confirm({
      title: "载入分镜视频 1.0 模板？",
      message: `将恢复默认${SBV1_VIDEO_COMPOSE_LABEL}节点，当前空白画布会被覆盖。`,
      confirmLabel: "载入",
    });
    if (!ok) return;
    useCanvasStore.temporal.getState().pause();
    hydrate(projectId, tpl);
    useCanvasStore.temporal.getState().clear();
    useCanvasStore.temporal.getState().resume();
    loadedNodeCountRef.current = tpl.nodes.length;
    setSaveError(null);
    await manualSave();
  }, [dialogs, hydrate, manualSave, projectId]);

  const runAll = useCallback(() => {
    if (gatewayLinkBlocked) return;
    const workspaceJobs = collectStoryWorkspaceRunJobs(nodes, edges);
    if (workspaceJobs.length) {
      busEnqueueStoryRunsSequential(workspaceJobs);
      return;
    }

    let order: string[];
    try {
      order = topoSort(nodes, edges);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "拓扑失败");
      return;
    }
    const runnableIds = order.filter((id) => {
      const n = nodes.find((x) => x.id === id);
      if (!n || !isRunnableNodeType(n.type as CanvasNodeType)) return false;
      if (n.type === "three-view-engine") {
        const starter = nodes.find((x) => x.type === "story-comic-starter");
        const stage = (starter?.data as { pipelineStage?: string })
          ?.pipelineStage;
        if (stage === "idle" || stage === "llm_done") return false;
      }
      if (n.type === "image-engine" && (n.data as { frameIndex?: number }).frameIndex != null) {
        const starter = nodes.find((x) => x.type === "story-comic-starter");
        const stage = (starter?.data as { pipelineStage?: string })
          ?.pipelineStage;
        if (stage === "idle" || stage === "llm_done" || stage === "tv_done") {
          return false;
        }
      }
      if (n.type === "video-engine" || n.type === "tts-engine") {
        const starter = nodes.find((x) => x.type === "story-comic-starter");
        const stage = (starter?.data as { pipelineStage?: string })
          ?.pipelineStage;
        if (stage !== "frames_done" && stage !== "media_done") return false;
      }
      return true;
    });
    if (!runnableIds.length) return;
    busEnqueueNodesSequential(runnableIds);
  }, [nodes, edges, gatewayLinkBlocked]);

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="fixed inset-0 z-[200] flex h-[100dvh] items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载画布…
      </div>
    );
  } else if (loadError || !project) {
    body = (
      <div className="fixed inset-0 z-[200] flex h-[100dvh] flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] text-sm text-red-200">
        <p>无法加载画布：{loadError ?? "未知错误"}</p>
        <a href="/projects" className="underline">
          返回我的画布
        </a>
      </div>
    );
  } else {
    body = (
      <div
        ref={canvasEditorRef}
        className="fixed inset-0 z-[200] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--canvas-bg)]"
        data-canvas-editor
      >
        <div
          className={cn(
            "z-[300] shrink-0 bg-[var(--canvas-bg)] shadow-[0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-300 ease-out",
            showImmersiveChrome && immersive
              ? cn(
                  "fixed left-0 right-0 top-0",
                  !topChromeVisible && "-translate-y-full",
                )
              : "sticky top-0",
          )}
        >
          <CanvasToolbar
            projectName={nameDraft}
            onProjectNameChange={setNameDraft}
            onProjectNameCommit={() => void commitProjectName()}
            saving={saving}
            saveError={saveError}
            lastSavedAt={lastSavedAt}
            onSave={() => void manualSave()}
            onUndo={undo}
            onRedo={redo}
            onRunAll={runAll}
            onOpenMyTemplates={() => setMyTemplatesOpen(true)}
            onOpenMyHistory={() => setMyHistoryOpen(true)}
            onOpenGenerationRecords={() => setMyGenerationRecordsOpen(true)}
            onOpenMyCharacters={() => setMyCharactersOpen(true)}
            onOpenMyVideoLibrary={() => setMyVideoLibraryOpen(true)}
            onOpenMySavedScripts={
              isStoryProCanvas ? () => setMySavedScriptsOpen(true) : undefined
            }
            onOpenProjectCharacterAssets={() => setMyProjectCharacterAssetsOpen(true)}
            onOpenStyleLibrary={
              isStoryProCanvas ? () => setStyleLibraryOpen(true) : undefined
            }
            onReflowStoryLayout={
              isStoryComicCanvas ? () => reflowStoryComicLayout() : undefined
            }
            onSaveTemplate={() => void onSaveTemplate()}
            running={inflightTaskCount > 0}
            inflightTaskCount={inflightTaskCount}
            runAllDisabled={gatewayLinkBlocked}
            immersive={showImmersiveChrome ? immersive : false}
            onToggleImmersive={
              showImmersiveChrome ? () => void toggleImmersive() : undefined
            }
          />
          <GatewayLinkBanner />
        </div>
      <MyCanvasHistoryPanel
        open={myHistoryOpen}
        onClose={() => setMyHistoryOpen(false)}
        projectId={projectId}
        onRestore={restoreFromHistory}
      />
      <MyCanvasGenerationRecordsPanel
        open={myGenerationRecordsOpen}
        onClose={() => setMyGenerationRecordsOpen(false)}
        projectId={projectId}
        onRestoreCanvas={restoreFromHistory}
      />
      <MyTemplatesPanel
        open={myTemplatesOpen}
        onClose={() => setMyTemplatesOpen(false)}
        refreshKey={templatesRefreshKey}
      />
      <MyCharactersPanel
        open={myCharactersOpen}
        onClose={() => setMyCharactersOpen(false)}
        onInsertCharacter={onInsertCharacter}
      />
      <MySavedScriptsPanel
        open={mySavedScriptsOpen}
        onClose={() => setMySavedScriptsOpen(false)}
      />
      <MyVideoLibraryPanel
        open={myVideoLibraryOpen}
        onClose={() => setMyVideoLibraryOpen(false)}
        refreshKey={videoLibraryRefreshKey}
      />
      <MyProjectCharacterAssetsPanel
        open={myProjectCharacterAssetsOpen}
        onClose={() => setMyProjectCharacterAssetsOpen(false)}
        onInsertToCanvas={(assetId) => {
          void insertProjectAssetAtViewportCenter(assetId);
        }}
      />
      {isStoryProCanvas || isStoryPro2Canvas ? (
        <StyleLibraryModal
          open={styleLibraryOpen}
          onClose={() => setStyleLibraryOpen(false)}
        />
      ) : null}
      <div className="relative z-0 flex min-h-0 flex-1 overflow-hidden isolate">
        {isStoryProCanvas && project ? (
          <ScriptWritingAssistantPanel
            projectId={projectId}
            onImportScript={onImportScriptFromAssistant}
            theme="pro"
          />
        ) : null}
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {isSbv1Canvas ? (
          <Sbv1CanvasLayout projectId={projectId} onUndo={undo} onRedo={redo} />
        ) : isStoryPro2Canvas ? (
          <Pro2CanvasLayout projectId={projectId} onUndo={undo} onRedo={redo} />
        ) : (
          <>
            <FlowCanvas projectId={projectId} onUndo={undo} onRedo={redo} />
            <CanvasCreditsToastHost />
            <div className="pointer-events-none absolute inset-x-0 top-2 z-[60] flex justify-center px-2">
              <NodePalette onAdd={onAddViaPalette} />
            </div>
          </>
        )}
        {isStoryComicCanvas && nodes.length > 0 ? (
          <button
            type="button"
            className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-[var(--canvas-surface)]/95 px-4 py-2 text-xs font-medium text-emerald-100 shadow-lg hover:border-emerald-400/60 hover:bg-emerald-500/15"
            title="按漫剧工作流重新排列所有节点"
            onClick={() => reflowStoryComicLayout()}
          >
            <LayoutTemplate className="size-3.5" />
            重排
          </button>
        ) : null}
        {nodes.length === 0 && !loading && isSbv1Project ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-sm rounded-xl border border-white/10 bg-[var(--canvas-surface)]/95 px-5 py-4 text-center shadow-xl">
              <p className="text-sm font-medium text-white">空白画布</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--canvas-muted)]">
                使用底部 Dock 添加图片、{SBV1_VIDEO_COMPOSE_LABEL}，或粘贴图片到画布。
              </p>
              <button
                type="button"
                className="mt-4 rounded-md border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20"
                onClick={() => void restoreSbv1Template()}
              >
                恢复「分镜视频 1.0」模板
              </button>
            </div>
          </div>
        ) : null}
        {nodes.length === 0 &&
        !loading &&
        loadedNodeCountRef.current > 0 &&
        !isSbv1Project &&
        !isStoryPro2Project ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-md rounded-xl border border-white/10 bg-[var(--canvas-surface)]/95 px-6 py-5 text-center shadow-xl">
              <p className="text-sm font-medium text-white">节点数据丢失</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--canvas-muted)]">
                云端记录里这个画布已被保存为空。若还有其他副本，请到
                <Link href="/projects" className="mx-1 underline">
                  我的画布
                </Link>
                打开；否则可重新载入模板。
              </p>
              <button
                type="button"
                className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                onClick={() => void restoreStoryComicTemplate()}
              >
                恢复「漫剧全链路」模板
              </button>
            </div>
          </div>
        ) : null}
        {nodes.length === 0 &&
        !loading &&
        loadedNodeCountRef.current === 0 &&
        !isSbv1Project ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-sm rounded-xl border border-white/10 bg-black/50 px-5 py-4 text-center">
              <p className="text-xs text-[var(--canvas-muted)]">
                空白画布 · 从上方工具栏拖入节点
              </p>
              <button
                type="button"
                className="mt-3 rounded-md border border-emerald-400/30 px-3 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/10"
                onClick={() => void restoreStoryComicTemplate()}
              >
                载入「漫剧全链路」模板
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
    );
  }

  return (
    <>
      {project && !loadError ? (
        <CanvasRunnerHost
          projectId={projectId}
          gatewayLinkBlocked={gatewayLinkBlocked}
          gatewayLinkAccountUrl={gatewayAccountUrl}
        />
      ) : null}
      {body}
    </>
  );
}

export function CanvasPageClient({ projectId }: { projectId: string }) {
  return (
    <RequireAuth>
      <SaveProjectAssetDialogHost />
      <PortraitImportProgressHost />
      <Inner projectId={projectId} />
    </RequireAuth>
  );
}
