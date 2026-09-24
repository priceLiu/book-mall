"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackgroundReplaceResultDialog } from "@/components/background-replace/background-replace-result-dialog";
import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  BackgroundGenerationProvider,
  useBackgroundGeneration,
} from "@/components/generation";
import {
  ImageLayerCanvas,
  type ImageLayerCanvasHandle,
} from "@/components/image-layer/image-layer-canvas";
import { ImageLayerCompareStage } from "@/components/image-layer/image-layer-compare-stage";
import { ImageLayerAssistantPanel } from "@/components/image-layer/image-layer-assistant-panel";
import { ImageLayerAssistantHeader } from "@/components/image-layer/image-layer-assistant-header";
import type { ImageLayerEditEntryView } from "@/components/image-layer/image-layer-edit-panel";
import { ImageLayerExportPreviewDialog } from "@/components/image-layer/image-layer-export-preview-dialog";
import { ImageLayerSaveDialog } from "@/components/image-layer/image-layer-save-dialog";
import { ImageLayerToolbar } from "@/components/image-layer/image-layer-toolbar";
import { ImageLayerUploadZone } from "@/components/image-layer/image-layer-upload-zone";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  fetchImageProcessingModels,
  submitImageProcessingEdit,
  type ImageProcessingParamField,
} from "@/lib/ecom-image-processing-api";
import {
  createImageLayerProject,
  decomposeImageLayers,
  editImageLayer,
  eraseImageLayerRegion,
  getImageLayerProject,
  listImageLayerProjectSummaries,
  saveImageLayerResult,
  saveImageLayerWorkspace,
  uploadImageLayerSource,
} from "@/lib/ecom-image-layer-api";
import { replaceEcomBackground } from "@/lib/ecom-background-replace-api";
import {
  DEFAULT_BACKGROUND_REPLACE_FORM,
  type BackgroundReplaceFormState,
} from "@/lib/background-replace-types";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import { ensureEcomSessionFresh } from "@/lib/ecom-silent-sso";
import { fetchEcomToolsSessionLite } from "@/lib/ecom-tools-session-client";
import { estimateBackgroundGenerationProgress } from "@/lib/generation/background-generation-policy";
import {
  downloadBlob,
  exportLayerStackPng,
} from "@/lib/image-layer-export";
import { attachPendingBboxesToStack } from "@/lib/image-layer-attach-bboxes";
import { IMAGE_LAYER_ERASE_MODEL_KEY } from "@/lib/image-layer-local-edit-constants";
import {
  missingEraseSelectionMessage,
  missingLocalEditSelectionMessage,
  resolveEraseSelectionPayload,
  resolveLocalEditSelectionPayload,
} from "@/lib/image-layer-local-edit-payload";
import { IMAGE_LAYER_MAX_BBOXES } from "@/lib/image-layer-constants";
import type { ImageLayerSaveItem } from "@/lib/image-layer-save-items";
import { resolvePendingBboxes } from "@/lib/image-layer-pending-bboxes";
import {
  IMAGE_LAYER_RETOUCH_MODEL_KEYS,
  isWan27RetouchModel,
  type ImageLayerCanvasToolMode,
  type ImageLayerSelectionSubTool,
} from "@/lib/image-layer-tool-mode";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type {
  ImageLayerEditEntry,
  ImageLayerProject,
  ImageLayerStack,
  ImageLayerStackItem,
  ImageLayerWorkspace,
} from "@/lib/image-layer-types";

const DECOMPOSE_TASK_ID = "image-layer-decompose";
const EDIT_TASK_ID = "image-layer-edit";
const RETOUCH_TASK_ID = "image-layer-retouch";
const ERASE_TASK_ID = "image-layer-erase";
const BG_REPLACE_TASK_ID = "image-layer-bg-replace";
const PROJECT_STORAGE_KEY = "ecom-image-layer-active-project";
const AUTO_SAVE_MS = 900;

function revokeBlobPreview(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function findLayerInStack(
  stack: ImageLayerStack,
  id: string,
): ImageLayerStackItem | null {
  if (stack.background.id === id) return stack.background;
  return stack.layers.find((l) => l.id === id) ?? null;
}

function buildWorkspaceSnapshot(args: {
  sourceUrl: string | null;
  originalImageUrl: string | null;
  stack: ImageLayerStack | null;
  pendingBboxes: Array<[number, number, number, number]>;
  canvasDims: { w: number; h: number };
  displayDims: { w: number; h: number } | null;
  selectedLayerId: string | null;
  editEntries: ImageLayerEditEntry[];
}): ImageLayerWorkspace {
  return {
    sourceImageUrl: args.sourceUrl ?? args.stack?.sourceImageUrl ?? null,
    originalImageUrl: args.originalImageUrl ?? args.sourceUrl ?? args.stack?.sourceImageUrl ?? null,
    stack: args.stack,
    pendingBboxes: args.pendingBboxes,
    canvasDims: args.canvasDims,
    ...(args.displayDims ? { displayDims: args.displayDims } : {}),
    selectedLayerId: args.selectedLayerId,
    editEntries: args.editEntries,
  };
}

function ImageLayerStudioInner() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportBlobRef = useRef<Blob | null>(null);
  const canvasRef = useRef<ImageLayerCanvasHandle>(null);

  const [project, setProject] = useState<ImageLayerProject | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [stack, setStack] = useState<ImageLayerStack | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [canvasToolMode, setCanvasToolMode] =
    useState<ImageLayerCanvasToolMode>("layer-view");
  const [selectionSubTool, setSelectionSubTool] =
    useState<ImageLayerSelectionSubTool>("brush");
  const [brushSize, setBrushSize] = useState(24);
  const [showTransparentMask, setShowTransparentMask] = useState(true);
  const [retouchModel, setRetouchModel] = useState("qwen-image-edit");
  const [retouchParams, setRetouchParams] = useState<Record<string, unknown>>({});
  const [retouchPrompt, setRetouchPrompt] = useState("");
  const [retouchModels, setRetouchModels] = useState<StoryboardGatewayModel[]>([]);
  const [retouchModelsLoading, setRetouchModelsLoading] = useState(true);
  const [retouchModelsError, setRetouchModelsError] = useState<string | null>(null);
  const [paramProfiles, setParamProfiles] = useState<
    Record<string, ImageProcessingParamField[]>
  >({});
  const [retouchBusy, setRetouchBusy] = useState(false);
  const [eraseBusy, setEraseBusy] = useState(false);
  const [bgReplaceBusy, setBgReplaceBusy] = useState(false);
  const [bgReplaceForm, setBgReplaceForm] = useState<BackgroundReplaceFormState>(
    DEFAULT_BACKGROUND_REPLACE_FORM,
  );
  const [bgReplaceCandidates, setBgReplaceCandidates] = useState<string[]>([]);
  const [bgReplacePickOpen, setBgReplacePickOpen] = useState(false);
  const [pendingBboxes, setPendingBboxes] = useState<
    Array<[number, number, number, number]>
  >([]);
  const [editEntries, setEditEntries] = useState<ImageLayerEditEntry[]>([]);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [displayDims, setDisplayDims] = useState<{ w: number; h: number } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [decomposeBusy, setDecomposeBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [canvasDims, setCanvasDims] = useState({ w: 1024, h: 1024 });
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportPreviewBusy, setExportPreviewBusy] = useState(false);
  const [exportDownloadBusy, setExportDownloadBusy] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const hydrateFromProject = useCallback((p: ImageLayerProject) => {
    skipAutoSaveRef.current = true;
    const ws = p.workspace ?? {};
    const nextSource = ws.sourceImageUrl?.trim() || null;

    setSourcePreviewUrl((prev) => {
      revokeBlobPreview(prev);
      return nextSource;
    });
    setSourceUrl(nextSource);
    setOriginalImageUrl(ws.originalImageUrl?.trim() || nextSource);
    setStack(ws.stack ?? null);
    setPendingBboxes(resolvePendingBboxes(ws));
    setSelectedLayerId(ws.selectedLayerId ?? null);
    if (ws.editEntries?.length) {
      setEditEntries(ws.editEntries);
    } else if (ws.selectedLayerId && ws.editPrompt?.trim()) {
      setEditEntries([{ layerId: ws.selectedLayerId, prompt: ws.editPrompt }]);
    } else {
      setEditEntries([]);
    }
    setDisplayDims(ws.displayDims ?? null);
    setCanvasToolMode(ws.stack ? "layer-view" : "decompose-bbox");

    if (ws.canvasDims?.w && ws.canvasDims?.h) {
      setCanvasDims(ws.canvasDims);
    } else if (nextSource) {
      const img = new Image();
      img.onload = () => setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = nextSource;
    } else {
      setCanvasDims({ w: 1024, h: 1024 });
    }

    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
    window.setTimeout(() => {
      skipAutoSaveRef.current = false;
    }, 0);
  }, []);

  const applyProject = useCallback(
    (p: ImageLayerProject) => {
      hydrateFromProject(p);
    },
    [hydrateFromProject],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchEcomToolsSessionLite().then((session) => {
      if (cancelled) return;
      if (!session.active) setNeedLogin(true);
      setSessionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionChecked || needLogin) return;

    let cancelled = false;
    (async () => {
      try {
        const savedId =
          typeof window !== "undefined" ? sessionStorage.getItem(PROJECT_STORAGE_KEY) : null;
        let p: ImageLayerProject;
        if (savedId) {
          try {
            p = await getImageLayerProject(savedId);
          } catch {
            p = await createImageLayerProject();
          }
        } else {
          p = await createImageLayerProject();
        }
        if (!cancelled) {
          applyProject(p);
          setProjectLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          if (isEcomUnauthorizedError(e)) setNeedLogin(true);
          else {
            await alert({
              title: "加载失败",
              message: e instanceof Error ? e.message : "无法打开图片分层工作台",
              variant: "error",
            });
          }
          setProjectLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [alert, applyProject, needLogin, sessionChecked]);

  useEffect(() => {
    if (!uploadBusy && !decomposeBusy && !editBusy && !retouchBusy && !eraseBusy) {
      return;
    }
    const id = window.setInterval(() => setProgressNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [decomposeBusy, editBusy, eraseBusy, retouchBusy, uploadBusy]);

  const loadRetouchModels = useCallback(async () => {
    setRetouchModelsLoading(true);
    setRetouchModelsError(null);
    try {
      const data = await fetchImageProcessingModels();
      setParamProfiles(data.paramProfiles ?? {});
      const filtered = (data.imageModels ?? [])
        .filter((m) =>
          (IMAGE_LAYER_RETOUCH_MODEL_KEYS as readonly string[]).includes(m.modelKey),
        )
        .map(
          (m): StoryboardGatewayModel => ({
            modelKey: m.modelKey,
            displayName: m.displayName,
            description: m.description,
            role: "IMAGE",
            providerKind: m.providerKind,
            credentialBound: m.credentialBound,
          }),
        );
      setRetouchModels(filtered);
      const preferred = "qwen-image-edit";
      const defaultKey = data.defaults?.retouch?.trim();
      if (filtered.some((m) => m.modelKey === preferred)) {
        setRetouchModel(preferred);
      } else if (defaultKey && filtered.some((m) => m.modelKey === defaultKey)) {
        setRetouchModel(defaultKey);
      } else if (filtered[0]?.modelKey) {
        setRetouchModel(filtered[0].modelKey);
      }
    } catch (e) {
      setRetouchModelsError(e instanceof Error ? e.message : "模型加载失败");
    } finally {
      setRetouchModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionChecked || needLogin) return;
    void loadRetouchModels();
  }, [loadRetouchModels, needLogin, sessionChecked]);

  const buildSnapshot = useCallback(
    (): ImageLayerWorkspace =>
      buildWorkspaceSnapshot({
        sourceUrl,
        originalImageUrl,
        stack,
        pendingBboxes,
        canvasDims,
        displayDims,
        selectedLayerId,
        editEntries,
      }),
    [
      canvasDims,
      displayDims,
      editEntries,
      originalImageUrl,
      pendingBboxes,
      selectedLayerId,
      sourceUrl,
      stack,
    ],
  );

  const persistWorkspace = useCallback(
    async (workspace?: ImageLayerWorkspace) => {
      if (!project?.id) return null;
      const next = workspace ?? buildSnapshot();
      const updated = await saveImageLayerWorkspace(project.id, next);
      setProject(updated);
      return updated;
    },
    [buildSnapshot, project?.id],
  );

  useEffect(() => {
    if (!project?.id || skipAutoSaveRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void persistWorkspace().catch(() => undefined);
    }, AUTO_SAVE_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    buildSnapshot,
    canvasDims,
    displayDims,
    editEntries,
    originalImageUrl,
    pendingBboxes,
    persistWorkspace,
    project?.id,
    selectedLayerId,
    sourceUrl,
    stack,
  ]);

  const ensureSessionForAi = useCallback(async (): Promise<boolean> => {
    const ok = await ensureEcomSessionFresh(120, {
      returnPath: "/ecom/image-layer",
      redirectOnFailure: false,
    });
    if (!ok) {
      setNeedLogin(true);
      await alert({
        title: "需要登录",
        message:
          "工具站会话无效或已过期。请从主站 Book 重新进入电商工具箱后再试（直接打开 localhost:3007 可能缺少 tools_token）。",
        variant: "error",
      });
      return false;
    }
    return true;
  }, [alert]);

  const ensureSessionForUpload = useCallback(async (): Promise<boolean> => {
    const session = await fetchEcomToolsSessionLite();
    if (session.active) return true;
    return ensureSessionForAi();
  }, [ensureSessionForAi]);

  const editEntryViews = useMemo((): ImageLayerEditEntryView[] => {
    if (!stack) return [];
    const promptById = new Map(editEntries.map((e) => [e.layerId, e.prompt]));
    return [stack.background, ...stack.layers].map((layer) => ({
      layer,
      prompt: promptById.get(layer.id) ?? "",
    }));
  }, [editEntries, stack]);

  const applyStack = useCallback(
    (
      next: ImageLayerStack,
      opts?: { keepEditEntries?: boolean; pendingBboxes?: Array<[number, number, number, number]> },
    ) => {
      const merged = attachPendingBboxesToStack(
        next,
        opts?.pendingBboxes ?? [],
      );
      setStack(merged);
      setCanvasToolMode("layer-view");
      setPendingBboxes([]);
      setSelectedLayerId(null);
      if (!opts?.keepEditEntries) {
        setEditEntries([]);
      }
    },
    [],
  );

  const applyFlatEditResult = useCallback(
    async (
      editedUrl: string,
      opts?: { compareFromUrl?: string; toolMode?: ImageLayerCanvasToolMode },
    ) => {
      const nextOriginal = opts?.compareFromUrl?.trim() || originalImageUrl;
      if (opts?.compareFromUrl?.trim()) {
        setOriginalImageUrl(nextOriginal);
      }
      setStack(null);
      setSelectedLayerId(null);
      setEditEntries([]);
      setPendingBboxes([]);
      setSourceUrl(editedUrl);
      setSourcePreviewUrl((prev) => {
        revokeBlobPreview(prev);
        return editedUrl;
      });
      setCanvasToolMode(opts?.toolMode ?? "decompose-bbox");
      canvasRef.current?.clearMask();
      const img = new Image();
      img.onload = () =>
        setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = editedUrl;
      if (project?.id) {
        skipAutoSaveRef.current = true;
        try {
          const updated = await saveImageLayerWorkspace(project.id, {
            sourceImageUrl: editedUrl,
            originalImageUrl: nextOriginal,
            stack: null,
            pendingBboxes: [],
            canvasDims: canvasDims,
            selectedLayerId: null,
            editEntries: [],
          });
          setProject(updated);
        } finally {
          skipAutoSaveRef.current = false;
        }
      }
    },
    [canvasDims, originalImageUrl, project?.id],
  );

  const clearSourceState = useCallback(async () => {
    setSourcePreviewUrl((prev) => {
      revokeBlobPreview(prev);
      return null;
    });
    setSourceUrl(null);
    setOriginalImageUrl(null);
    setStack(null);
    setSelectedLayerId(null);
    setPendingBboxes([]);
    setCanvasToolMode("layer-view");
    setEditEntries([]);
    setDisplayDims(null);

    if (project?.id) {
      skipAutoSaveRef.current = true;
      try {
        const updated = await saveImageLayerWorkspace(project.id, {
          sourceImageUrl: null,
          originalImageUrl: null,
          stack: null,
          pendingBboxes: [],
          canvasDims: { w: 1024, h: 1024 },
          selectedLayerId: null,
          editEntries: [],
        });
        setProject(updated);
      } finally {
        skipAutoSaveRef.current = false;
      }
    }
  }, [project?.id]);

  const handleUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file || !project?.id) return;
      if (!file.type.includes("jpeg") && !file.type.includes("png")) {
        await alert({
          title: "格式不支持",
          message: "请上传 png 或 jpeg 图片",
          variant: "error",
        });
        return;
      }
      if (!(await ensureSessionForUpload())) return;

      setStack(null);
      setSelectedLayerId(null);
      setPendingBboxes([]);
      setCanvasToolMode("decompose-bbox");
      setSourceUrl(null);
      setOriginalImageUrl(null);

      const preview = URL.createObjectURL(file);
      setSourcePreviewUrl((prev) => {
        revokeBlobPreview(prev);
        return preview;
      });
      setOriginalImageUrl(preview);
      const img = new Image();
      img.onload = () => setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = preview;

      setUploadBusy(true);
      setBusyLabel("上传至 OSS…");
      setNeedLogin(false);
      try {
        const { ossUrl } = await uploadImageLayerSource(file, project.id);
        setSourceUrl(ossUrl);
        setOriginalImageUrl(ossUrl);
        setSourcePreviewUrl((prev) => {
          if (prev === preview) revokeBlobPreview(preview);
          return ossUrl;
        });
        const updated = await getImageLayerProject(project.id);
        setProject(updated);
        await toast({
          variant: "success",
          title: "图片已保存",
          message: "刷新页面后仍可继续编辑",
        });
      } catch (e) {
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
          return;
        }
        await alert({
          title: "上传失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setUploadBusy(false);
        setBusyLabel(null);
      }
    },
    [alert, ensureSessionForUpload, project?.id, toast],
  );

  /** 把即将拆层的整图提到左边，保证「原图」就是这次拆的图 */
  const promoteAsDecomposeSource = useCallback(
    async (url: string, opts?: { persist?: boolean; clearStack?: boolean }) => {
      const next = url.trim();
      if (!next) return;
      setOriginalImageUrl(next);
      setSourceUrl(next);
      setSourcePreviewUrl((prev) => {
        revokeBlobPreview(prev);
        return next;
      });
      if (opts?.clearStack) {
        setStack(null);
        setSelectedLayerId(null);
        setEditEntries([]);
        setPendingBboxes([]);
        setCanvasToolMode("decompose-bbox");
        canvasRef.current?.clearMask();
      }
      if (opts?.persist && project?.id) {
        skipAutoSaveRef.current = true;
        try {
          const updated = await saveImageLayerWorkspace(project.id, {
            sourceImageUrl: next,
            originalImageUrl: next,
            stack: opts.clearStack ? null : stack,
            pendingBboxes: opts.clearStack ? [] : pendingBboxes,
            selectedLayerId: opts.clearStack ? null : selectedLayerId,
            editEntries: opts.clearStack ? [] : editEntries,
          });
          setProject(updated);
        } finally {
          skipAutoSaveRef.current = false;
        }
      }
    },
    [editEntries, pendingBboxes, project?.id, selectedLayerId, stack],
  );

  const executeDecompose = useCallback(async (): Promise<ImageLayerStack | null> => {
    const decomposeUrl =
      sourceUrl?.trim() || stack?.sourceImageUrl?.trim() || "";
    if (!decomposeUrl) {
      await alert({
        title: "请先上传图片",
        message: "选择 png/jpeg 成品图后，点击「AI 图层分离」。",
        variant: "error",
      });
      return null;
    }
    if (!project?.id) return null;

    setDecomposeBusy(true);
    setBusyLabel("AI 图层分离中…");
    setNeedLogin(false);

    const taskId = DECOMPOSE_TASK_ID;
    const prevStack = stack;

    try {
      await promoteAsDecomposeSource(decomposeUrl, { clearStack: true });

      backgroundGen.registerTask({
        id: taskId,
        label: "AI 图层分离",
        hint: "Seedream 5.0 Pro · 可能需 1～2 分钟",
        startedAt: new Date().toISOString(),
        expectedDurationMs: 120_000,
        poll: async () => ({ status: "running" as const }),
      });

      const result = await decomposeImageLayers({
        sourceImageUrl: decomposeUrl,
        projectId: project.id,
        ...(pendingBboxes.length ? { bboxes: pendingBboxes } : {}),
      });
      applyStack(result, { pendingBboxes: [...pendingBboxes] });
      const updated = await getImageLayerProject(project.id);
      setProject(updated);
      backgroundGen.dismissTask(taskId);
      return result;
    } catch (e) {
      backgroundGen.failTask(
        taskId,
        e instanceof Error ? e.message : "图层分离失败",
      );
      if (isEcomUnauthorizedError(e)) {
        setNeedLogin(true);
        return null;
      }
      if (prevStack) setStack(prevStack);
      await alert({
        title: "图层分离失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
      return null;
    } finally {
      setDecomposeBusy(false);
      setBusyLabel(null);
    }
  }, [
    alert,
    applyStack,
    backgroundGen,
    pendingBboxes,
    project?.id,
    promoteAsDecomposeSource,
    sourceUrl,
    stack,
  ]);

  const runDecompose = useCallback(async () => {
    if (!(await ensureSessionForAi())) return;
    if (
      !(await confirm({
        title: stack ? "用当前整图重新拆分？" : "确认 AI 图层分离？",
        message: stack
          ? "左侧会换成当前这张整图作为拆层原图，然后重新拆分（消耗算力）。"
          : "将拆分当前整图。左侧会显示这张原图，完成后可对照图层结果。",
      }))
    ) {
      return;
    }
    const result = await executeDecompose();
    if (!result) return;
    await toast({
      variant: "success",
      title: "图层分离完成",
      message: "左侧为本次拆层原图，右侧为图层结果。",
    });
  }, [confirm, ensureSessionForAi, executeDecompose, stack, toast]);

  const handleSelectLayer = useCallback(
    (id: string | null) => {
      setSelectedLayerId(id);
      if (!id || !stack) return;
      const layer = findLayerInStack(stack, id);
      if (!layer || layer.isBackground) return;
      setEditEntries((prev) => {
        if (prev.some((e) => e.layerId === id)) return prev;
        return [...prev, { layerId: id, prompt: "" }];
      });
    },
    [stack],
  );

  const handleEditPromptChange = useCallback((layerId: string, value: string) => {
    setEditEntries((prev) => {
      if (prev.some((e) => e.layerId === layerId)) {
        return prev.map((e) => (e.layerId === layerId ? { ...e, prompt: value } : e));
      }
      return [...prev, { layerId, prompt: value }];
    });
  }, []);

  const handleRemoveEditEntry = useCallback((layerId: string) => {
    setEditEntries((prev) => prev.filter((e) => e.layerId !== layerId));
    setSelectedLayerId((prev) => (prev === layerId ? null : prev));
  }, []);

  const editSubmitCount = useMemo(
    () =>
      editEntryViews.filter(
        (v) => !v.layer.isBackground && v.prompt.trim().length > 0,
      ).length,
    [editEntryViews],
  );

  const runEditAll = useCallback(async () => {
    if (!stack || !project?.id) return;

    type EditJob = {
      layerId: string;
      label: string;
      bbox: [number, number, number, number];
      prompt: string;
      zIndex: number;
    };

    const jobs: EditJob[] = editEntries.flatMap((entry) => {
      const prompt = entry.prompt.trim();
      if (!prompt) return [];
      const layer = findLayerInStack(stack, entry.layerId);
      const bbox = layer?.bbox?.normalized;
      if (!layer || layer.isBackground || !bbox) return [];
      return [
        {
          layerId: layer.id,
          label: layer.name ?? "物体层",
          bbox,
          prompt,
          zIndex: layer.zIndex,
        },
      ];
    });

    if (jobs.length === 0) {
      await alert({
        title: "请先填写修改描述",
        message: "在至少一个图层卡片中输入描述后再提交。",
        variant: "error",
      });
      return;
    }

    const missingBbox = editEntries.filter((entry) => {
      if (!entry.prompt.trim()) return false;
      const layer = findLayerInStack(stack, entry.layerId);
      return !layer?.bbox?.normalized;
    });
    if (missingBbox.length > 0) {
      await alert({
        title: "无法改层",
        message: "部分图层缺少 bbox 坐标，请重新拆分后再试。",
        variant: "error",
      });
      return;
    }

    if (!(await ensureSessionForAi())) return;

    jobs.sort((a, b) => a.zIndex - b.zIndex);

    setEditBusy(true);
    setNeedLogin(false);
    const taskId = EDIT_TASK_ID;

    const compositeImageUrl =
      stack.sourceImageUrl ?? stack.background.url ?? sourceUrl ?? "";
    if (!compositeImageUrl) {
      setEditBusy(false);
      return;
    }

    try {
      backgroundGen.registerTask({
        id: taskId,
        label: "AI 批量修改图层",
        hint: `共 ${jobs.length} 层 · 改完回到整图`,
        startedAt: new Date().toISOString(),
        expectedDurationMs: 180_000,
        poll: async () => ({ status: "running" as const }),
      });

      setEditingLayerId(jobs[0]?.layerId ?? null);
      setBusyLabel(`AI 修改 ${jobs.length} 层…`);

      const result = await editImageLayer({
        compositeImageUrl,
        edits: jobs.map((j) => ({ bbox: j.bbox, prompt: j.prompt })),
        projectId: project.id,
      });
      await applyFlatEditResult(result.imageUrl);

      setEditEntries([]);
      backgroundGen.dismissTask(taskId);
      await toast({
        variant: "success",
        title: "图层修改完成",
        message: `已处理 ${jobs.length} 层，当前为整图。可点「保存图片」入库，或再点「AI 图层分离」。`,
      });
    } catch (e) {
      backgroundGen.failTask(taskId, e instanceof Error ? e.message : "改层失败");
      if (isEcomUnauthorizedError(e)) {
        setNeedLogin(true);
        return;
      }
      await alert({
        title: "改层失败",
        message: e instanceof Error ? e.message : "请稍后重试",
      });
    } finally {
      setEditBusy(false);
      setEditingLayerId(null);
      setBusyLabel(null);
    }
  }, [
    alert,
    applyFlatEditResult,
    backgroundGen,
    editEntries,
    ensureSessionForAi,
    project?.id,
    sourceUrl,
    stack,
    toast,
  ]);

  const flatEditImageUrl = useMemo(() => {
    if (stack) {
      return (
        stack.sourceImageUrl ??
        stack.background.url ??
        sourceUrl ??
        sourcePreviewUrl ??
        ""
      );
    }
    return sourceUrl ?? sourcePreviewUrl ?? "";
  }, [sourcePreviewUrl, sourceUrl, stack]);

  const retouchParamFields = paramProfiles[retouchModel] ?? [];
  const retouchUsesBbox =
    canvasToolMode === "retouch" && isWan27RetouchModel(retouchModel);

  const buildRetouchParameters = useCallback(() => {
    const out: Record<string, unknown> = { ...retouchParams };
    if (out.seed === undefined || out.seed === "") delete out.seed;
    if (out.size === "") delete out.size;
    if (out.n) out.n = Number(out.n);
    return out;
  }, [retouchParams]);

  const handleRetouchModelChange = useCallback((modelKey: string) => {
    setRetouchModel(modelKey);
    setRetouchParams({});
    if (isWan27RetouchModel(modelKey)) {
      setSelectionSubTool("bbox");
    }
  }, []);

  const httpSourceUrl = useCallback(() => {
    const oss = sourceUrl?.trim() ?? "";
    if (oss.startsWith("http://") || oss.startsWith("https://")) return oss;
    const flat = flatEditImageUrl.trim();
    if (flat.startsWith("http://") || flat.startsWith("https://")) return flat;
    return "";
  }, [flatEditImageUrl, sourceUrl]);

  const handleToolModeChange = useCallback(
    (mode: ImageLayerCanvasToolMode) => {
      if (stack && (mode === "retouch" || mode === "erase" || mode === "bg-replace")) {
        void toast({
          variant: "error",
          title: "分层进行中",
          message: "请先保存图片或点击「取消分层」，再使用换背景 / 重绘 / 擦除。",
        });
        return;
      }
      setCanvasToolMode(mode);
      if (mode !== "decompose-bbox") {
        canvasRef.current?.clearMask();
      }
    },
    [stack, toast],
  );

  const uploadBgReplaceImage = useCallback(
    async (file: File): Promise<string> => {
      const { ossUrl } = await uploadImageLayerSource(file);
      return ossUrl;
    },
    [],
  );

  const resolveBgReplaceBaseUrl = useCallback(async (): Promise<string> => {
    const source = httpSourceUrl();
    if (!source) {
      throw new Error(
        sourcePreviewUrl
          ? "原图还在上传到云端，请稍后再换背景"
          : "请先上传图片",
      );
    }
    return source;
  }, [httpSourceUrl, sourcePreviewUrl]);

  const applyBgReplaceResult = useCallback(
    async (url: string) => {
      const before = sourceUrl?.trim() || httpSourceUrl();
      await applyFlatEditResult(url, {
        compareFromUrl: before || undefined,
        toolMode: "bg-replace",
      });
      setBgReplacePickOpen(false);
      setBgReplaceCandidates([]);
      await toast({
        variant: "success",
        title: "已换背景",
        message: "右边是新场景，左边是换之前的图。",
      });
    },
    [applyFlatEditResult, httpSourceUrl, sourceUrl, toast],
  );

  const runBackgroundReplace = useCallback(async () => {
    if (!(await ensureSessionForAi())) return;
    setBgReplaceBusy(true);
    setBusyLabel("换背景中…");
    setNeedLogin(false);
    const taskId = BG_REPLACE_TASK_ID;
    try {
      const baseImageUrl = await resolveBgReplaceBaseUrl();
      backgroundGen.registerTask({
        id: taskId,
        label: "换背景",
        hint: "万相背景生成 · 可能需 1～2 分钟",
        startedAt: new Date().toISOString(),
        expectedDurationMs: 120_000,
        poll: async () => ({ status: "running" as const }),
      });
      const result = await replaceEcomBackground({
        baseImageUrl,
        form: bgReplaceForm,
        sourceModule: "image-layer",
        projectId: project?.id,
        clientPage: "ecom/image-layer",
      });
      backgroundGen.dismissTask(taskId);
      if (result.imageUrls.length === 1) {
        await applyBgReplaceResult(result.imageUrls[0]!);
        return;
      }
      setBgReplaceCandidates(result.imageUrls);
      setBgReplacePickOpen(true);
      await toast({
        variant: "success",
        title: `已生成 ${result.imageUrls.length} 张`,
        message: "请选择一张应用到中栏。",
      });
    } catch (e) {
      backgroundGen.failTask(
        taskId,
        e instanceof Error ? e.message : "换背景失败",
      );
      if (isEcomUnauthorizedError(e)) {
        setNeedLogin(true);
        return;
      }
      await alert({
        title: "换背景失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBgReplaceBusy(false);
      setBusyLabel(null);
    }
  }, [
    alert,
    applyBgReplaceResult,
    backgroundGen,
    bgReplaceForm,
    ensureSessionForAi,
    project?.id,
    resolveBgReplaceBaseUrl,
    toast,
  ]);

  const handleClearSelection = useCallback(() => {
    canvasRef.current?.clearMask();
    setPendingBboxes([]);
  }, []);

  const runRetouch = useCallback(async () => {
    const source = httpSourceUrl();
    if (!source) {
      await alert({
        title: "请先上传图片",
        message: sourcePreviewUrl
          ? "原图还在上传到云端，请稍后再重绘"
          : "需要底图才能重绘",
        variant: "error",
      });
      return;
    }
    if (!retouchPrompt.trim()) {
      await alert({
        title: "请填写描述",
        message: "说明选区应替换成什么",
        variant: "error",
      });
      return;
    }
    if (!(await ensureSessionForAi())) return;

    const selection = resolveLocalEditSelectionPayload({
      model: retouchModel,
      mask: canvasRef.current?.getMaskDataUrl() ?? undefined,
      bbox: canvasRef.current?.getBbox() ?? undefined,
      natural: canvasRef.current?.getNaturalSize(),
    });
    if (!selection.maskImageDataUrl && !selection.bbox) {
      const missing = missingLocalEditSelectionMessage(retouchModel);
      await alert({ ...missing, variant: "error" });
      return;
    }

    setRetouchBusy(true);
    setBusyLabel("局部重绘中…");
    const taskId = RETOUCH_TASK_ID;
    try {
      backgroundGen.registerTask({
        id: taskId,
        label: "局部重绘",
        hint: retouchModel,
        startedAt: new Date().toISOString(),
        expectedDurationMs: 90_000,
        poll: async () => ({ status: "running" as const }),
      });

      const res = await submitImageProcessingEdit({
        mode: "retouch",
        model: retouchModel,
        prompt: retouchPrompt.trim(),
        sourceImageDataUrl: source,
        maskImageDataUrl: selection.maskImageDataUrl,
        bbox: selection.bbox,
        parameters: buildRetouchParameters(),
      });
      const editedUrl = res.imageUrls[0];
      if (!editedUrl) throw new Error("未获得重绘结果");

      await applyFlatEditResult(editedUrl);
      backgroundGen.dismissTask(taskId);
      await toast({
        variant: "success",
        title: "重绘完成",
        message: "已更新底图。可点「保存图片」入库，或再框选拆分。",
      });
    } catch (e) {
      backgroundGen.failTask(taskId, e instanceof Error ? e.message : "重绘失败");
      if (isEcomUnauthorizedError(e)) {
        setNeedLogin(true);
        return;
      }
      await alert({
        title: "重绘失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRetouchBusy(false);
      setBusyLabel(null);
    }
  }, [
    alert,
    applyFlatEditResult,
    backgroundGen,
    buildRetouchParameters,
    ensureSessionForAi,
    httpSourceUrl,
    retouchModel,
    retouchPrompt,
    sourcePreviewUrl,
    toast,
  ]);

  const runErase = useCallback(async () => {
    const source = httpSourceUrl();
    if (!source) {
      await alert({
        title: "请先上传图片",
        message: sourcePreviewUrl
          ? "原图还在上传到云端，请稍后再擦除"
          : "需要底图才能擦除",
        variant: "error",
      });
      return;
    }
    if (!(await ensureSessionForAi())) return;

    const selection = resolveEraseSelectionPayload({
      mask: canvasRef.current?.getMaskDataUrl() ?? undefined,
      bbox: canvasRef.current?.getBbox() ?? undefined,
      natural: canvasRef.current?.getNaturalSize(),
    });
    if (!selection.maskDataUrl) {
      await alert({ ...missingEraseSelectionMessage(), variant: "error" });
      return;
    }

    setEraseBusy(true);
    setBusyLabel("图像擦除补全中…");
    const taskId = ERASE_TASK_ID;
    try {
      backgroundGen.registerTask({
        id: taskId,
        label: "图像擦除补全",
        hint: IMAGE_LAYER_ERASE_MODEL_KEY,
        startedAt: new Date().toISOString(),
        expectedDurationMs: 90_000,
        poll: async () => ({ status: "running" as const }),
      });

      const res = await eraseImageLayerRegion({
        sourceImageUrl: source,
        maskDataUrl: selection.maskDataUrl,
        projectId: project?.id,
      });
      const editedUrl = res.imageUrl;
      if (!editedUrl) throw new Error("未获得擦除结果");

      await applyFlatEditResult(editedUrl);
      backgroundGen.dismissTask(taskId);
      await toast({
        variant: "success",
        title: "擦除补全完成",
        message: "已更新底图。可点「保存图片」入库，或再框选拆分。",
      });
    } catch (e) {
      backgroundGen.failTask(taskId, e instanceof Error ? e.message : "擦除补全失败");
      if (isEcomUnauthorizedError(e)) {
        setNeedLogin(true);
        return;
      }
      await alert({
        title: "擦除补全失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setEraseBusy(false);
      setBusyLabel(null);
    }
  }, [
    alert,
    applyFlatEditResult,
    backgroundGen,
    ensureSessionForAi,
    httpSourceUrl,
    project?.id,
    sourcePreviewUrl,
    toast,
  ]);

  const revokeExportPreview = useCallback(() => {
    setExportPreviewUrl((prev) => {
      revokeBlobPreview(prev);
      return null;
    });
    exportBlobRef.current = null;
  }, []);

  const composeExportBlob = useCallback(async (): Promise<Blob> => {
    if (!stack) throw new Error("请先完成图层分离");
    const displayScale =
      displayDims && displayDims.w > 0 ? canvasDims.w / displayDims.w : 1;
    return exportLayerStackPng({
      background: stack.background,
      layers: stack.layers,
      width: canvasDims.w,
      height: canvasDims.h,
      displayScale,
    });
  }, [canvasDims.h, canvasDims.w, displayDims, stack]);

  const downloadExportBlob = useCallback(
    async (blob: Blob) => {
      downloadBlob(blob, `image-layer-${Date.now()}.png`);
      await toast({
        variant: "success",
        title: "已导出 PNG",
        message: "成品图已保存到本地下载目录",
      });
    },
    [toast],
  );

  useEffect(() => {
    revokeExportPreview();
    setExportPreviewOpen(false);
  }, [stack, revokeExportPreview]);

  useEffect(() => {
    return () => revokeExportPreview();
  }, [revokeExportPreview]);

  const handlePreviewExport = useCallback(async () => {
    if (!stack) return;
    revokeExportPreview();
    setExportPreviewOpen(true);
    setExportPreviewBusy(true);
    try {
      const blob = await composeExportBlob();
      exportBlobRef.current = blob;
      setExportPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setExportPreviewOpen(false);
      await alert({
        title: "预览失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setExportPreviewBusy(false);
    }
  }, [alert, composeExportBlob, revokeExportPreview, stack]);

  const handleExportDownload = useCallback(async () => {
    if (!stack) return;
    setExportDownloadBusy(true);
    try {
      const blob = exportBlobRef.current ?? (await composeExportBlob());
      await downloadExportBlob(blob);
    } catch (e) {
      await alert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setExportDownloadBusy(false);
    }
  }, [alert, composeExportBlob, downloadExportBlob, stack]);

  const handleExport = useCallback(async () => {
    await handleExportDownload();
  }, [handleExportDownload]);

  const handleLayerMove = useCallback((id: string, offsetX: number, offsetY: number) => {
    setStack((prev) => {
      if (!prev) return prev;
      const patch = (item: ImageLayerStackItem) =>
        item.id === id ? { ...item, offsetX, offsetY } : item;
      return {
        ...prev,
        layers: prev.layers.map(patch),
        background: patch(prev.background),
      };
    });
  }, []);

  const handleSaveWorkspace = useCallback(async () => {
    if (!project?.id) return;
    setSaveBusy(true);
    try {
      await persistWorkspace();
      await toast({ variant: "success", title: "已保存", message: "工作区已同步到云端" });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
      throw e;
    } finally {
      setSaveBusy(false);
    }
  }, [alert, persistWorkspace, project?.id, toast]);

  const [saveLibraryBusy, setSaveLibraryBusy] = useState(false);

  const handleSaveToLibrary = useCallback(
    async (item: ImageLayerSaveItem) => {
      if (!project?.id) throw new Error("请先打开项目");
      if (item.url.startsWith("blob:")) {
        throw new Error("图片还在上传，请稍后再保存");
      }
      setSaveLibraryBusy(true);
      try {
        const result = await saveImageLayerResult({
          projectId: project.id,
          ossUrl: item.url,
          title: item.libraryTitle ?? item.label,
        });
        if (item.id === "flat") {
          await promoteAsDecomposeSource(item.url, { persist: true, clearStack: true });
        }
        await toast({
          variant: "success",
          title: result.created ? "已保存到我的资产" : "资产库已有此图",
          message:
            item.id === "flat"
              ? "已放到左侧作为原图，可再点「AI 图层分离」。"
              : "可在「我的资产 · 图片分层」查看。",
        });
      } catch (e) {
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
          throw e;
        }
        throw e instanceof Error ? e : new Error("保存失败");
      } finally {
        setSaveLibraryBusy(false);
      }
    },
    [project?.id, promoteAsDecomposeSource, toast],
  );

  const handleCancelLayerSession = useCallback(async () => {
    if (!stack) return;
    if (
      !(await confirm({
        title: "取消分层？",
        message:
          "将清除当前图层拆分结果，恢复为拆分前的单张底图。如需保留各图层，请先点「保存图片」下载。",
      }))
    ) {
      return;
    }
    const flatUrl =
      stack.sourceImageUrl?.trim() ||
      sourceUrl?.trim() ||
      stack.background.url;
    await applyFlatEditResult(flatUrl);
    await toast({
      variant: "success",
      title: "已取消分层",
      message: "可继续使用重绘、擦除或重新框选拆分。",
    });
  }, [applyFlatEditResult, confirm, sourceUrl, stack, toast]);

  const handleNewProject = useCallback(async () => {
    const hasWork = Boolean(sourceUrl || stack);
    await runEcomNewProjectWithSavePrompt({
      confirm,
      hasWorkToSave: hasWork,
      message: "当前项目有未保存的内容。是否先保存再新建？",
      save: async () => {
        await persistWorkspace();
        await toast({ variant: "success", title: "已保存" });
      },
      onProceed: async () => {
        const p = await createImageLayerProject();
        applyProject(p);
        await toast({ variant: "success", title: "已新建项目" });
      },
    });
  }, [applyProject, confirm, persistWorkspace, sourceUrl, stack, toast]);

  const handleSelectProject = useCallback(
    async (id: string) => {
      if (id === project?.id) return;
      setSaveBusy(true);
      try {
        if (project?.id) await persistWorkspace();
        const p = await getImageLayerProject(id);
        applyProject(p);
      } catch (e) {
        await alert({
          title: "切换项目失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setSaveBusy(false);
      }
    },
    [alert, applyProject, persistWorkspace, project?.id],
  );

  const loadProjectList = useCallback(() => listImageLayerProjectSummaries(), []);

  const aiBusy =
    decomposeBusy || editBusy || retouchBusy || eraseBusy || bgReplaceBusy;
  const exportBusy = exportPreviewBusy || exportDownloadBusy;
  const anyBusy = uploadBusy || aiBusy || saveBusy || exportBusy;

  const activeGenTask = backgroundGen.tasks.find(
    (task) =>
      task.status === "running" &&
      (task.id === DECOMPOSE_TASK_ID ||
        task.id === EDIT_TASK_ID ||
        task.id === RETOUCH_TASK_ID ||
        task.id === ERASE_TASK_ID ||
        task.id === BG_REPLACE_TASK_ID),
  );

  const generatingLabel =
    busyLabel ??
    (uploadBusy
      ? "上传至 OSS…"
      : decomposeBusy
        ? "AI 图层分离中…"
        : editBusy
          ? "AI 修改图层…"
          : retouchBusy
            ? "局部重绘中…"
            : eraseBusy
              ? "图像擦除补全中…"
              : bgReplaceBusy
                ? "换背景中…"
                : "生成中…");

  const generatingProgress: number | null | undefined = anyBusy
    ? uploadBusy
      ? null
      : activeGenTask?.expectedDurationMs
        ? estimateBackgroundGenerationProgress(
            new Date(activeGenTask.startedAt).getTime(),
            activeGenTask.expectedDurationMs,
            progressNow,
          )
        : null
    : undefined;

  const handleClearWorkingResult = useCallback(async () => {
    if (anyBusy) return;
    if (!sourcePreviewUrl && !sourceUrl && !stack) return;

    const origin = originalImageUrl?.trim() || sourceUrl?.trim() || null;
    if (!origin) {
      await clearSourceState();
      await toast({ variant: "success", title: "已清除", message: "可重新上传图片" });
      return;
    }

    const ok = await confirm({
      title: "清除操作结果？",
      message: "仅清除右侧当前图与图层，左侧原图保留。可重新擦除、重绘或拆层。",
    });
    if (!ok) return;

    setStack(null);
    setSelectedLayerId(null);
    setEditEntries([]);
    setPendingBboxes([]);
    setSourceUrl(origin.startsWith("blob:") ? sourceUrl : origin);
    setSourcePreviewUrl((prev) => {
      if (prev && prev !== origin) revokeBlobPreview(prev);
      return origin;
    });
    setCanvasToolMode("decompose-bbox");
    canvasRef.current?.clearMask();
    const img = new Image();
    img.onload = () => setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = origin;
    if (project?.id) {
      skipAutoSaveRef.current = true;
      try {
        const updated = await saveImageLayerWorkspace(project.id, {
          sourceImageUrl: origin.startsWith("blob:") ? sourceUrl : origin,
          originalImageUrl: origin.startsWith("blob:") ? originalImageUrl : origin,
          stack: null,
          pendingBboxes: [],
          canvasDims,
          selectedLayerId: null,
          editEntries: [],
        });
        setProject(updated);
      } finally {
        skipAutoSaveRef.current = false;
      }
    }
    await toast({
      variant: "success",
      title: "已清除操作结果",
      message: "右侧已恢复为原图，可重新操作",
    });
  }, [
    anyBusy,
    canvasDims,
    clearSourceState,
    confirm,
    originalImageUrl,
    project?.id,
    sourcePreviewUrl,
    sourceUrl,
    stack,
    toast,
  ]);

  const handleRemoveAll = useCallback(async () => {
    if (anyBusy) return;
    if (!sourcePreviewUrl && !sourceUrl) return;

    const ok = stack
      ? await doubleConfirm({
          title: "删除全部",
          message: "将移除左侧原图、右侧操作图及所有已拆分图层。",
          secondTitle: "确认删除全部",
          secondMessage: "此操作不可恢复，当前工作区中的原图、操作图与图层将被清除。",
          confirmLabel: "删除全部",
        })
      : await confirm({
          title: "删除全部",
          message: "移除原图与操作图并返回上传区？",
        });
    if (!ok) return;

    await clearSourceState();
    await toast({ variant: "success", title: "已删除全部", message: "可重新上传图片" });
  }, [
    anyBusy,
    clearSourceState,
    confirm,
    doubleConfirm,
    sourcePreviewUrl,
    sourceUrl,
    stack,
    toast,
  ]);

  const handleUploadError = useCallback(
    (title: string, message: string) => {
      void alert({ title, message, variant: "error" });
    },
    [alert],
  );

  const canSave = Boolean(sourceUrl || stack);

  const toolbar = (
    <ImageLayerToolbar
      projectTitle={project?.title}
      toolMode={canvasToolMode}
      decomposeBusy={decomposeBusy}
      anyBusy={anyBusy}
      saveBusy={saveBusy}
      hasPreview={Boolean(sourcePreviewUrl)}
      hasStack={Boolean(stack)}
      canSave={canSave}
      pendingBboxCount={pendingBboxes.length}
      currentProjectId={project?.id}
      loadProjectList={loadProjectList}
      onToolModeChange={handleToolModeChange}
      onUndoBbox={() => canvasRef.current?.undoLastBbox()}
      onClearBboxes={() => canvasRef.current?.clearAllBboxes()}
      onDecompose={() => void runDecompose()}
      onSave={() => setSaveDialogOpen(true)}
      layerSessionLocked={Boolean(stack) || decomposeBusy}
      onCancelLayerSession={() => void handleCancelLayerSession()}
      onNewProject={() => void handleNewProject()}
      onSelectProject={handleSelectProject}
      onReset={() => void handleRemoveAll()}
      previewBusy={exportPreviewBusy}
      onPreviewExport={() => void handlePreviewExport()}
      onExport={() => void handleExport()}
    />
  );

  if (!sessionChecked || projectLoading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[#6b7280]">
        {sessionChecked ? "正在加载项目…" : "正在检查登录状态…"}
      </div>
    );
  }

  if (needLogin) {
    return <EcomLoginPrompt returnPath="/ecom/image-layer" />;
  }

  return (
    <>
      <div className="h-full min-h-0">
      <EcomWorkspaceLayout
        assistantClassName="md:w-[480px] md:min-w-[480px] md:max-w-[480px]"
        assistant={
          <ImageLayerAssistantPanel
            toolMode={canvasToolMode}
            hasStack={Boolean(stack)}
            busy={anyBusy}
            editingLayerId={editingLayerId}
            busyTitle={generatingLabel}
            busyDetail={
              decomposeBusy
                ? "Seedream 5.0 Pro · 可能需 1～2 分钟"
                : editBusy
                  ? "改层后回到整图"
                  : retouchBusy
                    ? retouchModel
                    : eraseBusy
                      ? "图像擦除补全"
                      : bgReplaceBusy
                        ? "万相背景生成 · 可能需 1～2 分钟"
                        : uploadBusy
                          ? "正在上传原图至 OSS"
                          : undefined
            }
            selectionSubTool={selectionSubTool}
            brushSize={brushSize}
            showTransparentMask={showTransparentMask}
            pendingBboxCount={pendingBboxes.length}
            retouchModel={retouchModel}
            retouchModels={retouchModels}
            retouchModelsLoading={retouchModelsLoading}
            retouchModelsError={retouchModelsError}
            retouchParams={retouchParams}
            retouchParamFields={retouchParamFields}
            retouchPrompt={retouchPrompt}
            retouchBusy={retouchBusy}
            eraseBusy={eraseBusy}
            editEntries={editEntryViews}
            selectedLayerId={selectedLayerId}
            editSubmitCount={editSubmitCount}
            onSelectionSubToolChange={setSelectionSubTool}
            onBrushSizeChange={setBrushSize}
            onToggleTransparentMask={() => setShowTransparentMask((v) => !v)}
            onClearSelection={handleClearSelection}
            onUndoBbox={() => canvasRef.current?.undoLastBbox()}
            onRetouchModelChange={handleRetouchModelChange}
            onRetouchParamsChange={(name, value) =>
              setRetouchParams((prev) => ({ ...prev, [name]: value }))
            }
            onRetouchPromptChange={setRetouchPrompt}
            onRetouchSubmit={() => void runRetouch()}
            onEraseSubmit={() => void runErase()}
            onReloadRetouchModels={() => void loadRetouchModels()}
            onSelectLayer={(id) => handleSelectLayer(id)}
            onPromptChange={handleEditPromptChange}
            onSubmitAllEdits={() => void runEditAll()}
            onRemoveEditEntry={handleRemoveEditEntry}
            bgReplaceForm={bgReplaceForm}
            bgReplaceBusy={bgReplaceBusy}
            bgReplaceHasBase={Boolean(sourceUrl || stack)}
            bgReplaceSubjectHint="只换右边当前图，不改左边对照。成功后左边变成换之前的图。"
            onBgReplaceFormChange={setBgReplaceForm}
            onUploadBgReplaceImage={uploadBgReplaceImage}
            onBgReplaceSubmit={() => void runBackgroundReplace()}
          />
        }
        assistantHeader={
          <ImageLayerAssistantHeader
            toolMode={canvasToolMode}
            hasStack={Boolean(stack)}
          />
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          {sourcePreviewUrl ? (
            <>
              <div className="shrink-0">{toolbar}</div>
              <div className="flex min-h-0 flex-1 overflow-hidden px-3 py-3">
                <ImageLayerCompareStage
                  originalUrl={originalImageUrl ?? sourcePreviewUrl}
                  originalLabel={
                    canvasToolMode === "bg-replace" ? "换背景前" : "拆层原图"
                  }
                  resultLabel={
                    canvasToolMode === "bg-replace" ? "当前图（换背景后）" : "操作 / 结果"
                  }
                  className="h-full w-full"
                >
                  <ImageLayerCanvas
                    ref={canvasRef}
                    sourcePreviewUrl={sourcePreviewUrl}
                    background={stack?.background ?? null}
                    layers={stack?.layers ?? []}
                    selectedLayerId={selectedLayerId}
                    toolMode={
                      stack &&
                      (canvasToolMode === "decompose-bbox" ||
                        canvasToolMode === "bg-replace")
                        ? "layer-view"
                        : canvasToolMode
                    }
                    selectionSubTool={selectionSubTool}
                    retouchUsesBbox={retouchUsesBbox}
                    brushSize={brushSize}
                    showTransparentMask={showTransparentMask}
                    generating={anyBusy}
                    generatingLabel={generatingLabel}
                    generatingProgress={generatingProgress}
                    removeDisabled={anyBusy}
                    onRemoveSource={() => void handleClearWorkingResult()}
                    onSelectLayer={(id) => {
                      handleSelectLayer(id);
                      if (id && stack) setCanvasToolMode("layer-view");
                    }}
                    onLayerMove={handleLayerMove}
                    pendingBboxes={pendingBboxes}
                    onBboxesDrawn={setPendingBboxes}
                    onBboxLimitReached={() => {
                      void toast({
                        variant: "error",
                        title: `最多 ${IMAGE_LAYER_MAX_BBOXES} 个拆分框`,
                        message: "请先删除多余框或减少框选数量后再分拆。",
                      });
                    }}
                    onDisplayDimsChange={setDisplayDims}
                    className="h-full w-full"
                  />
                </ImageLayerCompareStage>
              </div>
            </>
          ) : (
            <>
              <div className="shrink-0">{toolbar}</div>
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-2 sm:px-6 sm:pb-8">
                <ImageLayerUploadZone
                  busy={anyBusy}
                  onUploadFiles={(files) => void handleUploadFiles(files)}
                  onError={handleUploadError}
                  className="min-h-0 flex-1"
                />
              </div>
            </>
          )}
        </div>
      </EcomWorkspaceLayout>
      </div>
      <ImageLayerExportPreviewDialog
        open={exportPreviewOpen}
        busy={exportPreviewBusy}
        exportBusy={exportDownloadBusy}
        previewUrl={exportPreviewUrl}
        onOpenChange={setExportPreviewOpen}
        onExport={() => void handleExportDownload()}
      />
      <ImageLayerSaveDialog
        open={saveDialogOpen}
        sourceUrl={sourceUrl}
        originalImageUrl={originalImageUrl}
        stack={stack}
        saveWorkspaceBusy={saveBusy}
        saveLibraryBusy={saveLibraryBusy}
        onOpenChange={setSaveDialogOpen}
        onSaveWorkspace={handleSaveWorkspace}
        onSaveToLibrary={handleSaveToLibrary}
      />
      <BackgroundReplaceResultDialog
        open={bgReplacePickOpen}
        imageUrls={bgReplaceCandidates}
        onCancel={() => {
          setBgReplacePickOpen(false);
          void toast({
            variant: "success",
            title: "结果已写入生成记录",
            message: "可稍后在生成记录中选用。",
          });
        }}
        onPick={(url) => void applyBgReplaceResult(url)}
      />
    </>
  );
}

export function ImageLayerStudio() {
  return (
    <BackgroundGenerationProvider>
      <ImageLayerStudioInner />
    </BackgroundGenerationProvider>
  );
}
