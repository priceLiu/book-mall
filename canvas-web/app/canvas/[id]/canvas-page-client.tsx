"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  CanvasToolsSessionProvider,
} from "@/components/auth/canvas-tools-session-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { handleCanvasWheel } from "@/lib/canvas/canvas-form-wheel";
import { installCanvasEditorPageNavGuards } from "@/lib/canvas/canvas-block-browser-nav";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import { registerCanvasNotifier } from "@/lib/canvas/canvas-notify";
import {
  canvasGraphRedo,
  canvasGraphUndo,
} from "@/lib/canvas/canvas-graph-undo-redo";
import {
  CanvasCreditsToastHost,
  showCanvasSuccessToast,
} from "@/components/canvas/canvas-credits-toast-host";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { Pro2CanvasLayout } from "@/components/canvas/pro2/pro2-canvas-layout";
import { Pro2ProductionGateToolbarLink } from "@/components/canvas/pro2/pro2-production-gate-banner";
import { Sbv1CanvasLayout } from "@/components/canvas/sbv1/sbv1-canvas-layout";
import { ScriptWritingAssistantPanel } from "@/components/canvas/script-writing-assistant-panel";
import { MyTemplatesPanel } from "@/components/canvas/my-templates-panel";
import { MyCharactersPanel } from "@/components/canvas/my-characters-panel";
import { MySavedScriptsPanel } from "@/components/canvas/my-saved-scripts-panel";
import { MyVideoLibraryPanel } from "@/components/canvas/my-video-library-panel";
import { MyProjectCharacterAssetsPanel } from "@/components/canvas/my-project-character-assets-panel";
import { useCanvasTaskEventStream } from "@/lib/canvas/use-canvas-task-event-stream";
import { useCrewCollaborationAccess } from "@/lib/canvas/use-crew-collaboration-access";
import { useCanvasTaskSse } from "@/lib/canvas/use-canvas-task-sse";
import { hasAnyMediaRenderInFlight } from "@/lib/canvas/media-render-in-flight";
import { StyleLibraryModal } from "@/components/canvas/style-library-modal";
import { NodePalette } from "@/components/canvas/node-palette";
import { CanvasToolbar } from "@/components/canvas/toolbar";
import { useCanvasStore } from "@/lib/canvas/store";
import { useCanvasGraphSnapshot } from "@/lib/canvas/canvas-store-hooks";
import {
  CanvasRunnerHost,
  useCanvasInflightTaskCount,
} from "@/lib/canvas/run-queue";
import { stripRuntimeForTemplate, stripGraphForPersist } from "@/lib/canvas/sanitize";
import {
  buildCanvasPersistGraph,
  isCanvasPersistContentDirty,
  readCanvasPersistSnapshot,
  serializeCanvasPersistGraph,
  type CanvasPersistSnapshot,
} from "@/lib/canvas/canvas-persist-snapshot";
import {
  buildCanvasPersistDelta,
  parsePersistedCanvasGraph,
  shouldUseFullCanvasPersist,
} from "@/lib/canvas/canvas-persist-delta";
import { stripStoryProUploadedScriptMdForPersist } from "@/lib/canvas/story-pro-upload-script";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
import { buildImageEngineDataFromPreset } from "@/lib/canvas/image-engine-presets";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import type {
  CanvasContentNodeType,
  CanvasGraph,
} from "@/lib/canvas/types";
import {
  clearCanvasProjectTasksForbidden,
  getCanvasProjectCached,
  abandonCanvasProjectInflight,
  seedCanvasProjectDetailCache,
  isCanvasApiConflictError,
  parseCanvasConflictUpdatedAt,
  formatCanvasApiError,
  getCanvasProjectUpdatedAt,
  listCanvasProjectHistory,
  patchCanvasProject,
  saveCanvasTemplate,
  submitCanvasPortalReview,
  type CanvasCharacterRecord,
  type CanvasProjectDetail,
} from "@/lib/canvas-api";
import { refreshCanvasToolsSessionClient, isCanvasToolsSessionUnauthorized } from "@/lib/canvas-tools-session-client";
import { isTransientNetworkFetchError, isTransientDbApiError } from "@/lib/fetch-with-db-retry";
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
import { pickPersistableProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";
import { markRecentProjectsStale } from "@/lib/canvas/recent-projects-invalidate";
import {
  captureCanvasViewportSnapshotUrl,
  resolveCanvasHistoryThumbnailUrl,
} from "@/lib/canvas/canvas-viewport-snapshot";
import { cn } from "@/lib/utils";
import { useCanvasImmersiveMode } from "@/lib/canvas/use-canvas-immersive-mode";
import { getBuiltinCanvasTemplate } from "@/lib/canvas/templates";
import { SBV1_BUILTIN_TEMPLATE_ID } from "@/lib/canvas/project-edition";
import { SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";
import { MyCanvasHistoryPanel } from "@/components/canvas/my-canvas-history-panel";
import { MyCanvasGenerationRecordsPanel } from "@/components/canvas/my-canvas-generation-records-panel";
import { MyPromptHistoryPanel } from "@/components/canvas/my-prompt-history-panel";
import { PortalSubmitDialog } from "@/components/home/portal-submit-dialog";
import { WorkflowShareLinkDialog } from "@/components/canvas/workflow-share-link-dialog";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import { SaveProjectAssetDialogHost } from "@/components/canvas/save-project-asset-dialog";
import { PortraitImportProgressHost } from "@/components/canvas/portrait-import-progress-dialog";
import { useRegisterProjectAssetCanvasInsert } from "@/lib/canvas/use-register-project-asset-canvas-insert";
import {
  CANVAS_AUTOSAVE_DEBOUNCE_MS,
  CANVAS_AUTOSAVE_HISTORY_HEARTBEAT_MS,
  getCanvasAutosaveIntervalMs,
} from "@/lib/canvas/canvas-autosave-settings";
import { registerCanvasGraphPersistFlush, registerCanvasGraphDirtyCheck, registerCanvasDeltaPersist, registerCanvasProjectVersionSync, setCanvasSaveInFlight } from "@/lib/canvas/canvas-graph-persist-bridge";
import { flushCanvasNodePositions } from "@/lib/canvas/canvas-commit-node-positions";
import {
  canvasSavePhaseLabel,
  formatCanvasAutosaveUserHint,
  isCanvasAutosaveReconnectError,
  type CanvasSavePhase,
} from "@/lib/canvas/canvas-save-phase";
import {
  hasPendingCanvasImageUploads,
  reconcileStaleCanvasImageUploadFlags,
  waitForPendingCanvasImageUploads,
  flushPendingCanvasImageUploadPersist,
} from "@/lib/canvas/canvas-pending-image-uploads";
import { getCanvasProjectHistoryEntry } from "@/lib/canvas-api";
import { warmPro2TemplateCache } from "@/lib/canvas/pro2-template-resolver";
const STORY_COMIC_TEMPLATE_ID = "builtin/story-comic-pipeline";
/** 单项目 GET 超时：避免 BFF/DB 挂起时「加载画布…」永不结束 */
const CANVAS_PROJECT_LOAD_TIMEOUT_MS = 90_000;

function withCanvasProjectLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("canvas_project_load_timeout"));
    }, CANVAS_PROJECT_LOAD_TIMEOUT_MS);
    void promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function Inner({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const {
    confirmedUnlinked: gatewayLinkBlocked,
    accountUrl: gatewayAccountUrl,
    loading: gatewayLinkLoading,
  } = useGatewayLinkStatus();
  const dialogs = useDialogs();

  useEffect(() => {
    prefetchUserProviders(base);
    void warmPro2TemplateCache(base).catch(() => {});
  }, [base]);

  useEffect(() => {
    const onBlocked = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string }>).detail;
      const message = detail?.message?.trim();
      if (!message) return;
      void dialogs.alert({
        title: "无法生成",
        message,
        variant: "warning",
      });
    };
    window.addEventListener("canvas:generation-blocked", onBlocked);
    return () => window.removeEventListener("canvas:generation-blocked", onBlocked);
  }, [dialogs]);
  const hydrate = useCanvasStore((s) => s.hydrate);
  const toGraph = useCanvasStore((s) => s.toGraph);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const { nodes, edges } = useCanvasGraphSnapshot();
  const graphMeta = useCanvasStore((s) => s.graphMeta);
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
    graphMeta,
  });
  const isStoryPro2Canvas = isStoryPro2Project || layoutShell === "pro2";
  const crewAccess = useCrewCollaborationAccess();
  const isSbv1Canvas =
    !isStoryPro2Canvas && (isSbv1Project || layoutShell === "sbv1");
  const isStoryProCanvas =
    hasStoryProPipeline(nodes) && !isStoryPro2Canvas && !isSbv1Canvas;
  const showImmersiveChrome = isSbv1Canvas || isStoryPro2Canvas;
  const canvasEditorRef = useRef<HTMLDivElement>(null);
  const toolbarShellRef = useRef<HTMLDivElement>(null);
  const { immersive, topChromeVisible, toggleImmersive, exitImmersive } =
    useCanvasImmersiveMode(canvasEditorRef);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inflightTaskCount = useCanvasInflightTaskCount();
  const mediaRenderActive = useCanvasStore((s) =>
    hasAnyMediaRenderInFlight(s.nodes),
  );
  const inflightTaskCountRef = useRef(inflightTaskCount);
  const mediaRenderActiveRef = useRef(mediaRenderActive);
  inflightTaskCountRef.current = inflightTaskCount;
  mediaRenderActiveRef.current = mediaRenderActive;
  const taskSyncEnabled = !loading && !mediaRenderActive;
  useCanvasTaskEventStream(base, projectId, taskSyncEnabled);
  useCanvasTaskSse(base, projectId, inflightTaskCount, taskSyncEnabled);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<CanvasSavePhase>("idle");
  const [saveRetryAttempt, setSaveRetryAttempt] = useState(0);
  const saveGenerationRef = useRef(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [myCharactersOpen, setMyCharactersOpen] = useState(false);
  const [mySavedScriptsOpen, setMySavedScriptsOpen] = useState(false);
  const [myVideoLibraryOpen, setMyVideoLibraryOpen] = useState(false);
  const [videoLibraryRefreshKey, setVideoLibraryRefreshKey] = useState(0);
  const [myProjectCharacterAssetsOpen, setMyProjectCharacterAssetsOpen] =
    useState(false);
  const [myPromptHistoryOpen, setMyPromptHistoryOpen] = useState(false);
  const { insertAtViewportCenter: insertProjectAssetAtViewportCenter } =
    useRegisterProjectAssetCanvasInsert();
  const [styleLibraryOpen, setStyleLibraryOpen] = useState(false);
  const [myHistoryOpen, setMyHistoryOpen] = useState(false);
  const [myGenerationRecordsOpen, setMyGenerationRecordsOpen] = useState(false);
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [workflowShareOpen, setWorkflowShareOpen] = useState(false);
  const [sharePreparing, setSharePreparing] = useState(false);
  const isCanvasPortalAdmin = useCanvasAdmin();

  const closeAllToolbarPanels = useCallback(() => {
    setMyTemplatesOpen(false);
    setMyCharactersOpen(false);
    setMySavedScriptsOpen(false);
    setMyVideoLibraryOpen(false);
    setMyProjectCharacterAssetsOpen(false);
    setMyPromptHistoryOpen(false);
    setStyleLibraryOpen(false);
    setMyHistoryOpen(false);
    setMyGenerationRecordsOpen(false);
  }, []);

  useEffect(() => {
    const editor = canvasEditorRef.current;
    const toolbar = toolbarShellRef.current;
    if (!editor || !toolbar) return;

    const syncToolbarHeight = () => {
      const chromeHidden =
        showImmersiveChrome && immersive && !topChromeVisible;
      const height = chromeHidden ? 0 : toolbar.offsetHeight;
      editor.style.setProperty("--canvas-toolbar-height", `${height}px`);
    };

    syncToolbarHeight();
    const ro = new ResizeObserver(syncToolbarHeight);
    ro.observe(toolbar);
    return () => ro.disconnect();
  }, [showImmersiveChrome, immersive, topChromeVisible]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => handleCanvasWheel(e);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () =>
      document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  useEffect(() => installCanvasEditorPageNavGuards(), []);

  useEffect(() => {
    const open = () => {
      closeAllToolbarPanels();
      setStyleLibraryOpen(true);
    };
    window.addEventListener("canvas:open-style-library", open);
    return () => window.removeEventListener("canvas:open-style-library", open);
  }, [closeAllToolbarPanels]);

  useEffect(() => {
    const open = () => {
      closeAllToolbarPanels();
      setMyHistoryOpen(true);
    };
    window.addEventListener("canvas:open-my-history", open);
    return () => window.removeEventListener("canvas:open-my-history", open);
  }, [closeAllToolbarPanels]);

  /** 加载完成时的节点数；用于阻止误把「有内容的画布」自动保存成空。 */
  const loadedNodeCountRef = useRef(0);
  const canvasReadyRef = useRef(false);
  const generationRecordDeepLinkRef = useRef<string | null>(null);
  /** 上次成功 PATCH 返回的 project.updatedAt（canvasDelta 乐观锁） */
  const lastBaseUpdatedAtRef = useRef<string | undefined>(undefined);
  /** 上次成功写入服务端的快照（strip 后内容与视口 + revision） */
  const lastPersistedSnapshotRef = useRef<CanvasPersistSnapshot | null>(null);
  /** hydrate / fitView 落定前跳过自动保存，避免打开项目时 revision 连跳导致「一直保存中」 */
  const canvasHydratingUntilRef = useRef(0);
  const syncLastPersistedSnapshotRef = useRef<(() => void) | null>(null);
  const isCanvasDirtyRef = useRef<(() => boolean) | null>(null);
  const autosaveStartedAtRef = useRef(0);
  const savePhaseRef = useRef<CanvasSavePhase>("idle");
  /** 保存硬失败后冷却，避免 dirty 状态下「增量/重试」死循环 */
  const autosaveFailCooldownUntilRef = useRef(0);
  const autosaveReconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscrollX = document.documentElement.style.overscrollBehaviorX;
    const prevBodyOverscrollX = document.body.style.overscrollBehaviorX;
    const prevHtmlOverscrollY = document.documentElement.style.overscrollBehaviorY;
    const prevBodyOverscrollY = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";
    document.documentElement.style.overscrollBehaviorY = "none";
    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.dataset.canvasEditorOpen = "true";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehaviorX = prevHtmlOverscrollX;
      document.body.style.overscrollBehaviorX = prevBodyOverscrollX;
      document.documentElement.style.overscrollBehaviorY = prevHtmlOverscrollY;
      document.body.style.overscrollBehaviorY = prevBodyOverscrollY;
      delete document.documentElement.dataset.canvasEditorOpen;
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
    if (!base?.trim()) {
      canvasReadyRef.current = false;
      setProject(null);
      setLoadError(
        "未配置主站地址（NEXT_PUBLIC_BOOK_MALL_URL），无法加载画布。",
      );
      setLoading(false);
      return;
    }
    let cancelled = false;
    canvasReadyRef.current = false;
    generationRecordDeepLinkRef.current = null;
    setProject(null);
    setLoading(true);
    clearCanvasProjectTasksForbidden(projectId);
    // 只放弃卡住的 inflight，保留列表 hover 已拉到的大 JSON 缓存
    abandonCanvasProjectInflight(base, projectId);
    void (async () => {
      try {
        const p = await withCanvasProjectLoadTimeout(
          getCanvasProjectCached(base, projectId),
        );
        if (cancelled) return;
        seedCanvasProjectDetailCache(base, projectId, p);
        const rawCanvas = p.canvas as { nodes?: unknown[] } | null;
        loadedNodeCountRef.current = Array.isArray(rawCanvas?.nodes)
          ? rawCanvas.nodes.length
          : 0;
        useCanvasStore.temporal.getState().pause();
        hydrate(projectId, p.canvas as never);
        useCanvasStore.temporal.getState().clear();
        useCanvasStore.temporal.getState().resume();
        setProject(p);
        lastBaseUpdatedAtRef.current = p.updatedAt;
        setNameDraft(p.name);
        canvasReadyRef.current = true;
        canvasHydratingUntilRef.current = Date.now() + 2000;
        const syncLoadedPersistedSnapshot = () => {
          lastPersistedSnapshotRef.current = readCanvasPersistSnapshot(
            useCanvasStore.getState(),
          );
          historyWrittenAtRef.current = Date.now();
          historyWrittenRevisionRef.current =
            useCanvasStore.getState().graphRevision;
        };
        syncLoadedPersistedSnapshot();
        reconcileStaleCanvasImageUploadFlags(updateNodeData);
        // hydrate 可能 queueMicrotask 二次 finalize，延迟对齐 revision 避免误判已保存
        queueMicrotask(syncLoadedPersistedSnapshot);
        requestAnimationFrame(syncLoadedPersistedSnapshot);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          const raw = e instanceof Error ? e.message : "加载失败";
          const message =
            raw === "canvas_project_load_timeout"
              ? "加载画布超时（主站响应过慢）。请确认 book-mall 已启动且数据库可访问，然后刷新重试。"
              : formatCanvasApiError(raw);
          setLoadError(message);
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
  const autosaveFlushDebounceRef = useRef<number | null>(null);
  const autosaveImmediateDebounceRef = useRef<number | null>(null);
  const autosaveSavingUiTimerRef = useRef<number | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosavePendingRef = useRef(false);
  const autosaveIdleWaitersRef = useRef<Array<() => void>>([]);

  const resolveAutosaveIdleWaiters = () => {
    const waiters = autosaveIdleWaitersRef.current;
    autosaveIdleWaitersRef.current = [];
    for (const resolve of waiters) resolve();
  };

  const waitForAutosaveIdle = (): Promise<void> => {
    if (!autosaveInFlightRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      autosaveIdleWaitersRef.current.push(resolve);
    });
  };

  const CANVAS_AUTOSAVE_IDLE_WAIT_MS = 12_000;
  /** DB/连接池紧张时 PATCH 可能较慢；超时后 abort fetch，避免连接泄漏与 UI 长期「保存中」 */
  /** 正常 PATCH 约 300–600ms；整图+连接争用时放宽，避免误杀 */
  const CANVAS_AUTOSAVE_PATCH_TIMEOUT_MS = 45_000;
  const CANVAS_AUTOSAVE_FAIL_COOLDOWN_MS = 20_000;
  /** 上次写入「自动保存」历史的时间与当时的 graphRevision（跨 effect 重挂载保持） */
  const historyWrittenAtRef = useRef(Date.now());
  const historyWrittenRevisionRef = useRef<number | null>(null);
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
      lastPersistedSnapshotRef.current = readCanvasPersistSnapshot(
        useCanvasStore.getState(),
      );
    };
    syncLastPersistedSnapshotRef.current = syncLastPersistedSnapshot;

    const isCanvasDirty = () => {
      const persisted = lastPersistedSnapshotRef.current;
      if (!persisted) return true;
      return isCanvasPersistContentDirty(
        readCanvasPersistSnapshot(useCanvasStore.getState()),
        persisted,
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
      opts: {
        writeHistory?: boolean;
        conflictRetry?: boolean;
        authRetry?: boolean;
        networkRetryCount?: number;
        /** 离开页等：冷却期内仍尝试落盘 */
        bypassCooldown?: boolean;
      } = {},
    ) => {
      let writeHistory = opts.writeHistory ?? false;
      const autosaveIntervalMs = getCanvasAutosaveIntervalMs();
      // 仅定时器（用户设置的间隔）写入「自动保存」历史；1.5s debounce 只落盘项目不增历史条
      if (autosaveIntervalMs <= 0) {
        writeHistory = false;
      }
      if (
        writeHistory &&
        (inflightTaskCountRef.current > 0 || mediaRenderActiveRef.current)
      ) {
        writeHistory = false;
      }
      if (useCanvasStore.getState().canvasGeometryDragging) {
        autosavePendingRef.current = true;
        return;
      }
      if (
        !force &&
        (inflightTaskCountRef.current > 0 || mediaRenderActiveRef.current)
      ) {
        autosavePendingRef.current = true;
        return;
      }
      if (autosaveInFlightRef.current) {
        if (force) {
          try {
            await Promise.race([
              waitForAutosaveIdle(),
              new Promise<void>((_, reject) => {
                window.setTimeout(
                  () => reject(new Error("save_wait_timeout")),
                  CANVAS_AUTOSAVE_IDLE_WAIT_MS,
                );
              }),
            ]);
          } catch {
            /* 前一保存仍在飞：排队，禁止双 PATCH（增量上线后双请求会互相踩） */
            autosavePendingRef.current = true;
            return;
          }
          if (autosaveInFlightRef.current) {
            autosavePendingRef.current = true;
            return;
          }
        } else {
          autosavePendingRef.current = true;
          return;
        }
      }
      const proj = autosaveProjectRef.current;
      const bookBase = autosaveBaseRef.current;
      if (!proj || !bookBase || !canvasReadyRef.current) return;
      if (!force && Date.now() < canvasHydratingUntilRef.current) return;
      // 硬失败冷却期内：跳过一切自动/强制落盘（含任务完成后 flush），避免死循环
      if (
        Date.now() < autosaveFailCooldownUntilRef.current &&
        (opts.networkRetryCount ?? 0) === 0 &&
        !opts.conflictRetry &&
        !opts.authRetry &&
        !opts.bypassCooldown
      ) {
        return;
      }
      // 图片 OSS 未完成时不落盘：strip 会去掉 blob，存成空节点
      if (!force && hasPendingCanvasImageUploads()) return;
      if (!force && !isCanvasDirty()) return;
      if (force && !isCanvasDirty() && !hasPendingCanvasImageUploads()) return;

      const snapshot = useCanvasStore.getState();
      const currentSnap = readCanvasPersistSnapshot(snapshot);
      const persisted = lastPersistedSnapshotRef.current;
      const graph = buildCanvasPersistGraph(snapshot.toGraph);
      const thumb = pickPersistableProjectThumbnailUrl(graph);
      const thumbChanged = Boolean(thumb && thumb !== proj.thumbnailUrl);

      // strip 后内容与视口无变化 → 跳过 PATCH（仅 revision / transient 字段变了）
      // force=true（离开画布 / 上传后落盘）时绝不可跳过，否则新粘贴节点可能从未写入 DB
      if (
        !force &&
        !writeHistory &&
        !thumbChanged &&
        persisted &&
        !isCanvasPersistContentDirty(currentSnap, persisted)
      ) {
        lastPersistedSnapshotRef.current = currentSnap;
        return;
      }

      autosaveInFlightRef.current = true;
      setCanvasSaveInFlight(true);
      autosaveStartedAtRef.current = Date.now();
      const saveGen = ++saveGenerationRef.current;
      setSaveError(null);
      setSaveRetryAttempt(0);
      const setPhase = (phase: CanvasSavePhase, retry = 0) => {
        if (saveGen !== saveGenerationRef.current) return;
        savePhaseRef.current = phase;
        setSavePhase(phase);
        setSaveRetryAttempt(retry);
        if (phase !== "idle" && phase !== "done") setSaving(true);
      };
      if ((opts.networkRetryCount ?? 0) > 0) {
        setPhase("retry", (opts.networkRetryCount ?? 0) + 1);
      }
      if (autosaveSavingUiTimerRef.current !== null) {
        window.clearTimeout(autosaveSavingUiTimerRef.current);
        autosaveSavingUiTimerRef.current = null;
      }
      let saveMarkedDone = false;
      try {
        setPhase("commit_layout");
        flushCanvasNodePositions();
        await new Promise<void>((resolve) => {
          queueMicrotask(() => resolve());
        });
        setPhase("flush_drafts");
        window.dispatchEvent(new CustomEvent("canvas:flush-text-drafts"));
        await new Promise<void>((resolve) => {
          queueMicrotask(() => resolve());
        });
        const snapshot = useCanvasStore.getState();
        const revisionAtSnapshot = snapshot.graphRevision;
        const graph = buildCanvasPersistGraph(snapshot.toGraph);
        const thumb = pickPersistableProjectThumbnailUrl(graph);
        const persistedSnap = lastPersistedSnapshotRef.current;
        const lastGraph = persistedSnap
          ? parsePersistedCanvasGraph(persistedSnap.graph)
          : null;

        type AutosavePatch = {
          canvas?: typeof graph;
          canvasDelta?: import("@/lib/canvas/canvas-persist-delta").CanvasDeltaPatch;
          thumbnailUrl?: string;
          historySnapshot?: { source: "autosave"; thumbnailUrl?: string };
        };

        let patch: AutosavePatch;
        if (lastGraph && !shouldUseFullCanvasPersist(graph)) {
          const delta = buildCanvasPersistDelta(lastGraph, graph);
          if (!delta) {
            lastPersistedSnapshotRef.current = readCanvasPersistSnapshot(snapshot);
            return;
          }
          patch = {
            canvasDelta: {
              ...delta,
              baseUpdatedAt: lastBaseUpdatedAtRef.current,
            },
          };
        } else {
          patch = { canvas: graph };
        }

        if (writeHistory) {
          setPhase("history_thumb");
          const shot = await Promise.race([
            captureCanvasViewportSnapshotUrl(bookBase),
            new Promise<string>((resolve) => {
              window.setTimeout(() => resolve(""), 4_000);
            }),
          ]);
          const historyThumb = resolveCanvasHistoryThumbnailUrl(
            shot,
            graph,
            proj.thumbnailUrl,
          );
          patch.historySnapshot = {
            source: "autosave",
            ...(historyThumb ? { thumbnailUrl: historyThumb } : {}),
          };
        }
        if (thumb && thumb !== proj.thumbnailUrl) {
          patch.thumbnailUrl = thumb;
        }
        setPhase(patch.canvasDelta ? "patch_delta" : "patch_full");
        const patchAbort = new AbortController();
        let patchTimer: ReturnType<typeof setTimeout> | undefined;
        const patchResult = await Promise.race([
          patchCanvasProject(bookBase, projectId, patch, {
            signal: patchAbort.signal,
          }),
          new Promise<never>((_, reject) => {
            patchTimer = setTimeout(() => {
              patchAbort.abort();
              reject(new Error("save_timeout"));
            }, CANVAS_AUTOSAVE_PATCH_TIMEOUT_MS);
          }),
        ]).finally(() => {
          if (patchTimer !== undefined) clearTimeout(patchTimer);
        });
        const { historyItem, project: updatedProject } = patchResult;
        lastBaseUpdatedAtRef.current = updatedProject.updatedAt;
        syncLastPersistedSnapshot();
        setProject((p) =>
          p ? { ...p, updatedAt: updatedProject.updatedAt } : p,
        );
        if (writeHistory) {
          // 失败时只推迟一个间隔重试：不更新 revision，下一轮心跳仍认定「有未存档编辑」
          historyWrittenAtRef.current = Date.now();
          if (historyItem) {
            historyWrittenRevisionRef.current = revisionAtSnapshot;
          }
        }
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
        autosaveFailCooldownUntilRef.current = 0;
        if (autosaveReconnectTimerRef.current !== null) {
          window.clearTimeout(autosaveReconnectTimerRef.current);
          autosaveReconnectTimerRef.current = null;
        }
        if (saveGen === saveGenerationRef.current) {
          saveMarkedDone = true;
          setSavePhase("done");
          window.setTimeout(() => {
            if (saveGen === saveGenerationRef.current) {
              setSavePhase("idle");
              setSaving(false);
            }
          }, 1200);
        }
      } catch (e) {
        if (saveGen !== saveGenerationRef.current) return;
        if (isCanvasApiConflictError(e) && !opts.conflictRetry) {
          try {
            setPhase("sync_version");
            const fromErr = parseCanvasConflictUpdatedAt(e);
            const updatedAt =
              fromErr ??
              (await getCanvasProjectUpdatedAt(bookBase, projectId));
            lastBaseUpdatedAtRef.current = updatedAt;
            setProject((p) => (p ? { ...p, updatedAt } : p));
            await runAutosave(true, { ...opts, conflictRetry: true });
            return;
          } catch {
            /* fall through to generic error */
          }
        }
        const errMsg = e instanceof Error ? e.message : "保存失败";
        if (!opts.authRetry && isCanvasToolsSessionUnauthorized(errMsg)) {
          const refreshed = await refreshCanvasToolsSessionClient({ silent: true });
          if (refreshed) {
            await runAutosave(force, { ...opts, authRetry: true });
            return;
          }
        }
        const networkRetryCount = opts.networkRetryCount ?? 0;
        // call() 内已有短暂重试；外层最多再 1 次，避免「重试中」循环刷屏
        const maxNetworkRetries = 1;
        const retryableSaveError =
          isTransientNetworkFetchError(errMsg) ||
          /\b(502|503|429)\b/.test(errMsg) ||
          isTransientDbApiError(
            Number((/\b(\d{3})\b/.exec(errMsg) ?? [])[1]) || 0,
            errMsg,
          );
        if (networkRetryCount < maxNetworkRetries && retryableSaveError) {
          setPhase("retry", networkRetryCount + 1);
          await new Promise((r) =>
            window.setTimeout(r, 2000 * (networkRetryCount + 1)),
          );
          await runAutosave(force, {
            ...opts,
            networkRetryCount: networkRetryCount + 1,
          });
          return;
        }
        if (saveGen === saveGenerationRef.current) {
          autosaveFailCooldownUntilRef.current =
            Date.now() + CANVAS_AUTOSAVE_FAIL_COOLDOWN_MS;
          autosavePendingRef.current = false;
          setSaveError(formatCanvasAutosaveUserHint(errMsg));
          if (isCanvasAutosaveReconnectError(errMsg)) {
            if (autosaveReconnectTimerRef.current !== null) {
              window.clearTimeout(autosaveReconnectTimerRef.current);
            }
            autosaveReconnectTimerRef.current = window.setTimeout(() => {
              autosaveReconnectTimerRef.current = null;
              if (
                canvasReadyRef.current &&
                isCanvasDirty() &&
                Date.now() >= autosaveFailCooldownUntilRef.current
              ) {
                void runAutosave(false);
              }
            }, CANVAS_AUTOSAVE_FAIL_COOLDOWN_MS + 100);
          }
          setSavePhase("idle");
          savePhaseRef.current = "idle";
          setSaving(false);
        }
      } finally {
        // 仅「当前世代」收尾：避免旧 save 清掉新 save 的 inFlight
        if (saveGen === saveGenerationRef.current) {
          autosaveInFlightRef.current = false;
          setCanvasSaveInFlight(false);
          resolveAutosaveIdleWaiters();
          if (autosaveSavingUiTimerRef.current !== null) {
            window.clearTimeout(autosaveSavingUiTimerRef.current);
            autosaveSavingUiTimerRef.current = null;
          }
          if (!saveMarkedDone) {
            setSaving(false);
            setSavePhase("idle");
            savePhaseRef.current = "idle";
            // 失败后禁止 pending 立刻再开一轮（死循环源）
            autosavePendingRef.current = false;
          } else if (autosavePendingRef.current) {
            autosavePendingRef.current = false;
            if (
              isCanvasDirty() &&
              Date.now() >= autosaveFailCooldownUntilRef.current
            ) {
              void runAutosave(false);
            }
          }
        }
      }
    };

    const scheduleAutosave = () => {
      if (!canvasReadyRef.current) return;
      if (!isCanvasDirty()) return;
      if (Date.now() < autosaveFailCooldownUntilRef.current) return;
      clearAutosaveTimer();
      autosaveTimerRef.current = window.setTimeout(() => {
        autosaveTimerRef.current = null;
        void runAutosave(false);
      }, CANVAS_AUTOSAVE_DEBOUNCE_MS);
    };

    // 按用户设置的间隔（如 5 分钟）写入一条历史版本。
    // 判据是 graphRevision 而非 isCanvasDirty()：1.5s debounce 已把编辑落盘并清掉 dirty，
    // 用 dirty 判断会让历史几乎永远写不进去（只有恰好在 tick 前 1.5s 内编辑才命中）。
    const maybeWriteHistorySnapshot = () => {
      if (!canvasReadyRef.current) return;
      const intervalMs = getCanvasAutosaveIntervalMs();
      if (intervalMs <= 0) return;
      if (Date.now() - historyWrittenAtRef.current < intervalMs) return;
      const revision = useCanvasStore.getState().graphRevision;
      if (historyWrittenRevisionRef.current === revision) return;
      void runAutosave(true, { writeHistory: true });
    };

    const restartAutosaveInterval = () => {
      if (autosaveIntervalRef.current !== null) {
        window.clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
      if (getCanvasAutosaveIntervalMs() <= 0) return;
      autosaveIntervalRef.current = window.setInterval(
        maybeWriteHistorySnapshot,
        CANVAS_AUTOSAVE_HISTORY_HEARTBEAT_MS,
      );
    };

    const unsub = useCanvasStore.subscribe((state, prev) => {
      const graphChanged = state.graphRevision !== prev.graphRevision;
      const viewportChanged =
        JSON.stringify(state.viewport) !== JSON.stringify(prev.viewport);
      if (!graphChanged && !viewportChanged) return;
      scheduleAutosave();
    });

    const unsubDragEnd = useCanvasStore.subscribe((state, prev) => {
      if (prev.canvasGeometryDragging && !state.canvasGeometryDragging) {
        if (autosavePendingRef.current) {
          autosavePendingRef.current = false;
          void runAutosave(true);
        }
      }
    });

    runAutosaveRef.current = runAutosave;
    registerCanvasGraphPersistFlush(runAutosave);
    registerCanvasGraphDirtyCheck(isCanvasDirty);
    registerCanvasProjectVersionSync(async () => {
      const bookBase = autosaveBaseRef.current;
      if (!bookBase || !canvasReadyRef.current) return null;
      try {
        const updatedAt = await getCanvasProjectUpdatedAt(bookBase, projectId);
        lastBaseUpdatedAtRef.current = updatedAt;
        setProject((p) => (p ? { ...p, updatedAt } : p));
        return updatedAt;
      } catch {
        return null;
      }
    });
    registerCanvasDeltaPersist(async (delta) => {
      const proj = autosaveProjectRef.current;
      const bookBase = autosaveBaseRef.current;
      if (!proj || !bookBase || !canvasReadyRef.current) return false;
      try {
        const { project: updatedProject } = await patchCanvasProject(
          bookBase,
          projectId,
          {
            canvasDelta: {
              ...delta,
              baseUpdatedAt: lastBaseUpdatedAtRef.current,
            },
          },
        );
        lastBaseUpdatedAtRef.current = updatedProject.updatedAt;
        syncLastPersistedSnapshot();
        setProject((p) =>
          p ? { ...p, updatedAt: updatedProject.updatedAt } : p,
        );
        setLastSavedAt(new Date());
        setSaveError(null);
        return true;
      } catch (e) {
        if (isCanvasApiConflictError(e)) {
          try {
            const fromErr = parseCanvasConflictUpdatedAt(e);
            const updatedAt =
              fromErr ??
              (await getCanvasProjectUpdatedAt(bookBase, projectId));
            lastBaseUpdatedAtRef.current = updatedAt;
            setProject((p) => (p ? { ...p, updatedAt } : p));
            const retry = await patchCanvasProject(bookBase, projectId, {
              canvasDelta: {
                ...delta,
                baseUpdatedAt: lastBaseUpdatedAtRef.current,
              },
            });
            lastBaseUpdatedAtRef.current = retry.project.updatedAt;
            syncLastPersistedSnapshot();
            setProject((p) =>
              p ? { ...p, updatedAt: retry.project.updatedAt } : p,
            );
            setLastSavedAt(new Date());
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
    });

    const flushAutosaveNow = () => {
      clearAutosaveTimer();
      void runAutosave(true);
    };

    const flushBeforeLeave = async () => {
      await waitForPendingCanvasImageUploads(60_000);
      await flushPendingCanvasImageUploadPersist();
      await runAutosave(true, { bypassCooldown: true });
    };

    const onPageHide = () => {
      void flushBeforeLeave();
    };

    const onFlushAutosave = (event: Event) => {
      const immediate = Boolean(
        (event as CustomEvent<{ immediate?: boolean }>).detail?.immediate,
      );
      if (immediate) {
        if (autosaveImmediateDebounceRef.current !== null) {
          window.clearTimeout(autosaveImmediateDebounceRef.current);
        }
        // 拖动松手：短 debounce 合并连续调整，避免整图 PATCH 排队
        autosaveImmediateDebounceRef.current = window.setTimeout(() => {
          autosaveImmediateDebounceRef.current = null;
          flushAutosaveNow();
        }, 280);
        return;
      }
      if (autosaveFlushDebounceRef.current !== null) {
        window.clearTimeout(autosaveFlushDebounceRef.current);
      }
      autosaveFlushDebounceRef.current = window.setTimeout(() => {
        autosaveFlushDebounceRef.current = null;
        flushAutosaveNow();
      }, 450);
    };
    const onIntervalChanged = () => {
      restartAutosaveInterval();
      scheduleAutosave();
    };

    const onLeaveProject = () => {
      void flushBeforeLeave();
    };

    restartAutosaveInterval();
    window.addEventListener("canvas:flush-autosave", onFlushAutosave);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("canvas:autosave-interval-changed", onIntervalChanged);
    window.addEventListener("canvas:leave-project", onLeaveProject);

    return () => {
      void flushBeforeLeave().finally(() => {
        registerCanvasGraphPersistFlush(null);
        registerCanvasGraphDirtyCheck(null);
        registerCanvasDeltaPersist(null);
        registerCanvasProjectVersionSync(null);
      });
      unsub();
      unsubDragEnd();
      syncLastPersistedSnapshotRef.current = null;
      isCanvasDirtyRef.current = null;
      window.removeEventListener("canvas:flush-autosave", onFlushAutosave);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener(
        "canvas:autosave-interval-changed",
        onIntervalChanged,
      );
      window.removeEventListener("canvas:leave-project", onLeaveProject);
      clearAutosaveTimer();
      if (autosaveFlushDebounceRef.current !== null) {
        window.clearTimeout(autosaveFlushDebounceRef.current);
        autosaveFlushDebounceRef.current = null;
      }
      if (autosaveImmediateDebounceRef.current !== null) {
        window.clearTimeout(autosaveImmediateDebounceRef.current);
        autosaveImmediateDebounceRef.current = null;
      }
      if (autosaveSavingUiTimerRef.current !== null) {
        window.clearTimeout(autosaveSavingUiTimerRef.current);
        autosaveSavingUiTimerRef.current = null;
      }
      if (autosaveIntervalRef.current !== null) {
        window.clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
      if (autosaveReconnectTimerRef.current !== null) {
        window.clearTimeout(autosaveReconnectTimerRef.current);
        autosaveReconnectTimerRef.current = null;
      }
    };
  }, [project, base, projectId, loading]);

  /** 生成/剪辑结束后补跑被推迟的 autosave */
  useEffect(() => {
    if (loading || inflightTaskCount > 0 || mediaRenderActive) return;
    if (!autosavePendingRef.current) return;
    autosavePendingRef.current = false;
    void runAutosaveRef.current(false);
  }, [inflightTaskCount, mediaRenderActive, loading]);

  const undo = useCallback(() => {
    canvasGraphUndo();
  }, []);

  const redo = useCallback(() => {
    canvasGraphRedo();
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

    const saveGen = ++saveGenerationRef.current;
    setSaveError(null);
    setSaving(true);
    savePhaseRef.current = "wait_uploads";
    setSavePhase("wait_uploads");
    try {
      await waitForPendingCanvasImageUploads(60_000);
      savePhaseRef.current = "commit_layout";
      setSavePhase("commit_layout");
      flushCanvasNodePositions();
      await new Promise<void>((resolve) => {
        queueMicrotask(() => resolve());
      });
      savePhaseRef.current = "flush_drafts";
      setSavePhase("flush_drafts");
      window.dispatchEvent(new CustomEvent("canvas:flush-text-drafts"));
      await new Promise<void>((resolve) => {
        queueMicrotask(() => resolve());
      });
      const graph = buildCanvasPersistGraph(toGraph);
      const thumb = pickPersistableProjectThumbnailUrl(graph);
      savePhaseRef.current = "history_thumb";
      setSavePhase("history_thumb");
      const shot = await captureCanvasViewportSnapshotUrl(base);
      const historyThumb = resolveCanvasHistoryThumbnailUrl(
        shot,
        graph,
        project.thumbnailUrl,
      );
      const patch: {
        canvas: typeof graph;
        thumbnailUrl?: string;
        historySnapshot: {
          source: "manual";
          label: string;
          thumbnailUrl?: string;
        };
      } = {
        canvas: graph,
        historySnapshot: {
          source: "manual",
          label: "手动保存",
          ...(historyThumb ? { thumbnailUrl: historyThumb } : {}),
        },
      };
      if (thumb && thumb !== project.thumbnailUrl) {
        patch.thumbnailUrl = thumb;
      }
      savePhaseRef.current = "patch_full";
      setSavePhase("patch_full");
      const { historyItem, project: updatedProject } = await patchCanvasProject(
        base,
        projectId,
        patch,
      );
      lastBaseUpdatedAtRef.current = updatedProject.updatedAt;
      loadedNodeCountRef.current = graph.nodes.length;
      if (patch.thumbnailUrl) {
        setProject((p) =>
          p
            ? {
                ...p,
                thumbnailUrl: patch.thumbnailUrl!,
                updatedAt: updatedProject.updatedAt,
              }
            : p,
        );
      } else {
        setProject((p) =>
          p ? { ...p, updatedAt: updatedProject.updatedAt } : p,
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
      if (saveGen === saveGenerationRef.current) {
        setSavePhase("done");
        window.setTimeout(() => {
          if (saveGen === saveGenerationRef.current) {
            setSavePhase("idle");
            setSaving(false);
          }
        }, 1200);
      }
    } catch (e) {
      if (saveGen === saveGenerationRef.current) {
        const errMsg = e instanceof Error ? e.message : "保存失败";
        setSaveError(formatCanvasAutosaveUserHint(errMsg));
        savePhaseRef.current = "idle";
        setSavePhase("idle");
        setSaving(false);
      }
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
      const newId = addNode(type, position, initialData);
      if (newId) {
        queueMicrotask(() => {
          useCanvasStore.getState().focusCanvasNode(newId);
        });
      }
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

  const onOpenShareDialog = useCallback(async () => {
    if (!base || !project) return;
    setSharePreparing(true);
    try {
      await runAutosaveRef.current(true);
      await Promise.race([
        waitForAutosaveIdle(),
        new Promise<void>((_, reject) => {
          window.setTimeout(() => reject(new Error("save_wait_timeout")), 12_000);
        }),
      ]);
      setShareDialogOpen(true);
    } catch {
      await dialogs.alert({
        title: "保存未完成",
        message: "分享前需先保存画布。请稍候重试，或点击「保存」后再分享。",
        variant: "warning",
      });
    } finally {
      setSharePreparing(false);
    }
  }, [base, project, dialogs]);

  const onSubmitPortalShare = useCallback(
    async (kind: import("@/lib/canvas-api").CanvasPortalPublishKind, note: string) => {
      if (!base?.trim()) return;
      try {
        const result = await submitCanvasPortalReview(base, projectId, {
          requestKind: kind,
          userNote: note || undefined,
        });
        if (result.appliedImmediately) {
          markRecentProjectsStale();
          showCanvasSuccessToast(
            kind === "PUBLIC_TEMPLATE" || kind === "TEMPLATE"
              ? "已发布 · 工作流模板已发布，可在首页「模板」查看"
              : kind === "FEATURED"
                ? "已发布 · 作品已发布到首页「精选」"
                : kind === "CASE"
                  ? project?.edition === "sbv1"
                    ? "已发布 · 作品已发布到首页「视频作品」"
                    : "已发布 · 作品已发布到首页「案例」"
                  : "已发布 · 作品已按所选类型对外展示",
          );
          if (kind === "PUBLIC_TEMPLATE" || kind === "TEMPLATE") {
            setTemplatesRefreshKey((k) => k + 1);
          }
        } else {
          markRecentProjectsStale();
          showCanvasSuccessToast(
            "已提交 · 管理员审核通过后将展示在首页相应位置",
          );
        }
      } catch (e) {
        await dialogs.alert({
          title: "分享失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
        throw e;
      }
    },
    [base, dialogs, projectId],
  );

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

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div
        className="fixed inset-0 z-[200] flex h-[100dvh] items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]"
        data-canvas-editor
        data-canvas-block-nav-gesture
      >
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载画布…
      </div>
    );
  } else if (loadError || !project) {
    const retiredHint =
      loadError && /\b404\b/.test(loadError)
        ? "旧版 2.0 剧本项目已停用（须新建项目使用 JSON-only 剧本），或项目不存在。纯生图/未用剧本的 2.0 项目不受影响。"
        : (loadError ?? "未知错误");
    body = (
      <div className="fixed inset-0 z-[200] flex h-[100dvh] flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] px-6 text-center text-sm text-red-200">
        <p>无法加载画布：{retiredHint}</p>
        <a href="/projects" className="underline">
          回到画布列表
        </a>
      </div>
    );
  } else {
    body = (
      <div
        ref={canvasEditorRef}
        className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[var(--canvas-bg)]"
        data-canvas-editor
        data-canvas-block-nav-gesture
        style={{ ["--canvas-toolbar-height" as string]: "3rem" }}
      >
        <div
          ref={toolbarShellRef}
          data-canvas-toolbar-shell
          className={cn(
            "z-[300] w-full min-w-0 max-w-full shrink-0 overflow-visible bg-[var(--canvas-bg)] shadow-[0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-300 ease-out",
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
            savePhase={savePhase}
            saveRetryAttempt={saveRetryAttempt}
            saveError={saveError}
            lastSavedAt={lastSavedAt}
            onSave={() => void manualSave()}
            onOpenMyTemplates={() => {
              closeAllToolbarPanels();
              setMyTemplatesOpen(true);
            }}
            onOpenMyHistory={() => {
              closeAllToolbarPanels();
              setMyHistoryOpen(true);
            }}
            onOpenGenerationRecords={() => {
              closeAllToolbarPanels();
              setMyGenerationRecordsOpen(true);
            }}
            onOpenMyCharacters={() => {
              closeAllToolbarPanels();
              setMyCharactersOpen(true);
            }}
            onOpenMyVideoLibrary={() => {
              closeAllToolbarPanels();
              setMyVideoLibraryOpen(true);
            }}
            onOpenMySavedScripts={
              isStoryProCanvas
                ? () => {
                    closeAllToolbarPanels();
                    setMySavedScriptsOpen(true);
                  }
                : undefined
            }
            onOpenProjectCharacterAssets={() => {
              closeAllToolbarPanels();
              setMyProjectCharacterAssetsOpen(true);
            }}
            onOpenPromptHistory={() => {
              closeAllToolbarPanels();
              setMyPromptHistoryOpen(true);
            }}
            onOpenStyleLibrary={
              isStoryProCanvas
                ? () => {
                    closeAllToolbarPanels();
                    setStyleLibraryOpen(true);
                  }
                : undefined
            }
            onReflowStoryLayout={
              isStoryComicCanvas ? () => reflowStoryComicLayout() : undefined
            }
            onSaveTemplate={() => void onSaveTemplate()}
            onShareTemplate={() => void onOpenShareDialog()}
            onShareWorkflow={() => setWorkflowShareOpen(true)}
            shareIsAdmin={isCanvasPortalAdmin}
            sharePreparing={sharePreparing}
            inflightTaskCount={inflightTaskCount}
            immersive={showImmersiveChrome ? immersive : false}
            onToggleImmersive={
              showImmersiveChrome ? () => void toggleImmersive() : undefined
            }
            centerLeading={
              isStoryPro2Canvas &&
              (crewAccess.canUseCrewBulletin || crewAccess.isPlatformAdmin)
                ? <Pro2ProductionGateToolbarLink />
                : undefined
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
      <MyPromptHistoryPanel
        open={myPromptHistoryOpen}
        onClose={() => setMyPromptHistoryOpen(false)}
        projectId={projectId}
        initialScope="mine"
      />
      {isStoryProCanvas || isStoryPro2Canvas ? (
        <StyleLibraryModal
          open={styleLibraryOpen}
          onClose={() => setStyleLibraryOpen(false)}
        />
      ) : null}
      <PortalSubmitDialog
        open={shareDialogOpen}
        projectName={project.name}
        edition={project.edition}
        isAdmin={isCanvasPortalAdmin}
        context="canvas"
        onClose={() => setShareDialogOpen(false)}
        onSubmit={onSubmitPortalShare}
      />
      <WorkflowShareLinkDialog
        open={workflowShareOpen}
        projectId={projectId}
        projectTitle={project.name}
        onClose={() => setWorkflowShareOpen(false)}
      />
      <div className="relative z-0 flex min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden isolate">
        {isStoryProCanvas && project ? (
          <ScriptWritingAssistantPanel
            projectId={projectId}
            onImportScript={onImportScriptFromAssistant}
            theme="pro"
          />
        ) : null}
        <div className="relative flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
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
        !isStoryPro2Canvas ? (
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
        !isSbv1Project &&
        !isStoryPro2Canvas ? (
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
    <CanvasToolsSessionProvider>
      <SaveProjectAssetDialogHost />
      <PortraitImportProgressHost />
      <Inner projectId={projectId} />
    </CanvasToolsSessionProvider>
  );
}
