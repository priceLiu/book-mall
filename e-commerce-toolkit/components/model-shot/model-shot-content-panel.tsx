"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Download,
  Images,
  LayoutGrid,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { createPortal } from "react-dom";

import { useBackgroundGeneration } from "@/components/generation";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { ModelShotPoseMediaStrip } from "@/components/model-shot/model-shot-pose-media-strip";
import { ModelShotSaveDialog } from "@/components/model-shot/model-shot-save-dialog";
import {
  ModelShotPosePlanTable,
  type PoseItemPatch,
} from "@/components/model-shot/model-shot-pose-plan-table";
import { ModelShotRefUploader } from "@/components/model-shot/model-shot-ref-uploader";
import {
  EcomImagePreviewHost,
  useEcomImagePreview,
  buildModelShotPosePreviewItems,
} from "@/components/media";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomIconButton, EcomIconButtonLink, EcomShareIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  attachModelShotReference,
  confirmModelShotPlan,
  generateModelShotImages,
  generateModelShotPosePlan,
  generateModelShotReference,
  getModelShotProject,
  downloadModelShotExportZip,
  patchModelShotPoseItem,
  saveModelShotDeliverableSnapshot,
  updateModelShotProject,
  uploadModelShotReference,
} from "@/lib/ecom-model-shot-api";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { ModelShotProject, ModelShotReferenceRole } from "@/lib/model-shot-types";
import type { ModelShotUploadRole } from "@/components/model-shot/model-shot-ref-uploader";
import { hasGarmentReference } from "@/lib/model-shot-types";
import {
  buildModelShotPendingMetaPatch,
  earliestModelShotPendingStartedAt,
  listModelShotPendingPoseIndices,
  listOrphanModelShotPendingPoseIndices,
  modelShotImageDockTaskId,
  modelShotTargetIndexesGainedImages,
  modelShotTargetIndexesHaveImages,
  readModelShotPendingPoseImages,
  resolveActiveModelShotPoseBusyIndexes,
} from "@/lib/model-shot-pending-poses";
import { modelShotPoseHasGeneratedImage, resolveModelShotActiveImage } from "@/lib/model-shot-pose-images";
import { inferModelShotPhase } from "@/lib/model-shot-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: ModelShotProject;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  onImageModelChange: (key: string) => void;
  modelsLoading?: boolean;
  modelsLoadError?: string | null;
  onRefreshModels?: () => void | Promise<void>;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onDeleteProject?: () => void | Promise<void>;
  onProjectChange: (next?: ModelShotProject) => void | Promise<void>;
  onRefGenBusyRoleChange?: (role: ModelShotReferenceRole | null) => void;
  streaming?: boolean;
  generateRequestToken?: number;
  imagePickerOpen?: boolean;
  onRequestImagePicker?: (opts: {
    poseIndex?: number;
    batchIndexes?: number[];
  }) => void;
  onRegisterImageGenerate?: (
    handler: (modelKey: string, indexes: number[], imageSize?: string) => void,
  ) => void;
  onShareWorkflow?: () => void;
};

export function ModelShotContentPanel({
  project,
  imageModels,
  imageModelKey,
  onImageModelChange,
  modelsLoading = false,
  modelsLoadError = null,
  onRefreshModels,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onDeleteProject,
  onProjectChange,
  onRefGenBusyRoleChange,
  streaming,
  generateRequestToken = 0,
  imagePickerOpen = false,
  onRequestImagePicker,
  onRegisterImageGenerate,
  onShareWorkflow,
}: Props) {
  const { alert, doubleConfirm, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const poseImagePreviewItems = useMemo(
    () => buildModelShotPosePreviewItems(project.plan.items),
    [project.plan.items],
  );
  const {
    preview,
    openPreview: openPoseImagePreview,
    closePreview,
  } = useEcomImagePreview(poseImagePreviewItems);
  const [refBusy, setRefBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingRole, setUploadingRole] = useState<ModelShotReferenceRole | null>(null);
  const [uploadRole, setUploadRole] = useState<ModelShotUploadRole>("garment");
  const [refGenBusyRole, setRefGenBusyRole] = useState<ModelShotReferenceRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPoseIndexes, setSelectedPoseIndexes] = useState<Set<number>>(() => new Set());
  const [activeGenPoseIndexes, setActiveGenPoseIndexes] = useState<Set<number>>(() => new Set());
  const [posePromptPreview, setPosePromptPreview] = useState<{
    title: string;
    prompt: string;
  } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const imageGenInFlightCountRef = useRef(0);
  const imageGenWatchRef = useRef<number[]>([]);
  const imageGenPollLockRef = useRef(false);

  const pendingPoseIndices = useMemo(
    () => listModelShotPendingPoseIndices(project.meta),
    [project.meta],
  );

  const canSave = useMemo(
    () => hasGarmentReference(project.references) && project.plan.items.length > 0,
    [project.plan.items.length, project.references],
  );

  const reconcilePoseImageGenBusy = useCallback((source: ModelShotProject) => {
    const pending = listModelShotPendingPoseIndices(source.meta);
    imageGenWatchRef.current = imageGenWatchRef.current.filter((idx) => {
      if (pending.includes(idx)) return true;
      const item = source.plan.items.find((row) => row.index === idx);
      return item ? !modelShotPoseHasGeneratedImage(item) : true;
    });
    const active = resolveActiveModelShotPoseBusyIndexes({
      pendingIndices: pending,
      localWatchIndices: imageGenWatchRef.current,
      items: source.plan.items,
    });
    setActiveGenPoseIndexes(new Set(active));
  }, []);

  const beginPoseImageGenWatch = useCallback(
    (indexes: number[]) => {
      imageGenInFlightCountRef.current += 1;
      imageGenWatchRef.current = [
        ...new Set([...imageGenWatchRef.current, ...indexes]),
      ].sort((a, b) => a - b);
      reconcilePoseImageGenBusy(project);
    },
    [project, reconcilePoseImageGenBusy],
  );

  const endPoseImageGenWatch = useCallback(
    (indexes: number[], fresh?: ModelShotProject) => {
      imageGenInFlightCountRef.current = Math.max(
        0,
        imageGenInFlightCountRef.current - 1,
      );
      imageGenWatchRef.current = imageGenWatchRef.current.filter(
        (idx) => !indexes.includes(idx),
      );
      reconcilePoseImageGenBusy(fresh ?? project);
    },
    [project, reconcilePoseImageGenBusy],
  );

  const clearStalePosePendingIfNeeded = useCallback(
    async (input: ModelShotProject): Promise<ModelShotProject> => {
      let fresh = input;
      try {
        fresh = await getModelShotProject(input.id);
      } catch {
        /* 沿用本地快照 */
      }
      const orphanIndices = listOrphanModelShotPendingPoseIndices(
        fresh.meta,
        fresh.plan.items,
        {
          localInFlight: imageGenInFlightCountRef.current > 0,
          localWatchIndices: imageGenWatchRef.current,
        },
      );
      if (orphanIndices.length === 0) return fresh;
      await updateModelShotProject(fresh.id, {
        meta: buildModelShotPendingMetaPatch(fresh, orphanIndices),
      });
      try {
        return await getModelShotProject(fresh.id);
      } catch {
        return fresh;
      }
    },
    [],
  );

  const syncGeneratingPoseImages = useCallback(async () => {
    if (imageGenPollLockRef.current) return;
    imageGenPollLockRef.current = true;
    try {
      let fresh = await getModelShotProject(project.id);
      fresh = await clearStalePosePendingIfNeeded(fresh);
      await onProjectChange(fresh);
      reconcilePoseImageGenBusy(fresh);
    } catch {
      /* 轮询 transient 失败忽略 */
    } finally {
      imageGenPollLockRef.current = false;
    }
  }, [clearStalePosePendingIfNeeded, onProjectChange, project.id, reconcilePoseImageGenBusy]);

  useEffect(() => {
    imageGenInFlightCountRef.current = 0;
    imageGenWatchRef.current = [];
    reconcilePoseImageGenBusy(project);
    void syncGeneratingPoseImages();
    // 切换项目时恢复服务端 pending，勿把 sync 放入 deps（会循环）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    reconcilePoseImageGenBusy(project);
    void clearStalePosePendingIfNeeded(project).then((updated) => {
      if (updated.updatedAt !== project.updatedAt) {
        reconcilePoseImageGenBusy(updated);
      }
    });
  }, [
    clearStalePosePendingIfNeeded,
    project.id,
    project.updatedAt,
    reconcilePoseImageGenBusy,
  ]);

  useEffect(() => {
    if (pendingPoseIndices.length === 0 && activeGenPoseIndexes.size === 0) return;
    void syncGeneratingPoseImages();
    const timer = window.setInterval(() => {
      void syncGeneratingPoseImages();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [
    activeGenPoseIndexes.size,
    pendingPoseIndices.length,
    syncGeneratingPoseImages,
  ]);

  useEffect(() => {
    if (pendingPoseIndices.length === 0) return;
    // 当前会话已由 startBackgroundGenerate 登记，避免与 refresh-restore 重复一行
    if (imageGenInFlightCountRef.current > 0) return;

    const taskId = modelShotImageDockTaskId(project.id);
    if (backgroundGen.tasks.some((t) => t.id === taskId && t.status === "running")) {
      return;
    }

    const hintEntry = readModelShotPendingPoseImages(project.meta)[String(pendingPoseIndices[0])];
    backgroundGen.registerTask({
      id: taskId,
      label:
        pendingPoseIndices.length === 1
          ? `生成模特图 · 姿势 ${pendingPoseIndices[0]}`
          : `生成模特图 · ${pendingPoseIndices.length} 张`,
      hint: hintEntry?.modelKey,
      startedAt: earliestModelShotPendingStartedAt(project.meta, pendingPoseIndices),
      expectedDurationMs: pendingPoseIndices.length * 120_000,
      status: "running",
      poll: async () => {
        const fresh = await getModelShotProject(project.id);
        const still = listModelShotPendingPoseIndices(fresh.meta);
        if (still.length > 0) return { status: "running" as const };
        const hadNewImages = modelShotTargetIndexesGainedImages(
          project.plan.items,
          fresh.plan.items,
          pendingPoseIndices,
        );
        if (!hadNewImages && !modelShotTargetIndexesHaveImages(fresh.plan.items, pendingPoseIndices)) {
          return {
            status: "failed" as const,
            error: "生成未产出新图片，请重试",
          };
        }
        return { status: "succeeded" as const };
      },
      onSucceeded: async () => {
        const fresh = await getModelShotProject(project.id);
        await onProjectChange(fresh);
        reconcilePoseImageGenBusy(fresh);
        toast({
          title: "模特图已生成",
          message: "后台任务已完成，结果已同步至中栏。",
          variant: "success",
        });
      },
    });
  }, [
    backgroundGen,
    backgroundGen.tasks,
    onProjectChange,
    pendingPoseIndices,
    project.id,
    project.meta,
    project.plan.items,
    reconcilePoseImageGenBusy,
    toast,
  ]);

  const planConfirmed = project.plan.status === "confirmed";

  const phase = inferModelShotPhase(project);
  const canGeneratePoses =
    hasGarmentReference(project.references) && (project.brief?.styles?.length ?? 0) > 0;

  const handleRefUpload = useCallback(
    async (file: File, opts: { label: string; role: ModelShotReferenceRole }) => {
      setRefBusy(true);
      setUploadingRole(opts.role);
      setUploadProgress(10);
      const tick = window.setInterval(() => {
        setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
      }, 180);
      try {
        await uploadModelShotReference(project.id, file, {
          role: opts.role,
          source: "upload",
          label: opts.label,
        });
        await onProjectChange();
        setUploadProgress(100);
      } catch (e) {
        await alert({
          title: "上传失败",
          message: e instanceof Error ? e.message : "无法上传",
          variant: "error",
        });
      } finally {
        window.clearInterval(tick);
        setRefBusy(false);
        setUploadingRole(null);
        window.setTimeout(() => setUploadProgress(null), 450);
      }
    },
    [alert, onProjectChange, project.id],
  );

  const handleRefRemove = useCallback(
    async (refId: string) => {
      const ref = project.references.find((r) => r.id === refId);
      if (!ref) return;
      const roleLabel =
        ref.role === "garment"
          ? "服装"
          : ref.role === "model"
            ? "模特"
            : ref.role === "scene"
              ? "场景"
              : "道具";
      const ok = await doubleConfirm({
        title: `删除${roleLabel}参考`,
        message: `确定从本项目移除这条${roleLabel}参考？`,
        secondTitle: "不可恢复",
        secondMessage: "移除后需重新上传；已上传文件仍保留在云端存储（OSS）。",
        confirmLabel: "删除",
      });
      if (!ok) return;
      setRefBusy(true);
      try {
        const refs = project.references.filter((r) => r.id !== refId);
        await updateModelShotProject(project.id, { references: refs });
        await onProjectChange();
      } catch (e) {
        await alert({
          title: "删除失败",
          message: e instanceof Error ? e.message : "无法删除",
          variant: "error",
        });
      } finally {
        setRefBusy(false);
      }
    },
    [alert, doubleConfirm, onProjectChange, project.id, project.references],
  );

  const handleAttachAssets = useCallback(
    async (role: ModelShotReferenceRole, assetIds: string[]) => {
      setRefBusy(true);
      try {
        await attachModelShotReference(project.id, { role, assetIds });
        await onProjectChange();
      } catch (e) {
        await alert({
          title: "添加失败",
          message: e instanceof Error ? e.message : "无法从资产添加",
          variant: "error",
        });
      } finally {
        setRefBusy(false);
      }
    },
    [alert, onProjectChange, project.id],
  );

  const handleAttachModel = useCallback(
    async (entry: { id: string; name: string; ossUrl: string }) => {
      setRefBusy(true);
      try {
        await attachModelShotReference(project.id, { role: "model", modelEntry: entry });
        await onProjectChange();
      } catch (e) {
        await alert({
          title: "选择失败",
          message: e instanceof Error ? e.message : "无法绑定模特",
          variant: "error",
        });
      } finally {
        setRefBusy(false);
      }
    },
    [alert, onProjectChange, project.id],
  );

  const handleGenerateRef = useCallback(
    async (
      role: Exclude<ModelShotReferenceRole, "garment">,
      opts: { prompt: string; modelKey: string },
    ) => {
      setRefGenBusyRole(role);
      onRefGenBusyRoleChange?.(role);
      try {
        await generateModelShotReference(project.id, {
          role,
          prompt: opts.prompt,
          modelKey: opts.modelKey,
        });
        onImageModelChange(opts.modelKey);
        await onProjectChange();
      } catch (e) {
        await alert({
          title: "AI 生成失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setRefGenBusyRole(null);
        onRefGenBusyRoleChange?.(null);
      }
    },
    [alert, onImageModelChange, onProjectChange, onRefGenBusyRoleChange, project.id],
  );

  const handleSkipScene = useCallback(async () => {
    setRefBusy(true);
    try {
      await attachModelShotReference(project.id, {
        reference: {
          id: `scene-skip-${Date.now()}`,
          role: "scene",
          source: "none",
          name: "跳过场景",
        },
      });
      await onProjectChange();
    } catch (e) {
      await alert({
        title: "操作失败",
        message: e instanceof Error ? e.message : "无法跳过场景",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }, [alert, onProjectChange, project.id]);

  const openImagePicker = useCallback(
    (poseIndex?: number, batchIndexes?: number[]) => {
      if (!planConfirmed || !onRequestImagePicker) return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onRequestImagePicker({
        poseIndex,
        batchIndexes: batchIndexes && batchIndexes.length > 0 ? batchIndexes : undefined,
      });
    },
    [onRequestImagePicker, planConfirmed],
  );

  const togglePoseSelect = useCallback((index: number) => {
    setSelectedPoseIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const startBackgroundGenerate = useCallback(
    async (modelKey: string, indexes?: number[], imageSize?: string) => {
      const targetIndexes =
        indexes?.length && indexes.length > 0
          ? indexes
          : project.plan.items.map((i) => i.index);
      const taskId = modelShotImageDockTaskId(project.id);
      const startedAt = new Date().toISOString();
      let settled = false;
      let result: Awaited<ReturnType<typeof generateModelShotImages>> | null = null;
      let fetchError: string | null = null;

      const resolvePoll = (): { status: "succeeded" } | { status: "failed"; error: string } => {
        if (!result) {
          return {
            status: "failed",
            error: fetchError ?? "生成失败",
          };
        }
        const failures = result.failures ?? [];
        const generated = result.generated ?? 0;
        const hasImages = modelShotTargetIndexesHaveImages(
          result.project.plan.items,
          targetIndexes,
        );
        if (hasImages) {
          return { status: "succeeded" };
        }
        if (generated > 0) {
          return {
            status: "failed",
            error: "部分姿势图未写入方案，请刷新页面；若仍缺失请重试对应姿势",
          };
        }
        if (failures.length > 0) {
          return { status: "failed", error: failures.join("；") };
        }
        return {
          status: "failed",
          error: "未生成任何图片，请检查参考图、姿势 Prompt 与 Gateway 凭证",
        };
      };

      const openGeneratedWork = () => {
        if (!result) return;
        document
          .getElementById("model-shot-pose-media-strip")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        const readyIndexes = targetIndexes.filter((idx) => {
          const item = result!.project.plan.items.find((i) => i.index === idx);
          return item ? modelShotPoseHasGeneratedImage(item) : false;
        });
        const focusIndex = readyIndexes[0] ?? targetIndexes[0];
        if (focusIndex == null) return;
        const item = result.project.plan.items.find((i) => i.index === focusIndex);
        const active = item ? resolveModelShotActiveImage(item) : null;
        if (active?.url?.trim()) {
          openPoseImagePreview(active.url, item!.title ?? `姿势 ${focusIndex}`);
        }
      };

      const releaseInflight = (indexes: number[], fresh?: ModelShotProject) => {
        endPoseImageGenWatch(indexes, fresh);
      };

      beginPoseImageGenWatch(targetIndexes);

      setSelectedPoseIndexes((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        let changed = false;
        for (const idx of targetIndexes) {
          if (next.delete(idx)) changed = true;
        }
        return changed ? next : prev;
      });

      void generateModelShotImages({
        projectId: project.id,
        modelKey,
        indexes: targetIndexes,
        imageSize,
      })
        .then((r) => {
          result = r;
          settled = true;
        })
        .catch((e) => {
          settled = true;
          fetchError =
            e instanceof Error ? e.message : "模特图生成失败，请稍后重试";
          void alert({
            title: "生成失败",
            message: fetchError,
            variant: "error",
          });
        })
        .finally(() => {
          releaseInflight(targetIndexes, result?.project);
        });

      backgroundGen.registerTask({
        id: taskId,
        status: "running",
        minimized: false,
        label:
          targetIndexes.length === 1
            ? `生成模特图 · 姿势 ${targetIndexes[0]}`
            : `生成模特图 · ${targetIndexes.length} 张`,
        hint: modelKey,
        startedAt,
        expectedDurationMs: targetIndexes.length * 120_000,
        poll: async () => {
          if (!settled) return { status: "running" as const };
          return resolvePoll();
        },
        onSucceeded: async () => {
          let freshProject: ModelShotProject | undefined;
          try {
            freshProject = await getModelShotProject(project.id);
          } catch {
            freshProject = result?.project;
          }
          if (freshProject) {
            await onProjectChange(freshProject);
            reconcilePoseImageGenBusy(freshProject);
          } else {
            await onProjectChange();
          }
          const ready =
            freshProject != null &&
            modelShotTargetIndexesHaveImages(freshProject.plan.items, targetIndexes);
          if (!ready) return;
          toast({
            title: "模特图已生成",
            message: `成功 ${result?.generated ?? targetIndexes.length} 张，已保存至「我的资产」。`,
            variant: "success",
          });
        },
        openLabel: "打开作品",
        onOpen: openGeneratedWork,
        onFailed: () => {
          releaseInflight(targetIndexes);
        },
      });
    },
    [
      backgroundGen,
      alert,
      beginPoseImageGenWatch,
      endPoseImageGenWatch,
      onProjectChange,
      openPoseImagePreview,
      project.id,
      project.plan.items,
      toast,
    ],
  );

  useEffect(() => {
    onRegisterImageGenerate?.((modelKey, indexes, imageSize) => {
      void startBackgroundGenerate(modelKey, indexes, imageSize);
    });
  }, [onRegisterImageGenerate, startBackgroundGenerate]);

  const handleGeneratePoses = useCallback(async () => {
    setBusy(true);
    try {
      await generateModelShotPosePlan(project.id);
      await onProjectChange();
    } catch (e) {
      await alert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "无法生成姿势方案",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [alert, onProjectChange, project.id]);

  const handleConfirmPlan = useCallback(async () => {
    setBusy(true);
    try {
      await confirmModelShotPlan(project.id);
      await onProjectChange();
    } catch (e) {
      await alert({
        title: "确认失败",
        message: e instanceof Error ? e.message : "无法确认计划",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [alert, onProjectChange, project.id]);

  const defaultSceneLabel = useMemo(() => {
    const sceneRef = project.references.find((r) => r.role === "scene");
    if (!sceneRef) return null;
    if (sceneRef.source === "none") return "跳过场景";
    return sceneRef.name?.trim() || "已设场景";
  }, [project.references]);

  const handleExportZip = useCallback(async () => {
    setExportBusy(true);
    try {
      await downloadModelShotExportZip(project.id);
      toast({
        title: "导出完成",
        message: "交付包已下载到本地。",
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setExportBusy(false);
    }
  }, [alert, project.id, toast]);

  const handleSaveWorkflow = useCallback(
    async (workName: string) => {
      setSaveBusy(true);
      try {
        const { project: refreshed } = await saveModelShotDeliverableSnapshot(project.id, workName);
        await onProjectChange(refreshed);
        setSaveDialogOpen(false);
        toast({
          title: "已保存到资产库",
          message: "可在「我的资产 → 服装模特图 → 工作流」一键复用。",
          variant: "success",
        });
      } catch (e) {
        await alert({
          title: "保存失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setSaveBusy(false);
      }
    },
    [alert, onProjectChange, project.id, toast],
  );

  const handlePatchItem = useCallback(
    async (index: number, patch: PoseItemPatch) => {
      setBusy(true);
      try {
        await patchModelShotPoseItem(project.id, index, patch);
        await onProjectChange();
      } finally {
        setBusy(false);
      }
    },
    [onProjectChange, project.id],
  );

  const requestPoseImageGenerate = useCallback(
    (poseIndex?: number, batchIndexes?: number[]) => {
      if (poseIndex != null) {
        setActiveGenPoseIndexes((prev) => {
          if (!prev.has(poseIndex)) return prev;
          const next = new Set(prev);
          next.delete(poseIndex);
          return next;
        });
      }
      openImagePicker(poseIndex, batchIndexes);
    },
    [openImagePicker],
  );

  useEffect(() => {
    if (!generateRequestToken || !planConfirmed) return;
    openImagePicker();
  }, [generateRequestToken, openImagePicker, planConfirmed]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div
        className={cn(
          "ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]",
          imagePickerOpen && "pointer-events-none",
        )}
        aria-hidden={imagePickerOpen || undefined}
      >
        <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {project.title?.trim() || "服装模特图"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">阶段：{phase}</p>
            </div>
            <EcomIconToolbar>
              <EcomIconToolbarGroup label="项目">
                {onNewProject ? (
                  <EcomIconButton
                    label="新建项目"
                    icon={Plus}
                    disabled={busy}
                    onClick={() => void onNewProject()}
                  />
                ) : null}
                {loadProjectList && onOpenProject ? (
                  <EcomProjectListButton
                    currentProjectId={project.id}
                    loadProjects={loadProjectList}
                    onSelectProject={onOpenProject}
                    title="服装模特图 · 项目列表"
                    emptyHint="还没有保存过的服装模特图项目。"
                    disabled={streaming || refBusy || busy}
                  />
                ) : null}
                {onDeleteProject ? (
                  <EcomIconButton
                    label="删除项目"
                    icon={Trash2}
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void onDeleteProject()}
                  />
                ) : null}
              </EcomIconToolbarGroup>
              <EcomIconToolbarGroup label="工作流">
                <EcomIconButtonLink label="暂存工作流" icon={Archive} href="/workflows/drafts" disabled={busy} />
                <EcomIconButton
                  label="保存工作流"
                  icon={Save}
                  busy={saveBusy}
                  disabled={!canSave || saveBusy || busy}
                  onClick={() => setSaveDialogOpen(true)}
                />
              </EcomIconToolbarGroup>
              <EcomIconToolbarGroup label="资产与库">
                <EcomIconButtonLink label="我的资产" icon={Images} href="/library" disabled={busy} />
                <EcomIconButtonLink
                  label="姿势 · 场景 · 道具库"
                  icon={LayoutGrid}
                  href="/ecom/shoot-catalog"
                  disabled={busy}
                />
              </EcomIconToolbarGroup>
              <EcomIconToolbarGroup label="交付">
                <EcomIconButton
                  label={exportBusy ? "打包中…" : "导出交付包"}
                  icon={Download}
                  busy={exportBusy}
                  disabled={!canSave || exportBusy || busy}
                  onClick={() => void handleExportZip()}
                />
              </EcomIconToolbarGroup>
              {onShareWorkflow ? (
                <EcomIconToolbarGroup label="分享">
                  <EcomShareIconButton disabled={busy} onClick={onShareWorkflow} />
                </EcomIconToolbarGroup>
              ) : null}
            </EcomIconToolbar>
          </div>
        </header>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <ModelShotRefUploader
            references={project.references}
            onUpload={handleRefUpload}
            onRemove={handleRefRemove}
            onAttachAssets={handleAttachAssets}
            onAttachModelFromLibrary={handleAttachModel}
            onGenerateRef={handleGenerateRef}
            onSkipScene={handleSkipScene}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            modelsLoading={modelsLoading}
            modelsLoadError={modelsLoadError}
            onRetryLoadModels={onRefreshModels}
            imageGenPickerOpen={imagePickerOpen}
            genBusyRole={refGenBusyRole}
            busy={refBusy || busy}
            uploadingRole={uploadingRole}
            uploadProgress={uploadProgress}
            activeRole={uploadRole}
            onActiveRoleChange={setUploadRole}
          />
        </section>

        <div className="space-y-8 px-5 py-4 md:py-6">
          {project.plan.items.length > 0 ? (
            <ModelShotPosePlanTable
              plan={project.plan}
              defaultSceneLabel={defaultSceneLabel}
              onPatchItem={handlePatchItem}
              onConfirmPlan={handleConfirmPlan}
              onGeneratePoses={handleGeneratePoses}
              busy={busy || refBusy}
              canGeneratePoses={canGeneratePoses}
              confirmed={planConfirmed}
            />
          ) : null}

          {planConfirmed && project.plan.items.length > 0 ? (
            <ModelShotPoseMediaStrip
              projectId={project.id}
              items={project.plan.items}
              selectedIndexes={selectedPoseIndexes}
              onToggleSelect={togglePoseSelect}
              activeGenIndexes={activeGenPoseIndexes}
              onGenerateAll={(indexes) => requestPoseImageGenerate(undefined, indexes)}
              onGenerateOne={(index) => requestPoseImageGenerate(index)}
              onProjectChange={() => onProjectChange()}
              onGenerateAllBlocked={() => {
                toast({
                  title: "暂无可提交的姿势",
                  message: "所选姿势均在生成中；请稍候或在右下角 Dock 查看进度。",
                });
              }}
              onPreviewImage={openPoseImagePreview}
              onPreviewPrompt={(index) => {
                const item = project.plan.items.find((i) => i.index === index);
                if (!item?.prompt?.trim()) return;
                setPosePromptPreview({
                  title: item.title ?? `姿势 ${index}`,
                  prompt: item.prompt,
                });
              }}
            />
          ) : null}

          {(busy || activeGenPoseIndexes.size > 0 || backgroundGen.hasForegroundRunning) &&
          !streaming ? (
            <StoryboardTaskStatus
              active
              title={
                activeGenPoseIndexes.size > 0
                  ? `姿势 ${[...activeGenPoseIndexes].sort((a, b) => a - b).join("、")} 模特图生成中`
                  : "处理中"
              }
              detail="图像任务进行中，可关闭模型弹层；其它姿势可并行提交。"
            />
          ) : null}

          {modelsLoadError ? (
            <div className="rounded-xl border border-[#ffd6a5] bg-[#fff8ed] p-3 text-xs text-[#6e6e73]">
              {modelsLoadError}
              {onRefreshModels ? (
                <button type="button" className="ml-2 text-[#0071e3]" onClick={() => void onRefreshModels()}>
                  重试
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {posePromptPreview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="model-shot-pose-prompt-title"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setPosePromptPreview(null);
              }}
            >
              <div className="relative flex max-h-[min(92vh,880px)] w-[min(94vw,56rem)] flex-col rounded-2xl bg-white p-6 shadow-2xl">
                <EcomDialogCloseButton onClick={() => setPosePromptPreview(null)} />
                <h3
                  id="model-shot-pose-prompt-title"
                  className="pr-10 text-lg font-semibold text-[#1d1d1f]"
                >
                  {posePromptPreview.title}
                </h3>
                <div className="ecom-scrollbar-thin mt-4 min-h-[min(40vh,420px)] max-h-[min(72vh,680px)] w-full flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#f5f5f7] px-4 py-3 text-[13px] leading-relaxed text-[#1d1d1f]">
                  {posePromptPreview.prompt}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ModelShotSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultWorkName={project.title?.trim() || "服装模特图"}
        busy={saveBusy}
        onConfirm={handleSaveWorkflow}
      />

      <EcomImagePreviewHost
        preview={preview}
        galleryItems={poseImagePreviewItems}
        onClose={closePreview}
        nativeOverlay
      />
    </div>
  );
}
