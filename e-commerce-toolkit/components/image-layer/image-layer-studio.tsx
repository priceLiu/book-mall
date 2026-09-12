"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  BackgroundGenerationProvider,
  useBackgroundGeneration,
} from "@/components/generation";
import { ImageLayerCanvas } from "@/components/image-layer/image-layer-canvas";
import {
  ImageLayerEditPanel,
  type ImageLayerEditEntryView,
} from "@/components/image-layer/image-layer-edit-panel";
import { ImageLayerExportPreviewDialog } from "@/components/image-layer/image-layer-export-preview-dialog";
import { ImageLayerToolbar } from "@/components/image-layer/image-layer-toolbar";
import { ImageLayerUploadZone } from "@/components/image-layer/image-layer-upload-zone";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  createImageLayerProject,
  decomposeImageLayers,
  editImageLayer,
  getImageLayerProject,
  listImageLayerProjectSummaries,
  saveImageLayerWorkspace,
  uploadImageLayerSource,
} from "@/lib/ecom-image-layer-api";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import { ensureEcomSessionFresh } from "@/lib/ecom-silent-sso";
import { fetchEcomToolsSessionLite } from "@/lib/ecom-tools-session-client";
import { estimateBackgroundGenerationProgress } from "@/lib/generation/background-generation-policy";
import {
  downloadBlob,
  exportLayerStackPng,
} from "@/lib/image-layer-export";
import type {
  ImageLayerEditEntry,
  ImageLayerProject,
  ImageLayerStack,
  ImageLayerStackItem,
  ImageLayerWorkspace,
} from "@/lib/image-layer-types";

const DECOMPOSE_TASK_ID = "image-layer-decompose";
const EDIT_TASK_ID = "image-layer-edit";
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
  stack: ImageLayerStack | null;
  pendingBbox: [number, number, number, number] | null;
  canvasDims: { w: number; h: number };
  displayDims: { w: number; h: number } | null;
  selectedLayerId: string | null;
  editEntries: ImageLayerEditEntry[];
}): ImageLayerWorkspace {
  return {
    sourceImageUrl: args.sourceUrl ?? args.stack?.sourceImageUrl ?? null,
    stack: args.stack,
    pendingBbox: args.pendingBbox,
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

  const [project, setProject] = useState<ImageLayerProject | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [stack, setStack] = useState<ImageLayerStack | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [drawBboxMode, setDrawBboxMode] = useState(false);
  const [pendingBbox, setPendingBbox] = useState<[number, number, number, number] | null>(
    null,
  );
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

  const hydrateFromProject = useCallback((p: ImageLayerProject) => {
    skipAutoSaveRef.current = true;
    const ws = p.workspace ?? {};
    const nextSource = ws.sourceImageUrl?.trim() || null;

    setSourcePreviewUrl((prev) => {
      revokeBlobPreview(prev);
      return nextSource;
    });
    setSourceUrl(nextSource);
    setStack(ws.stack ?? null);
    setPendingBbox(ws.pendingBbox ?? null);
    setSelectedLayerId(ws.selectedLayerId ?? null);
    if (ws.editEntries?.length) {
      setEditEntries(ws.editEntries);
    } else if (ws.selectedLayerId && ws.editPrompt?.trim()) {
      setEditEntries([{ layerId: ws.selectedLayerId, prompt: ws.editPrompt }]);
    } else {
      setEditEntries([]);
    }
    setDisplayDims(ws.displayDims ?? null);
    setDrawBboxMode(false);

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
    if (!uploadBusy && !decomposeBusy && !editBusy) return;
    const id = window.setInterval(() => setProgressNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [decomposeBusy, editBusy, uploadBusy]);

  const buildSnapshot = useCallback(
    (): ImageLayerWorkspace =>
      buildWorkspaceSnapshot({
        sourceUrl,
        stack,
        pendingBbox,
        canvasDims,
        displayDims,
        selectedLayerId,
        editEntries,
      }),
    [canvasDims, displayDims, editEntries, pendingBbox, selectedLayerId, sourceUrl, stack],
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
    pendingBbox,
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
    return editEntries.flatMap((entry) => {
      const layer = findLayerInStack(stack, entry.layerId);
      return layer ? [{ layer, prompt: entry.prompt }] : [];
    });
  }, [editEntries, stack]);

  const applyStack = useCallback((next: ImageLayerStack) => {
    setStack(next);
    setDrawBboxMode(false);
    setPendingBbox(null);
    setSelectedLayerId(null);
    setEditEntries([]);
  }, []);

  const clearSourceState = useCallback(async () => {
    setSourcePreviewUrl((prev) => {
      revokeBlobPreview(prev);
      return null;
    });
    setSourceUrl(null);
    setStack(null);
    setSelectedLayerId(null);
    setPendingBbox(null);
    setDrawBboxMode(false);
    setEditEntries([]);
    setDisplayDims(null);

    if (project?.id) {
      skipAutoSaveRef.current = true;
      try {
        const updated = await saveImageLayerWorkspace(project.id, {
          sourceImageUrl: null,
          stack: null,
          pendingBbox: null,
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
      setPendingBbox(null);
      setDrawBboxMode(false);
      setSourceUrl(null);

      const preview = URL.createObjectURL(file);
      setSourcePreviewUrl((prev) => {
        revokeBlobPreview(prev);
        return preview;
      });
      const img = new Image();
      img.onload = () => setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = preview;

      setUploadBusy(true);
      setBusyLabel("上传至 OSS…");
      setNeedLogin(false);
      try {
        const { ossUrl } = await uploadImageLayerSource(file, project.id);
        setSourceUrl(ossUrl);
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

  const resolveOssSourceUrl = useCallback(async (): Promise<string> => {
    if (sourceUrl?.trim()) return sourceUrl.trim();
    throw new Error("请先上传图片");
  }, [sourceUrl]);

  const runDecompose = useCallback(async () => {
    if (!sourcePreviewUrl && !sourceUrl) {
      await alert({
        title: "请先上传图片",
        message: "选择 png/jpeg 成品图后，点击「AI 图层分离」。",
        variant: "error",
      });
      return;
    }
    if (!(await ensureSessionForAi())) return;
    if (!project?.id) return;

    setDecomposeBusy(true);
    setBusyLabel("AI 图层分离中…");
    setNeedLogin(false);

    const taskId = DECOMPOSE_TASK_ID;

    try {
      backgroundGen.registerTask({
        id: taskId,
        label: "AI 图层分离",
        hint: "Seedream 5.0 Pro · 可能需 1～2 分钟",
        startedAt: new Date().toISOString(),
        expectedDurationMs: 120_000,
        poll: async () => ({ status: "running" as const }),
      });

      const ossUrl = await resolveOssSourceUrl();
      const result = await decomposeImageLayers({
        sourceImageUrl: ossUrl,
        projectId: project.id,
        ...(pendingBbox ? { bboxes: [pendingBbox] } : {}),
      });
      applyStack(result);
      const updated = await getImageLayerProject(project.id);
      setProject(updated);
      backgroundGen.dismissTask(taskId);
      await toast({
        variant: "success",
        title: "图层分离完成",
        message:
          "正常情况底图应已补全被拆出的人物/物体。若仍看到重复主体，请重置后用「绘制拆分框」框住主体再拆分。",
      });
    } catch (e) {
      backgroundGen.failTask(
        taskId,
        e instanceof Error ? e.message : "图层分离失败",
      );
      if (isEcomUnauthorizedError(e)) {
        setNeedLogin(true);
        return;
      }
      await alert({
        title: "图层分离失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setDecomposeBusy(false);
      setBusyLabel(null);
    }
  }, [
    alert,
    applyStack,
    backgroundGen,
    ensureSessionForAi,
    pendingBbox,
    project?.id,
    resolveOssSourceUrl,
    sourcePreviewUrl,
    sourceUrl,
    toast,
  ]);

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
    setEditEntries((prev) =>
      prev.map((e) => (e.layerId === layerId ? { ...e, prompt: value } : e)),
    );
  }, []);

  const handleRemoveEditEntry = useCallback((layerId: string) => {
    setEditEntries((prev) => prev.filter((e) => e.layerId !== layerId));
    setSelectedLayerId((prev) => (prev === layerId ? null : prev));
  }, []);

  const runEdit = useCallback(
    async (layerId: string) => {
      if (!stack || !project?.id) return;
      const layer = findLayerInStack(stack, layerId);
      const entry = editEntries.find((e) => e.layerId === layerId);
      if (!layer || layer.isBackground || !entry?.prompt.trim()) return;

      const bbox = layer.bbox?.normalized;
      if (!bbox) {
        await alert({
          title: "无法改层",
          message: "该图层缺少 bbox 坐标，请重新拆分后再试",
          variant: "error",
        });
        return;
      }
      const compositeImageUrl =
        stack.sourceImageUrl ?? stack.background.url ?? sourceUrl ?? "";
      if (!compositeImageUrl) return;

      if (!(await ensureSessionForAi())) return;

      setEditBusy(true);
      setEditingLayerId(layerId);
      setBusyLabel("AI 修改本层…");
      setNeedLogin(false);
      const taskId = EDIT_TASK_ID;

      try {
        backgroundGen.registerTask({
          id: taskId,
          label: "AI 修改本层",
          hint: "编辑后将重新拆分图层",
          startedAt: new Date().toISOString(),
          expectedDurationMs: 180_000,
          poll: async () => ({ status: "running" as const }),
        });

        const result = await editImageLayer({
          compositeImageUrl,
          bbox,
          prompt: entry.prompt.trim(),
          projectId: project.id,
        });
        applyStack(result);
        const updated = await getImageLayerProject(project.id);
        setProject(updated);
        backgroundGen.dismissTask(taskId);
        await toast({ variant: "success", title: "图层已更新" });
      } catch (e) {
        backgroundGen.failTask(taskId, e instanceof Error ? e.message : "改层失败");
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
          return;
        }
        await alert({
          title: "改层失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setEditBusy(false);
        setEditingLayerId(null);
        setBusyLabel(null);
      }
    },
    [
      alert,
      applyStack,
      backgroundGen,
      editEntries,
      ensureSessionForAi,
      project?.id,
      sourceUrl,
      stack,
      toast,
    ],
  );

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

  const handleSave = useCallback(async () => {
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
    } finally {
      setSaveBusy(false);
    }
  }, [alert, persistWorkspace, project?.id, toast]);

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

  const aiBusy = decomposeBusy || editBusy;
  const exportBusy = exportPreviewBusy || exportDownloadBusy;
  const anyBusy = uploadBusy || aiBusy || saveBusy || exportBusy;

  const activeGenTask = backgroundGen.tasks.find(
    (task) =>
      task.status === "running" &&
      (task.id === DECOMPOSE_TASK_ID || task.id === EDIT_TASK_ID),
  );

  const generatingLabel =
    busyLabel ??
    (uploadBusy
      ? "上传至 OSS…"
      : decomposeBusy
        ? "AI 图层分离中…"
        : editBusy
          ? "AI 修改本层…"
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

  const handleRemoveSource = useCallback(async () => {
    if (anyBusy) return;
    if (!sourcePreviewUrl && !sourceUrl) return;

    const ok = stack
      ? await doubleConfirm({
          title: "删除图片",
          message: "将移除当前图片及所有已拆分图层。",
          secondTitle: "确认删除",
          secondMessage: "此操作不可恢复，已拆分的图层将一并清除。",
          confirmLabel: "删除",
        })
      : await confirm({
          title: "删除图片",
          message: "移除当前图片并返回上传区？",
        });
    if (!ok) return;

    await clearSourceState();
    await toast({ variant: "success", title: "已删除", message: "可重新上传图片" });
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

  const handleReset = useCallback(async () => {
    if (anyBusy) return;
    if (!sourcePreviewUrl && !stack) return;

    const ok = stack
      ? await doubleConfirm({
          title: "重置工作区",
          message: "将清空当前图片、图层与编辑状态。",
          secondTitle: "确认重置",
          secondMessage: "此操作不可恢复。",
          confirmLabel: "重置",
        })
      : await confirm({
          title: "重置工作区",
          message: "清空当前图片并返回上传区？",
        });
    if (!ok) return;
    await clearSourceState();
  }, [anyBusy, clearSourceState, confirm, doubleConfirm, sourcePreviewUrl, stack]);

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
      decomposeBusy={decomposeBusy}
      anyBusy={anyBusy}
      saveBusy={saveBusy}
      hasPreview={Boolean(sourcePreviewUrl)}
      hasStack={Boolean(stack)}
      canSave={canSave}
      drawBboxMode={drawBboxMode}
      currentProjectId={project?.id}
      loadProjectList={loadProjectList}
      onToggleDrawBbox={() => setDrawBboxMode((v) => !v)}
      onDecompose={() => void runDecompose()}
      onSave={() => void handleSave()}
      onNewProject={() => void handleNewProject()}
      onSelectProject={handleSelectProject}
      onRemoveSource={() => void handleRemoveSource()}
      onReset={() => void handleReset()}
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
      <EcomWorkspaceLayout
        assistant={
          <ImageLayerEditPanel
            entries={editEntryViews}
            busy={anyBusy}
            editingLayerId={editingLayerId}
            busyTitle={generatingLabel}
            busyDetail={
              decomposeBusy
                ? "Seedream 5.0 Pro · 可能需 1～2 分钟"
                : editBusy
                  ? "编辑后将重新拆分图层"
                  : uploadBusy
                    ? "正在上传原图至 OSS"
                    : undefined
            }
            onPromptChange={handleEditPromptChange}
            onEdit={(layerId) => void runEdit(layerId)}
            onRemove={handleRemoveEditEntry}
          />
        }
        assistantHeader={
          <div className="border-b border-[#e5e7eb] px-4 py-3">
            <h1 className="text-base font-semibold text-[#111827]">图片分层</h1>
            <p className="text-xs text-[#6b7280]">
              上传图片 → 可选绘制拆分框 → 手动点击「AI 图层分离」
            </p>
          </div>
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          {sourcePreviewUrl ? (
            <div className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
              {toolbar}
              <ImageLayerCanvas
                sourcePreviewUrl={sourcePreviewUrl}
                background={stack?.background ?? null}
                layers={stack?.layers ?? []}
                selectedLayerId={selectedLayerId}
                drawBboxMode={drawBboxMode && !stack}
                generating={anyBusy}
                generatingLabel={generatingLabel}
                generatingProgress={generatingProgress}
                removeDisabled={anyBusy}
                onRemoveSource={() => void handleRemoveSource()}
                onSelectLayer={handleSelectLayer}
                onLayerMove={handleLayerMove}
                onBboxDrawn={setPendingBbox}
                onDisplayDimsChange={setDisplayDims}
                className="w-full px-4 pb-6 pt-2"
              />
            </div>
          ) : (
            <>
              <div className="shrink-0">{toolbar}</div>
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-10 pt-4">
                <ImageLayerUploadZone
                  busy={anyBusy}
                  onUploadFiles={(files) => void handleUploadFiles(files)}
                  onError={handleUploadError}
                  className="w-full max-w-3xl min-h-[400px]"
                />
              </div>
            </>
          )}
        </div>
      </EcomWorkspaceLayout>
      <ImageLayerExportPreviewDialog
        open={exportPreviewOpen}
        busy={exportPreviewBusy}
        exportBusy={exportDownloadBusy}
        previewUrl={exportPreviewUrl}
        onOpenChange={setExportPreviewOpen}
        onExport={() => void handleExportDownload()}
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
