"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  DetailPageSuiteAssistantComposer,
  DetailPageSuiteAssistantPanel,
  DetailPageSuiteAssistantRoot,
} from "@/components/detail-page-suite/detail-page-suite-assistant-panel";
import {
  DetailPageSuiteContentPanel,
  type DetailPageSuiteSlotImagePreviewPayload,
} from "@/components/detail-page-suite/detail-page-suite-content-panel";
import { DetailPageSuiteSlotPromptEditDialog } from "@/components/detail-page-suite/detail-page-suite-slot-prompt-edit-dialog";
import {
  addCustomPromptSlotToModule,
  addSizeChartDataSlotToModule,
  canAddCustomSuiteSlot,
  DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
} from "@/lib/detail-page-suite-add-custom-slot";
import {
  appendDefaultSizeChartTableToBrief,
  ensureSizeChartBriefTableCount,
} from "@/lib/detail-page-suite-size-chart";
import { DetailPageSuiteProgressRail } from "@/components/detail-page-suite/detail-page-suite-progress-rail";
import { BackgroundGenerationProvider, useBackgroundGeneration } from "@/components/generation";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { useEcomStudioAssistantCollapse } from "@/lib/ecom-assistant-collapse";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EcomDialogCloseButton,
} from "@/components/ui/dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";
import {
  ECOM_GENERATION_STANDARD_CONCURRENCY,
  mapWithConcurrencySettled,
} from "@/lib/ecom-generation-concurrency";
import type { DetailPageSuiteBusyStatus } from "@/lib/detail-page-suite-busy-status";
import {
  suiteBusyStatusForChoice,
  suiteBusyStatusForUpload,
} from "@/lib/detail-page-suite-busy-status";
import {
  ecomRatioToDefaultImageSize,
  resolveDetailPageDisplayRatio,
  type EcomDetailPageRatio,
} from "@/lib/detail-page-suite-platform-ratio";
import {
  buildDetailPageSuiteProductRefAutoAdvance,
  reconcileDetailPageSuiteProductRefState,
  SUITE_PRODUCT_REF_ACK,
} from "@/lib/detail-page-suite-assistant-choice-ui";
import {
  materializeModuleSlots,
  mergeModuleSlotsPreservingContent,
  resolveModuleDisplaySlots,
  syncModuleSlotsFromSelection,
  syncSuiteModulesSlots,
} from "@/lib/detail-page-suite-module-slots";
import {
  listDetailPageSuitePromptGenTargets,
  listModuleSelectedSlotKeys,
  pruneDetailPageSuitePromptSelection,
  resolveDetailPageSuiteBusyPromptKeys,
  resolveDetailPageSuiteBusySlotKeys,
} from "@/lib/detail-page-suite-prompt-selection";
import { readDetailPageSuitePromptSnapshots } from "@/lib/detail-page-suite-prompt-snapshots";
import {
  detailPageSuiteHasPendingWork,
  listDetailPageSuitePendingImageKeys,
  listDetailPageSuitePendingPromptModuleIds,
  reconcileDetailPageSuitePendingMeta,
} from "@/lib/detail-page-suite-pending";
import {
  mergeDetailPageSuiteProjectPreservingLocalPrompts,
  mergeDetailPageSuiteSlotPromptFromProject,
} from "@/lib/detail-page-suite-project-merge";
import { composeDetailPageSuiteVisiblePrompt } from "@/lib/detail-page-suite-prompt-compose";
import {
  isDetailPageSuiteSizeChartDataLabel,
  partitionDetailPageSuiteImageGenKeys,
  resolveSizeChartTableForSlot,
  resolveSizeChartTableIndexForLabel,
  upsertSizeChartTableInBrief,
} from "@/lib/detail-page-suite-size-chart";
import { DetailPageSuiteSizeChartEditDialog } from "@/components/detail-page-suite/detail-page-suite-size-chart-edit-dialog";
import { migrateDetailPageSuiteProjectClient } from "@/lib/detail-page-suite-suite-migrate";
import {
  composeSuiteSlotKey,
  ensureSlotsDefaultSelected,
  parseSuiteSlotKey,
} from "@/lib/detail-page-suite-slot-selection";
import {
  platformCodeFromLabel,
  type DetailPageSuiteProject,
  type DetailPageSuiteTemplate,
} from "@/lib/detail-page-suite-types";
import {
  appendChat,
  copyDetailPageSuiteTemplate,
  createDetailPageSuiteProject,
  deleteDetailPageSuiteProject,
  fetchDetailPageSuiteModels,
  generateDetailPageSuiteImages,
  generateDetailPageSuitePrompts,
  getDetailPageSuiteProject,
  listDetailPageSuiteSummaries,
  listDetailPageSuiteTemplates,
  updateDetailPageSuiteProject,
  uploadDetailPageSuiteRef,
  visionDetailPageSuiteSellpoints,
} from "@/lib/ecom-detail-page-suite-api";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import {
  FASHION_DIMENSION_STEPS,
  type FashionDimensionKey,
} from "@/lib/fashion-dimensions";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import {
  defaultImageSizeForModel,
  filterImageSizeOptionsByEcomRatio,
  imageSizeOptionsForModel,
} from "@/lib/storyboard-image-size-options";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-detail-page-suite-active-project";

type ImagePickerRequest = {
  slotKeys?: string[];
  moduleId?: string;
  /** 仅保存模型/参数，不触发生图 */
  settingsOnly?: boolean;
};

function defaultGenerateCountForModule(moduleId: string, maxNum: number): number {
  if (moduleId === "mod7_size_table") return Math.min(1, maxNum);
  return maxNum;
}

function suiteFromTemplate(template: DetailPageSuiteTemplate) {
  return {
    templateId: template.id,
    templateSnapshot: template,
    modules: template.modules
      .map((m) => {
        const generate_count = defaultGenerateCountForModule(m.module_id, m.max_num);
        const pool = [...m.candidate_pool];
        return {
          module_id: m.module_id,
          module_name: m.module_name,
          enable: true,
          generate_count,
          max_num: m.max_num,
          select_mode: "manual" as const,
          candidate_pool: pool,
          selected_item_list: pool.slice(0, generate_count),
          slots: [],
        };
      })
      .map(syncModuleSlotsFromSelection),
  };
}

function defaultImageSizeForRatio(modelKey: string, ratio: EcomDetailPageRatio): string {
  const opts = filterImageSizeOptionsByEcomRatio(
    imageSizeOptionsForModel(modelKey),
    ratio,
  );
  return (
    opts.find((o) => o.value === ecomRatioToDefaultImageSize(ratio))?.value ??
    defaultImageSizeForModel(modelKey, ratio === "16:9" ? "16:9" : ratio === "1:1" ? "1:1" : "3:4")
  );
}

function suiteSlotHasImage(
  project: DetailPageSuiteProject,
  compositeKey: string,
): boolean {
  const parsed = parseSuiteSlotKey(compositeKey);
  if (!parsed) return false;
  const mod = project.suite.modules.find((m) => m.module_id === parsed.moduleId);
  const slot = mod
    ? resolveModuleDisplaySlots(mod).find((s) => s.item_key === parsed.slotKey)
    : undefined;
  return Boolean(slot?.imageUrl?.trim());
}

const SUITE_IMAGE_RECOVERY_POLL_MS = 4000;
const SUITE_IMAGE_RECOVERY_MAX_MS = 120_000;

function DetailPageSuiteStudioInner() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const [project, setProject] = useState<DetailPageSuiteProject | null>(null);
  const [templates, setTemplates] = useState<DetailPageSuiteTemplate[]>([]);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [promptGenConcurrencyLimit, setPromptGenConcurrencyLimit] = useState(
    ECOM_GENERATION_STANDARD_CONCURRENCY,
  );
  const [imageModelKey, setImageModelKey] = useState("wan2.7-image");
  const [imageSize, setImageSize] = useState(() =>
    defaultImageSizeForRatio("wan2.7-image", "3:4"),
  );
  const [displayRatio, setDisplayRatio] = useState<EcomDetailPageRatio>("3:4");
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [llmBusyStatus, setLlmBusyStatus] = useState<DetailPageSuiteBusyStatus | null>(null);
  const llmBusy = llmBusyStatus != null;
  const [activeGenSlotKeys, setActiveGenSlotKeys] = useState<Set<string>>(() => new Set());
  const [activePromptModuleIds, setActivePromptModuleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activePromptSlotKeys, setActivePromptSlotKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [promptSelectionKeys, setPromptSelectionKeys] = useState<Set<string>>(() => new Set());
  const [activeRewriteSlotKeys, setActiveRewriteSlotKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [assistantWide, setAssistantWide] = useState(false);
  const { assistantCollapsed, setAssistantCollapsed, handleMainBlankPointerDown } =
    useEcomStudioAssistantCollapse(llmBusy);
  const [imagePicker, setImagePicker] = useState<ImagePickerRequest | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slotImagePreview, setSlotImagePreview] =
    useState<DetailPageSuiteSlotImagePreviewPayload | null>(null);
  const [promptEdit, setPromptEdit] = useState<{
    moduleId: string;
    slotKey: string;
    label: string;
    prompt: string;
  } | null>(null);
  const [promptEditSaving, setPromptEditSaving] = useState(false);
  const [sizeChartEdit, setSizeChartEdit] = useState<{
    moduleId: string;
    slotKey: string;
    label: string;
  } | null>(null);
  const [sizeChartEditSaving, setSizeChartEditSaving] = useState(false);
  const [addItemDialog, setAddItemDialog] = useState<{ moduleId: string; value: string } | null>(
    null,
  );
  const [addSlotDialog, setAddSlotDialog] = useState<{ moduleId: string } | null>(null);
  const [addSlotSaving, setAddSlotSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const productRefAutoAdvanceKeyRef = useRef<string | null>(null);
  const projectRef = useRef<DetailPageSuiteProject | null>(null);
  /** 客户端 images/generate 进行中；避免 poll / settings persist 覆盖刚写回的出图结果 */
  const imageGenInFlightRef = useRef<Set<string>>(new Set());
  const promptSlotInFlightRef = useRef<Set<string>>(new Set());
  /** 串行合并各 slot 写回，避免并发完成时互相覆盖；合并后再清 busy */
  const promptSlotMergeQueueRef = useRef(Promise.resolve());

  const syncImageSettingsFromProject = useCallback((p: DetailPageSuiteProject) => {
    const ratio = resolveDetailPageDisplayRatio(p.brief?.platformCode, p.settings.imageRatio);
    setDisplayRatio(ratio);
    const model = p.settings.imageModelKey?.trim();
    if (model) {
      setImageModelKey((prev) => (prev === model ? prev : model));
    }
    if (p.settings.imageSize) {
      setImageSize(p.settings.imageSize);
    } else {
      setImageSize(defaultImageSizeForRatio(model || "wan2.7-image", ratio));
    }
  }, []);

  const applyProject = useCallback(
    (p: DetailPageSuiteProject) => {
      p = migrateDetailPageSuiteProjectClient(p);
      const meta = reconcileDetailPageSuitePendingMeta(p.suite, p.meta);
      let synced: DetailPageSuiteProject = meta !== p.meta ? { ...p, meta } : p;
      if (meta !== p.meta) {
        void updateDetailPageSuiteProject(synced.id, { meta: synced.meta }).catch(() => {
          /* 展示层已修正 stale pending */
        });
      }
      const refChatPatch = reconcileDetailPageSuiteProductRefState(synced);
      if (refChatPatch) {
        synced = { ...synced, ...refChatPatch };
        void updateDetailPageSuiteProject(synced.id, refChatPatch).catch(() => {
          /* 展示层已修正；落库失败下次加载再试 */
        });
      }
      projectRef.current = synced;
      setProject(synced);
      const pendingGen = new Set<string>();
      for (const k of listDetailPageSuitePendingImageKeys(synced.meta)) {
        if (!suiteSlotHasImage(synced, k)) pendingGen.add(k);
      }
      for (const k of imageGenInFlightRef.current) pendingGen.add(k);
      setActiveGenSlotKeys(pendingGen);
      setActivePromptModuleIds(new Set(listDetailPageSuitePendingPromptModuleIds(synced.meta)));
      sessionStorage.setItem(PROJECT_STORAGE_KEY, synced.id);
      syncImageSettingsFromProject(synced);
    },
    [syncImageSettingsFromProject],
  );

  const applyProjectSlotPrompt = useCallback(
    (incoming: DetailPageSuiteProject, moduleId: string, slotKey: string) => {
      const current = projectRef.current;
      if (!current) {
        applyProject(incoming);
        return;
      }
      const merged = mergeDetailPageSuiteSlotPromptFromProject(
        current,
        incoming,
        moduleId,
        slotKey,
      );
      applyProject(merged ?? incoming);
    },
    [applyProject],
  );

  const loadProjectById = useCallback(
    async (id: string, opts?: { announceRecovery?: boolean }) => {
      const { project: loaded, recovered } = await getDetailPageSuiteProject(id);
      const current = projectRef.current;
      if (
        promptSlotInFlightRef.current.size > 0 &&
        current?.id === id
      ) {
        return loaded;
      }
      const toApply =
        current?.id === id
          ? mergeDetailPageSuiteProjectPreservingLocalPrompts(current, loaded)
          : loaded;
      applyProject(toApply);
      if (
        opts?.announceRecovery !== false &&
        recovered &&
        (recovered.images > 0 || recovered.prompts > 0)
      ) {
        const parts: string[] = [];
        if (recovered.images > 0) parts.push(`${recovered.images} 张图`);
        if (recovered.prompts > 0) parts.push(`${recovered.prompts} 条提示词`);
        toast({
          variant: "success",
          title: `已从「我的资产」回补 ${parts.join("、")}`,
          message: "此前出图成功但未写回点位的资源已自动挂载。",
        });
      }
      return loaded;
    },
    [applyProject, toast],
  );

  const persist = useCallback(
    async (patch: Parameters<typeof updateDetailPageSuiteProject>[1]) => {
      const current = projectRef.current;
      if (!current) return;
      const next = await updateDetailPageSuiteProject(current.id, patch);
      // 出图进行中写 settings/meta 可落库，但不要用旧 suite 快照覆盖刚写回的 imageUrl
      if (imageGenInFlightRef.current.size > 0 && patch.suite) {
        return current;
      }
      applyProject(next);
      return next;
    },
    [applyProject],
  );

  const syncActiveGenSlotKeysFromProject = useCallback(
    (p: DetailPageSuiteProject, keys: string[]) => {
      const pending = new Set(listDetailPageSuitePendingImageKeys(p.meta));
      setActiveGenSlotKeys((prev) => {
        const next = new Set(prev);
        for (const key of keys) {
          if (suiteSlotHasImage(p, key)) next.delete(key);
          else if (pending.has(key) || imageGenInFlightRef.current.has(key)) next.add(key);
          else next.delete(key);
        }
        for (const key of next) {
          if (suiteSlotHasImage(p, key) && !imageGenInFlightRef.current.has(key)) {
            next.delete(key);
          }
        }
        return next;
      });
    },
    [],
  );

  const recoverSuiteSlotImages = useCallback(
    async (projectId: string, keys: string[]) => {
      if (keys.length === 0) return null;
      const deadline = Date.now() + SUITE_IMAGE_RECOVERY_MAX_MS;
      let latest: DetailPageSuiteProject | null = null;
      while (Date.now() < deadline) {
        const missing = keys.filter((key) => !latest || !suiteSlotHasImage(latest, key));
        if (missing.length === 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, SUITE_IMAGE_RECOVERY_POLL_MS));
        try {
          latest = await loadProjectById(projectId, { announceRecovery: true });
        } catch {
          /* 继续轮询 */
        }
      }
      return latest;
    },
    [loadProjectById],
  );

  const maybeAdvanceProductRef = useCallback(
    async (source: DetailPageSuiteProject): Promise<DetailPageSuiteProject> => {
      const patch = buildDetailPageSuiteProductRefAutoAdvance(source);
      if (!patch) return source;
      const dedupeKey = `${source.id}:${source.references.length}:${source.meta?.phase ?? "product_ref"}`;
      if (productRefAutoAdvanceKeyRef.current === dedupeKey) return source;
      productRefAutoAdvanceKeyRef.current = dedupeKey;
      const next = await updateDetailPageSuiteProject(source.id, patch);
      applyProject(next);
      return next;
    },
    [applyProject],
  );

  useEffect(() => {
    productRefAutoAdvanceKeyRef.current = null;
  }, [project?.id]);

  useEffect(() => {
    if (!project) return;
    setPromptSelectionKeys((prev) => {
      const pruned = pruneDetailPageSuitePromptSelection(project, prev);
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [project]);

  useEffect(() => {
    if (!project?.id) return;
    if (!detailPageSuiteHasPendingWork(project.meta)) return;
    let cancelled = false;
    const refresh = async () => {
      if (cancelled) return;
      if (
        imageGenInFlightRef.current.size > 0 ||
        promptSlotInFlightRef.current.size > 0
      ) {
        return;
      }
      try {
        await loadProjectById(project.id, { announceRecovery: false });
      } catch {
        /* 轮询失败时保留当前快照 */
      }
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    loadProjectById,
    project?.id,
    project?.meta?.pendingImages,
    project?.meta?.pendingPromptModules,
  ]);

  const endSlotGen = useCallback((keys: string[]) => {
    setActiveGenSlotKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  }, []);

  const clearPromptSelectionForModule = useCallback((moduleId: string) => {
    const mod = projectRef.current?.suite.modules.find((m) => m.module_id === moduleId);
    if (!mod) return;
    const keys = resolveModuleDisplaySlots(mod).map((s) =>
      composeSuiteSlotKey(moduleId, s.item_key),
    );
    setPromptSelectionKeys((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const k of keys) {
        if (next.delete(k)) changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const beginPromptModule = useCallback(
    (moduleId: string) => {
      setActivePromptModuleIds((prev) => new Set([...prev, moduleId]));
      clearPromptSelectionForModule(moduleId);
    },
    [clearPromptSelectionForModule],
  );

  const endPromptModule = useCallback((moduleId: string) => {
    setActivePromptModuleIds((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });
  }, []);

  const beginPromptSlot = useCallback((key: string) => {
    setActivePromptSlotKeys((prev) => new Set([...prev, key]));
    setPromptSelectionKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const endPromptSlot = useCallback((key: string) => {
    setActivePromptSlotKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const enqueuePromptSlotApply = useCallback(
    (
      incoming: DetailPageSuiteProject,
      moduleId: string,
      slotKey: string,
      composite: string,
    ) => {
      const task = promptSlotMergeQueueRef.current.then(() => {
        applyProjectSlotPrompt(incoming, moduleId, slotKey);
        promptSlotInFlightRef.current.delete(composite);
        endPromptSlot(composite);
      });
      promptSlotMergeQueueRef.current = task.catch(() => undefined);
      return task;
    },
    [applyProjectSlotPrompt, endPromptSlot],
  );

  const clearPendingImagesForKeys = useCallback(
    async (keys: string[]) => {
      if (!project?.meta?.pendingImages || keys.length === 0) return;
      const pending = { ...project.meta.pendingImages };
      let changed = false;
      for (const k of keys) {
        if (pending[k]) {
          delete pending[k];
          changed = true;
        }
      }
      if (!changed) return;
      const meta = { ...(project.meta ?? {}) };
      if (Object.keys(pending).length > 0) meta.pendingImages = pending;
      else delete meta.pendingImages;
      await persist({ meta });
    },
    [persist, project],
  );

  const beginRewriteSlot = useCallback((key: string) => {
    setActiveRewriteSlotKeys((prev) => new Set([...prev, key]));
  }, []);

  const endRewriteSlot = useCallback((key: string) => {
    setActiveRewriteSlotKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const startImageGenerate = useCallback(
    async (opts: {
      slotKeys: string[];
      moduleId?: string;
      modelKey: string;
      imageSize: string;
      imageRatio: EcomDetailPageRatio;
    }) => {
      if (!project || opts.slotKeys.length === 0) return;
      let keys: string[] = opts.slotKeys;
      let forceRetry = false;
      setActiveGenSlotKeys((prev) => {
        const blocked = keys.filter((k) => prev.has(k));
        if (blocked.length === keys.length) {
          forceRetry = true;
          const next = new Set(prev);
          for (const k of keys) next.delete(k);
          return new Set([...next, ...keys]);
        }
        keys = keys.filter((k) => !prev.has(k));
        if (keys.length === 0) return prev;
        return new Set([...prev, ...keys]);
      });
      if (forceRetry) {
        await clearPendingImagesForKeys(opts.slotKeys);
      }
      if (keys.length === 0) {
        toast({
          title: "所选点位均在生成中",
          message: "请稍候或在右下角 Dock 查看进度。",
        });
        return;
      }
      setPromptSelectionKeys((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.delete(k);
        return next;
      });
      for (const k of keys) imageGenInFlightRef.current.add(k);
      const useDock = keys.length >= 3;
      const taskId = `dps-img-${Date.now()}`;
      if (useDock) {
        backgroundGen.registerTask({
          id: taskId,
          label: "详情页套图出图",
          hint: `约 ${keys.length} 张`,
          startedAt: new Date().toISOString(),
          expectedDurationMs: Math.max(180_000, keys.length * 25_000),
          poll: async () => ({ status: "running" as const }),
        });
      }

      let latestProject: DetailPageSuiteProject | null = null;
      try {
        const result = await generateDetailPageSuiteImages(project.id, {
          moduleId: opts.moduleId,
          slotKeys: keys,
          modelKey: opts.modelKey,
          imageSize: opts.imageSize,
          imageRatio: opts.imageRatio,
        });
        applyProject(result.project);
        latestProject = result.project;
        if (useDock) backgroundGen.dismissTask(taskId);

        const stillMissingAfterWrite = keys.filter(
          (key) => !suiteSlotHasImage(result.project, key),
        );
        if (stillMissingAfterWrite.length > 0) {
          latestProject = await loadProjectById(project.id, { announceRecovery: true });
          const stillMissing = keys.filter((key) => !suiteSlotHasImage(latestProject!, key));
          if (stillMissing.length > 0) {
            const recovered = await recoverSuiteSlotImages(project.id, stillMissing);
            if (recovered) latestProject = recovered;
          }
        }

        const syncedCount = keys.filter((key) => suiteSlotHasImage(latestProject!, key)).length;
        const missingAfterSync = keys.filter((key) => !suiteSlotHasImage(latestProject!, key));
        const failureLines =
          result.failures.length > 0
            ? result.failures
            : missingAfterSync.length > 0
              ? missingAfterSync.map(
                  (key) =>
                    `${key}: 出图未写回，请查看点位下方失败原因或 book-mall / Gateway 终端日志`,
                )
              : [];
        if (failureLines.length > 0) {
          console.error("[detail-page-suite] image gen failures", {
            projectId: project.id,
            keys,
            failures: failureLines,
          });
          await alert({
            title: `完成 ${syncedCount} 张，失败 ${failureLines.length}`,
            message: failureLines
              .slice(0, 8)
              .map((line) => {
                const idx = line.indexOf(": ");
                if (idx <= 0) return formatEcomImageGenUserMessage(line);
                return `${line.slice(0, idx)}: ${formatEcomImageGenUserMessage(line.slice(idx + 2))}`;
              })
              .join("\n"),
            variant: "error",
          });
        } else if (syncedCount > 0) {
          toast({ variant: "success", title: `已生成 ${syncedCount} 张` });
        } else {
          await alert({
            title: "出图未写回",
            message: "Gateway 可能仍在处理，请稍候刷新或到「我的资产」查看。",
            variant: "error",
          });
        }
      } catch (e) {
        if (useDock) {
          backgroundGen.failTask(taskId, e instanceof Error ? e.message : "生图失败");
        }
        try {
          latestProject = await loadProjectById(project.id, { announceRecovery: true });
          const stillMissing = keys.filter((key) => !suiteSlotHasImage(latestProject!, key));
          if (stillMissing.length > 0) {
            const recovered = await recoverSuiteSlotImages(project.id, stillMissing);
            if (recovered) latestProject = recovered;
          }
        } catch {
          /* 回落到错误提示 */
        }
        const syncedFromAssets =
          latestProject != null &&
          keys.some((key) => suiteSlotHasImage(latestProject!, key));
        if (syncedFromAssets) {
          toast({
            variant: "success",
            title: "出图已写回",
            message: "Gateway 已完成，界面已从资产库同步。",
          });
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[detail-page-suite] image gen request failed", {
            projectId: project.id,
            keys,
            message: msg,
          });
          await alert({
            title: "生图失败",
            message: `${msg}\n\n点位：${keys.slice(0, 6).join("、")}${keys.length > 6 ? " 等" : ""}`,
            variant: "error",
          });
        }
      } finally {
        for (const k of keys) imageGenInFlightRef.current.delete(k);
        if (latestProject) {
          syncActiveGenSlotKeysFromProject(latestProject, keys);
        } else {
          endSlotGen(keys);
        }
      }
    },
    [
      alert,
      applyProject,
      backgroundGen,
      clearPendingImagesForKeys,
      endSlotGen,
      loadProjectById,
      project,
      recoverSuiteSlotImages,
      syncActiveGenSlotKeysFromProject,
      toast,
    ],
  );

  const runModuleSelectedPromptGen = useCallback(
    async (moduleId: string) => {
      if (!project) return;
      const mod = project.suite.modules.find((m) => m.module_id === moduleId);
      if (!mod) return;
      const busyKeys = resolveDetailPageSuiteBusySlotKeys(
        project,
        activePromptModuleIds,
        activePromptSlotKeys,
        activeGenSlotKeys,
        activeRewriteSlotKeys,
      );
      const selectedKeys = listModuleSelectedSlotKeys(mod, promptSelectionKeys, {
        excludeKeys: busyKeys,
      });
      if (selectedKeys.length === 0) {
        toast({
          title: "请先勾选点位",
          message: "勾选要生成或重新生成提示词的子维度。",
          variant: "error",
        });
        return;
      }
      const slotKeys = selectedKeys
        .map((k) => parseSuiteSlotKey(k)?.slotKey)
        .filter(Boolean) as string[];
      const toRun = slotKeys.filter((slotKey) => {
        const composite = composeSuiteSlotKey(moduleId, slotKey);
        if (promptSlotInFlightRef.current.has(composite)) return false;
        promptSlotInFlightRef.current.add(composite);
        beginPromptSlot(composite);
        return true;
      });
      const skippedInFlight = slotKeys.length - toRun.length;
      let results: PromiseSettledResult<{ composite: string; project: DetailPageSuiteProject }>[] =
        [];
      try {
        results = await mapWithConcurrencySettled(
          toRun,
          async (slotKey) => {
            const composite = composeSuiteSlotKey(moduleId, slotKey);
            try {
              const latest = await generateDetailPageSuitePrompts(project.id, {
                moduleId,
                slotKey,
              });
              await enqueuePromptSlotApply(latest, moduleId, slotKey, composite);
              return { composite, project: latest };
            } catch (e) {
              promptSlotInFlightRef.current.delete(composite);
              endPromptSlot(composite);
              throw e;
            }
          },
          promptGenConcurrencyLimit,
        );
        await promptSlotMergeQueueRef.current;
      } catch {
        for (const slotKey of toRun) {
          const composite = composeSuiteSlotKey(moduleId, slotKey);
          promptSlotInFlightRef.current.delete(composite);
          endPromptSlot(composite);
        }
        throw new Error("批量生成提示词失败");
      }

      const succeeded = results.filter(
        (r): r is PromiseFulfilledResult<{ composite: string; project: DetailPageSuiteProject }> =>
          r.status === "fulfilled",
      );
      const failed = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (succeeded.length > 0) {
        setPromptSelectionKeys((prev) => {
          const next = new Set(prev);
          for (const r of succeeded) {
            next.delete(r.value.composite);
          }
          return next;
        });
        const current = projectRef.current ?? project;
        const phase = current.meta?.phase ?? "subdims";
        if (phase === "subdims") {
          const nextMeta = { ...(current.meta ?? {}), phase: "prompts" as const };
          applyProject({ ...current, meta: nextMeta });
          void persist({ meta: nextMeta });
        }
      }
      const skippedNote =
        skippedInFlight > 0 ? `（${skippedInFlight} 个点位已在生成中，已跳过）` : "";
      if (failed.length === 0 && toRun.length > 0) {
        toast({
          variant: "success",
          title: `已生成 ${succeeded.length} 条提示词${skippedNote}`,
        });
      } else if (succeeded.length > 0) {
        await alert({
          title: `完成 ${succeeded.length} 条，失败 ${failed.length}${skippedNote}`,
          message: failed
            .slice(0, 3)
            .map((r) => String(r.reason))
            .join("\n"),
          variant: "error",
        });
      } else if (toRun.length === 0 && skippedInFlight > 0) {
        toast({
          title: "所选点位均在生成中",
          message: "请稍候完成后再试。",
        });
      } else {
        await alert({
          title: "生成失败",
          message: failed[0] ? String(failed[0].reason) : "请稍后重试",
          variant: "error",
        });
      }
    },
    [
      activeGenSlotKeys,
      activePromptModuleIds,
      activePromptSlotKeys,
      activeRewriteSlotKeys,
      alert,
      applyProject,
      beginPromptSlot,
      enqueuePromptSlotApply,
      endPromptSlot,
      project,
      persist,
      promptGenConcurrencyLimit,
      promptSelectionKeys,
      toast,
    ],
  );

  const requestImagePicker = useCallback((req: ImagePickerRequest) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setImagePicker(req);
  }, []);

  const enqueueSuiteImageGenerate = useCallback(
    (req: { moduleId?: string; slotKeys: string[] }) => {
      if (!project || req.slotKeys.length === 0) return;
      const { programmaticKeys, modelKeys } = partitionDetailPageSuiteImageGenKeys(
        project,
        req.slotKeys,
      );
      const base = {
        moduleId: req.moduleId,
        modelKey: imageModelKey,
        imageSize,
        imageRatio: displayRatio,
      };
      if (programmaticKeys.length > 0) {
        void startImageGenerate({ ...base, slotKeys: programmaticKeys });
      }
      if (modelKeys.length > 0) {
        requestImagePicker({ moduleId: req.moduleId, slotKeys: modelKeys });
      }
    },
    [
      displayRatio,
      imageModelKey,
      imageSize,
      project,
      requestImagePicker,
      startImageGenerate,
    ],
  );

  const runModuleSelectedImageGen = useCallback(
    (moduleId: string) => {
      if (!project) return;
      const mod = project.suite.modules.find((m) => m.module_id === moduleId);
      if (!mod) return;
      const busyKeys = resolveDetailPageSuiteBusySlotKeys(
        project,
        activePromptModuleIds,
        activePromptSlotKeys,
        activeGenSlotKeys,
        activeRewriteSlotKeys,
      );
      const selectedKeys = listModuleSelectedSlotKeys(mod, promptSelectionKeys, {
        excludeKeys: busyKeys,
      });
      if (selectedKeys.length === 0) {
        toast({
          title: "请先勾选点位",
          variant: "error",
        });
        return;
      }
      const keys = listModuleSelectedSlotKeys(mod, promptSelectionKeys, {
        excludeKeys: busyKeys,
        requirePrompt: true,
      });
      if (keys.length === 0) {
        toast({
          title: "尚无提示词",
          message: "所选点位还没有提示词，请先生成提示词再出图。",
          variant: "error",
        });
        return;
      }
      if (keys.length < selectedKeys.length) {
        toast({
          title: `将出图 ${keys.length} 张`,
          message: `已跳过 ${selectedKeys.length - keys.length} 个无提示词的勾选点位。`,
        });
      }
      enqueueSuiteImageGenerate({ moduleId, slotKeys: keys });
    },
    [
      activeGenSlotKeys,
      activePromptModuleIds,
      activePromptSlotKeys,
      activeRewriteSlotKeys,
      enqueueSuiteImageGenerate,
      project,
      promptSelectionKeys,
      toast,
    ],
  );

  const loadProjectByIdRef = useRef(loadProjectById);
  loadProjectByIdRef.current = loadProjectById;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await fetchDetailPageSuiteModels();
        if (cancelled) return;
        setImageModels(models.imageModels);
        setPromptGenConcurrencyLimit(models.promptGenConcurrencyLimit);
        const saved = sessionStorage.getItem(PROJECT_STORAGE_KEY);
        if (saved) {
          try {
            const loaded = await loadProjectByIdRef.current(saved);
            if (!loaded.settings.imageModelKey?.trim()) {
              setImageModelKey(
                pickBoundStoryboardModelKey(
                  models.imageModels,
                  models.defaults.image || "wan2.7-image",
                ),
              );
            }
            setLoading(false);
            return;
          } catch {
            /* stale */
          }
        }
        const summaries = await listDetailPageSuiteSummaries();
        if (cancelled) return;
        if (summaries[0]) {
          const loaded = await loadProjectByIdRef.current(summaries[0].id);
          if (!loaded.settings.imageModelKey?.trim()) {
            setImageModelKey(
              pickBoundStoryboardModelKey(
                models.imageModels,
                models.defaults.image || "wan2.7-image",
              ),
            );
          }
        } else {
          setImageModelKey(
            pickBoundStoryboardModelKey(
              models.imageModels,
              models.defaults.image || "wan2.7-image",
            ),
          );
          setEmpty(true);
        }
      } catch (e) {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const code = project?.brief?.platformCode;
    if (!code) return;
    void listDetailPageSuiteTemplates(code).then(setTemplates).catch(() => setTemplates([]));
  }, [project?.brief?.platformCode, project?.id]);

  useEffect(() => {
    if (!project) return;
    const ratio = resolveDetailPageDisplayRatio(
      project.brief?.platformCode,
      project.settings.imageRatio,
    );
    setDisplayRatio(ratio);
  }, [project?.brief?.platformCode, project?.settings.imageRatio, project?.id]);

  const handleNew = useCallback(async () => {
    await runEcomNewProjectWithSavePrompt({
      confirm,
      hasWorkToSave: Boolean(project),
      save: async () => undefined,
      onProceed: async () => {
        const created = await createDetailPageSuiteProject();
        applyProject(created);
        setEmpty(false);
      },
    });
  }, [applyProject, confirm, project]);

  const loadProjectList = useCallback(async (): Promise<EcomProjectListItem[]> => {
    const items = await listDetailPageSuiteSummaries();
    return items.map((row) => ({
      id: row.id,
      title: row.title?.trim() || "详情页套图",
      updatedAt: row.updatedAt,
      thumbnailUrl: row.thumbnailUrl,
    }));
  }, []);

  const handleOpenProject = useCallback(
    async (id: string) => {
      try {
        await loadProjectById(id);
        setEmpty(false);
      } catch (e) {
        await alert({
          title: "无法打开项目",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      }
    },
    [alert, applyProject],
  );

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;
    if (
      !(await doubleConfirm({
        title: `删除项目「${project.title?.trim() || "详情页套图"}」？`,
        message: "将删除本项目在云端保存的配置与聊天记录。",
        secondTitle: "确认不可恢复删除？",
        secondMessage: "删除后无法恢复；已生成的图片仍保留在「我的资产」中。",
        confirmLabel: "删除",
      }))
    ) {
      return;
    }
    try {
      await deleteDetailPageSuiteProject(project.id);
      sessionStorage.removeItem(PROJECT_STORAGE_KEY);
      const summaries = await listDetailPageSuiteSummaries();
      if (summaries[0]) {
        await loadProjectById(summaries[0].id);
      } else {
        setProject(null);
        setEmpty(true);
      }
      toast({ variant: "success", title: "项目已删除" });
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }, [alert, applyProject, doubleConfirm, project, toast]);

  const handleChoice = useCallback(
    async (message: string) => {
      if (!project) return;
      try {
        setLlmBusyStatus(suiteBusyStatusForChoice(message));
        const phase = project.meta?.phase ?? "product_ref";
        const dimStep = project.meta?.dimensionStep ?? 0;
        let history = appendChat(project.chatHistory, "user", message);

        if (phase === "product_ref") {
          if (
            message === SUITE_PRODUCT_REF_ACK &&
            !project.references.some((r) => r.ossUrl?.trim())
          ) {
            await alert({
              title: "请先上传产品图",
              message: "在中栏产品图区上传至少一张，或选择「暂不上传，稍后补图」。",
              variant: "error",
            });
            return;
          }
          if (message === SUITE_PRODUCT_REF_ACK) {
            const advanced = buildDetailPageSuiteProductRefAutoAdvance({
              ...project,
              chatHistory: history,
            });
            if (advanced) {
              await persist(advanced);
              return;
            }
          }
          history = appendChat(
            history,
            "assistant",
            message === SUITE_PRODUCT_REF_ACK
              ? "已检测到产品图，接下来请选择七维参数。"
              : "接下来请选择七维参数。",
          );
          await persist({
            chatHistory: history,
            meta: { ...(project.meta ?? {}), phase: "dimensions", dimensionStep: 0 },
          });
          return;
        }

        if (phase === "dimensions") {
          const step = FASHION_DIMENSION_STEPS[dimStep];
          if (!step) return;
          const brief = { ...(project.brief ?? {}) };
          const key = step.key as FashionDimensionKey;
          brief[key] = message;
          if (key === "platform") {
            brief.platform = message;
            brief.platformCode = platformCodeFromLabel(message);
          }
          const nextStep = dimStep + 1;
          if (nextStep >= FASHION_DIMENSION_STEPS.length) {
            history = appendChat(history, "assistant", "七维已齐。请确认卖点：可识图、手填或直接确认。");
            await persist({
              brief,
              chatHistory: history,
              meta: { ...(project.meta ?? {}), phase: "sellpoints", dimensionStep: nextStep },
            });
          } else {
            history = appendChat(history, "assistant", `已记录${step.label}：${message}`);
            await persist({
              brief,
              chatHistory: history,
              meta: { ...(project.meta ?? {}), phase: "dimensions", dimensionStep: nextStep },
            });
          }
          return;
        }

        if (phase === "sellpoints") {
          if (message === "AI润色卖点") {
            const next = await visionDetailPageSuiteSellpoints(project.id, { polish: true });
            const after = appendChat(
              appendChat(next.chatHistory, "user", message),
              "assistant",
              "已润色卖点，可继续手填或确认。",
            );
            applyProject(await updateDetailPageSuiteProject(next.id, { chatHistory: after }));
            return;
          }
          if (message === "AI识图抽卖点") {
            const next = await visionDetailPageSuiteSellpoints(project.id);
            const after = appendChat(
              appendChat(next.chatHistory, "user", message),
              "assistant",
              `已从产品图识别 ${next.brief?.sellPoints?.length ?? 0} 条卖点，可继续手填或确认。`,
            );
            applyProject(await updateDetailPageSuiteProject(next.id, { chatHistory: after }));
            return;
          }
          if (message.startsWith("手填卖点")) {
            const lines = message
              .split("\n")
              .slice(1)
              .map((t) => t.trim())
              .filter(Boolean);
            const sellPoints = lines.map((text, i) => ({
              id: `sp-${Date.now()}-${i}`,
              text,
              source: "user" as const,
            }));
            history = appendChat(history, "assistant", `已收入 ${sellPoints.length} 条手填卖点。请确认清单。`);
            await persist({
              brief: { ...(project.brief ?? {}), sellPoints, sellpointsLocked: false },
              chatHistory: history,
            });
            return;
          }
          if (message === "确认卖点清单") {
            history = appendChat(history, "assistant", "请选择当前平台下的套图模板。");
            await persist({
              brief: { ...(project.brief ?? {}), sellpointsLocked: true },
              chatHistory: history,
              meta: { ...(project.meta ?? {}), phase: "template" },
            });
            return;
          }
        }

        if (phase === "template" && message.startsWith("选择模板·")) {
          const id = message.slice("选择模板·".length);
          const tpl = templates.find((t) => t.id === id);
          if (!tpl) return;
          history = appendChat(history, "assistant", `已选用「${tpl.templateName}」。请开关模块并确认。`);
          await persist({
            suite: suiteFromTemplate(tpl),
            chatHistory: history,
            meta: { ...(project.meta ?? {}), phase: "modules", templateId: tpl.id },
          });
          return;
        }

        if (phase === "modules") {
          if (message.startsWith("自定义模块·")) {
            const name = message.slice("自定义模块·".length);
            const module_id = `mod_user_${Date.now()}`;
            const modules = [
              ...project.suite.modules,
              {
                module_id,
                module_name: name,
                enable: true,
                generate_count: 1,
                max_num: 4,
                select_mode: "manual" as const,
                candidate_pool: [`${name}主视觉`],
                selected_item_list: [`${name}主视觉`],
                slots: [],
              },
            ];
            history = appendChat(history, "assistant", `已加入自定义模块「${name}」。`);
            await persist({ suite: { ...project.suite, modules }, chatHistory: history });
            return;
          }
          if (message === "确认模块配置") {
            const enabled = project.suite.modules.filter((m) => m.enable && m.generate_count > 0);
            if (enabled.length === 0) {
              await alert({ title: "请至少开启 1 个模块", message: "全部可关，但提交前须保留一张。", variant: "error" });
              return;
            }
            history = appendChat(
              history,
              "assistant",
              "已确认大模块。请在中栏配置子维度、勾选并生成提示词；出图仍可在助手区批量操作。",
            );
            await persist({
              chatHistory: history,
              meta: { ...(project.meta ?? {}), phase: "subdims" },
            });
            return;
          }
        }

        if (message === "生成全部图片") {
          const keys: string[] = [];
          for (const mod of project.suite.modules) {
            if (!mod.enable) continue;
            keys.push(
              ...listModuleSelectedSlotKeys(mod, promptSelectionKeys, { requirePrompt: true }),
            );
          }
          const slotKeys =
            keys.length > 0
              ? keys
              : listDetailPageSuitePromptGenTargets(project)
                  .filter((t) => t.hasPrompt)
                  .map((t) => t.key);
          if (slotKeys.length === 0) {
            await alert({
              title: "没有可出图的点位",
              message: "请先生成提示词，并勾选要出图的子维度。",
              variant: "error",
            });
            return;
          }
          enqueueSuiteImageGenerate({ slotKeys });
        }
      } catch (e) {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
        else await alert({ title: "操作失败", message: e instanceof Error ? e.message : String(e), variant: "error" });
      } finally {
        setLlmBusyStatus(null);
      }
    },
    [alert, applyProject, enqueueSuiteImageGenerate, persist, project, promptSelectionKeys, templates, toast],
  );

  const runProductRefUpload = useCallback(
    async (task: () => Promise<DetailPageSuiteProject>, label: string) => {
      if (!project) return;
      setUploading(true);
      setUploadProgressLabel(label);
      setLlmBusyStatus(suiteBusyStatusForUpload(1));
      setUploadProgress(10);
      const tick = window.setInterval(() => {
        setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
      }, 180);
      try {
        let latest = await task();
        latest = await maybeAdvanceProductRef(latest);
        setUploadProgress(100);
      } catch (e) {
        await alert({
          title: "上传失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        window.clearInterval(tick);
        setUploading(false);
        setLlmBusyStatus(null);
        window.setTimeout(() => {
          setUploadProgress(null);
          setUploadProgressLabel(undefined);
        }, 450);
      }
    },
    [alert, maybeAdvanceProductRef, project],
  );

  useEffect(() => {
    if (!project || uploading || llmBusy) return;
    void maybeAdvanceProductRef(project);
  }, [
    llmBusy,
    maybeAdvanceProductRef,
    project,
    project?.id,
    project?.meta?.phase,
    project?.references.length,
    uploading,
  ]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!project || files.length === 0) return;
      let latest = project;
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const label =
          files.length > 1
            ? `正在上传 ${i + 1}/${files.length}…`
            : "正在上传产品图…";
        await runProductRefUpload(async () => {
          latest = await uploadDetailPageSuiteRef(latest.id, file);
          return latest;
        }, label);
      }
    },
    [project, runProductRefUpload],
  );

  const imageModelLabel = useMemo(() => {
    const hit = imageModels.find((m) => m.modelKey === imageModelKey);
    return hit?.displayName?.trim() || imageModelKey;
  }, [imageModelKey, imageModels]);

  const pickerDialogTitle = useMemo(() => {
    if (!imagePicker) return "选择生图模型";
    if (imagePicker.settingsOnly) return "生图模型与参数";
    const n = imagePicker.slotKeys?.length ?? 0;
    if (n <= 1) return "单张出图 · 选择模型";
    return `批量出图 · ${n} 张`;
  }, [imagePicker]);

  if (needLogin) return <EcomLoginPrompt />;
  if (loading) return <ProductCreationStudioSkeleton />;

  if (empty || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <EcomButtonSecondary onClick={() => void handleNew()}>新建详情页套图</EcomButtonSecondary>
      </div>
    );
  }

  const assistantProps = {
    project,
    templates,
    busy: llmBusy,
    busyStatus: llmBusyStatus,
    composerWide: assistantWide,
    onComposerWideChange: setAssistantWide,
    collapsed: assistantCollapsed,
    onCollapsedChange: setAssistantCollapsed,
    onChoice: (m: string) => void handleChoice(m),
    onOpenImageModel: () => requestImagePicker({ settingsOnly: true }),
  };

  return (
    <>
      <DetailPageSuiteAssistantRoot {...assistantProps}>
        <EcomWorkspaceLayout
          assistantWide={assistantWide}
          assistantCollapsed={assistantCollapsed}
          onMainBlankPointerDown={handleMainBlankPointerDown}
          progress={<DetailPageSuiteProgressRail project={project} />}
          assistant={<DetailPageSuiteAssistantPanel />}
          assistantFooter={
            assistantCollapsed ? null : <DetailPageSuiteAssistantComposer />
          }
        >
          <DetailPageSuiteContentPanel
            project={project}
            llmBusy={llmBusy}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadProgressLabel={uploadProgressLabel}
            activeGenSlotKeys={activeGenSlotKeys}
            activePromptModuleIds={activePromptModuleIds}
            activePromptSlotKeys={activePromptSlotKeys}
            activeRewriteSlotKeys={activeRewriteSlotKeys}
            promptSelectionKeys={promptSelectionKeys}
            onTogglePromptSelection={(key) => {
              setPromptSelectionKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onToggleModulePromptSelection={(moduleId, selected) => {
              const mod = project.suite.modules.find((m) => m.module_id === moduleId);
              if (!mod) return;
              const keys = resolveModuleDisplaySlots(mod).map((s) =>
                composeSuiteSlotKey(moduleId, s.item_key),
              );
              setPromptSelectionKeys((prev) => {
                const next = new Set(prev);
                for (const k of keys) {
                  if (selected) next.add(k);
                  else next.delete(k);
                }
                return next;
              });
            }}
            onToggleAllPromptSelection={(selected) => {
              const keys = listDetailPageSuitePromptGenTargets(project).map((t) => t.key);
              setPromptSelectionKeys(selected ? new Set(keys) : new Set());
            }}
            onGenerateModulePrompts={(moduleId) => void runModuleSelectedPromptGen(moduleId)}
            onGenerateModuleImages={(moduleId) => runModuleSelectedImageGen(moduleId)}
            displayRatio={displayRatio}
            imageModelLabel={imageModelLabel}
            onNewProject={() => void handleNew()}
            loadProjectList={loadProjectList}
            onOpenProject={(id) => void handleOpenProject(id)}
            onDeleteProject={() => void handleDeleteProject()}
            onUploadFiles={(files) => void handleUpload(files)}
          onAttachAssets={(assets) => {
            void runProductRefUpload(async () => {
              const next = [
                ...project.references,
                ...assets.map((a) => ({
                  id: a.id,
                  label: a.title || "产品图",
                  role: "product" as const,
                  ossUrl: a.ossUrl,
                })),
              ];
              return (await persist({ references: next })) ?? project;
            }, assets.length > 1 ? `正在添加 ${assets.length} 张资产…` : "正在添加资产…");
          }}
            onRemoveRef={(id) => {
              void persist({
                references: project.references.filter((r) => r.id !== id),
              });
            }}
            onPreview={setPreviewUrl}
            onPreviewSlotImage={setSlotImagePreview}
            onOpenPromptEdit={(moduleId, slotKey, promptText, label) => {
              if (isDetailPageSuiteSizeChartDataLabel(label)) {
                setSizeChartEdit({ moduleId, slotKey, label });
                return;
              }
              const brief = project.brief ?? {};
              setPromptEdit({
                moduleId,
                slotKey,
                label,
                prompt: composeDetailPageSuiteVisiblePrompt(
                  promptText,
                  brief,
                  label,
                  moduleId,
                ),
              });
            }}
            onToggleModule={(moduleId, enable) => {
              const modules = project.suite.modules.map((m) =>
                m.module_id === moduleId
                  ? { ...m, enable, generate_count: enable ? Math.max(1, m.generate_count) : 0 }
                  : m,
              );
              void persist({ suite: { ...project.suite, modules } });
            }}
            onChangeCount={(moduleId, n) => {
              const modules = syncSuiteModulesSlots(
                project.suite.modules.map((m) =>
                  m.module_id === moduleId
                    ? syncModuleSlotsFromSelection({
                        ...m,
                        generate_count: Math.max(0, Math.min(m.max_num, n)),
                        enable: Math.max(0, Math.min(m.max_num, n)) > 0,
                      })
                    : m,
                ),
              );
              void persist({ suite: { ...project.suite, modules } });
            }}
            onToggleItem={(moduleId, item) => {
              const modules = syncSuiteModulesSlots(
                project.suite.modules.map((m) => {
                  if (m.module_id !== moduleId) return m;
                  const has = m.selected_item_list.includes(item);
                  const selected = has
                    ? m.selected_item_list.filter((x) => x !== item)
                    : [...m.selected_item_list, item].slice(0, m.generate_count);
                  return syncModuleSlotsFromSelection({ ...m, selected_item_list: selected });
                }),
              );
              void persist({ suite: { ...project.suite, modules } });
            }}
            onRequestAddItem={(moduleId) => {
              setAddItemDialog({ moduleId, value: "" });
            }}
            onRequestAddSlot={(moduleId) => {
              const check = canAddCustomSuiteSlot(project.suite, moduleId);
              if (!check.ok) {
                void alert({ title: "无法新增点位", message: check.reason, variant: "error" });
                return;
              }
              if (moduleId === DETAIL_PAGE_SUITE_SIZE_MODULE_ID) {
                void (async () => {
                  try {
                    const mod = project.suite.modules.find((m) => m.module_id === moduleId);
                    const existingDataSlots =
                      mod == null
                        ? 0
                        : resolveModuleDisplaySlots(mod).filter((s) =>
                            isDetailPageSuiteSizeChartDataLabel(s.item_label),
                          ).length;
                    const briefBase = ensureSizeChartBriefTableCount(
                      project.brief,
                      existingDataSlots,
                    );
                    const { brief, label } = appendDefaultSizeChartTableToBrief(briefBase);
                    const modules = syncSuiteModulesSlots(
                      project.suite.modules.map((m) =>
                        m.module_id === moduleId
                          ? addSizeChartDataSlotToModule(m, label)
                          : m,
                      ),
                    );
                    await persist({
                      brief,
                      suite: { ...project.suite, modules },
                    });
                    toast({
                      variant: "success",
                      title: "已新增尺码表",
                      message: "已带入默认表数据，点击卡片可编辑后生图。",
                    });
                  } catch (e) {
                    await alert({
                      title: "新增失败",
                      message: e instanceof Error ? e.message : String(e),
                      variant: "error",
                    });
                  }
                })();
                return;
              }
              setAddSlotDialog({ moduleId });
            }}
            onPickImageModel={() => requestImagePicker({ settingsOnly: true })}
            onDisplayRatioChange={(ratio) => {
              setDisplayRatio(ratio);
              const nextSize = defaultImageSizeForRatio(imageModelKey, ratio);
              setImageSize(nextSize);
              void persist({
                settings: { ...project.settings, imageRatio: ratio, imageSize: nextSize },
              });
            }}
            onActiveImageIndexChange={(moduleId, slotKey, index) => {
              const modules = project.suite.modules.map((m) =>
                m.module_id === moduleId
                  ? {
                      ...m,
                      slots: m.slots.map((s) =>
                        s.item_key === slotKey ? { ...s, activeImageIndex: index } : s,
                      ),
                    }
                  : m,
              );
              void persist({ suite: { ...project.suite, modules } });
            }}
          />
        </EcomWorkspaceLayout>
      </DetailPageSuiteAssistantRoot>

      {imagePicker ? (
        <StoryboardModelPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setImagePicker(null);
          }}
          mode="image"
          dialogTitle={pickerDialogTitle}
          dialogDescription={`展示比例 ${displayRatio}；出图前请确认模型与尺寸参数。`}
          confirmLabel={imagePicker.settingsOnly ? "保存设置" : "开始生图"}
          models={imageModels}
          value={imageModelKey}
          onChange={setImageModelKey}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          footerHint={
            (imagePicker.settingsOnly
              ? "保存后应用于后续出图。"
              : "确认后开始生成；其它点位可并行提交。") +
            ` 当前比例 ${displayRatio}。`
          }
          onConfirm={(modelKey) => {
            const req = imagePicker;
            setImagePicker(null);
            setImageModelKey(modelKey);
            if (req.settingsOnly) {
              void persist({
                settings: {
                  ...project.settings,
                  imageModelKey: modelKey,
                  imageSize,
                  imageRatio: displayRatio,
                },
              }).then(() => toast({ variant: "success", title: "生图设置已保存" }));
              return;
            }
            const slotKeys = req.slotKeys ?? [];
            void startImageGenerate({
              slotKeys,
              moduleId: req.moduleId,
              modelKey,
              imageSize,
              imageRatio: displayRatio,
            });
          }}
        />
      ) : null}

      {previewUrl ? (
        <EcomImagePreviewDialog
          open
          nativeOverlay
          title="产品图预览"
          src={previewUrl}
          onOpenChange={(open) => {
            if (!open) setPreviewUrl(null);
          }}
        />
      ) : null}

      {slotImagePreview ? (
        <EcomImagePreviewDialog
          open
          nativeOverlay
          src={slotImagePreview.src}
          title={slotImagePreview.title}
          items={slotImagePreview.items}
          initialIndex={slotImagePreview.initialIndex}
          onOpenChange={(open) => {
            if (!open) setSlotImagePreview(null);
          }}
        />
      ) : null}

      {sizeChartEdit && project ? (
        <DetailPageSuiteSizeChartEditDialog
          open
          title={sizeChartEdit.label}
          table={resolveSizeChartTableForSlot(
            project.brief,
            resolveSizeChartTableIndexForLabel(sizeChartEdit.label),
          )}
          saving={sizeChartEditSaving}
          onOpenChange={(open) => {
            if (!open) setSizeChartEdit(null);
          }}
          onSave={async (table) => {
            setSizeChartEditSaving(true);
            try {
              const tableIndex = resolveSizeChartTableIndexForLabel(sizeChartEdit.label);
              const brief = upsertSizeChartTableInBrief(project.brief, tableIndex, table);
              await persist({ brief });
              applyProject({ ...project, brief });
              setSizeChartEdit(null);
              toast({ variant: "success", title: "尺码参数已保存" });
            } catch (e) {
              await alert({
                title: "保存失败",
                message: e instanceof Error ? e.message : String(e),
                variant: "error",
              });
            } finally {
              setSizeChartEditSaving(false);
            }
          }}
        />
      ) : null}

      {promptEdit && project ? (
        <DetailPageSuiteSlotPromptEditDialog
          open
          title={promptEdit.label}
          shootingRequirement={promptEdit.label}
          prompt={promptEdit.prompt}
          saving={promptEditSaving}
          rewriteBusy={activeRewriteSlotKeys.has(
            composeSuiteSlotKey(promptEdit.moduleId, promptEdit.slotKey),
          )}
          onOpenChange={(open) => {
            if (!open) setPromptEdit(null);
          }}
          onSave={async (promptText) => {
            setPromptEditSaving(true);
            try {
              const current = projectRef.current ?? project;
              const snapshots = readDetailPageSuitePromptSnapshots(current.meta);
              const modules = current.suite.modules.map((m) => {
                if (m.module_id !== promptEdit.moduleId) return m;
                return {
                  ...m,
                  slots: materializeModuleSlots(
                    {
                      ...m,
                      slots: resolveModuleDisplaySlots(m).map((s) =>
                        s.item_key === promptEdit.slotKey
                          ? { ...s, positive_prompt: promptText, promptEdited: true }
                          : s,
                      ),
                    },
                    snapshots,
                  ),
                };
              });
              await persist({ suite: { ...project.suite, modules } });
              setPromptEdit(null);
              toast({ variant: "success", title: "提示词已保存" });
            } finally {
              setPromptEditSaving(false);
            }
          }}
          onRewrite={() => {
            const { moduleId, slotKey } = promptEdit;
            void (async () => {
              const composite = composeSuiteSlotKey(moduleId, slotKey);
              if (activeRewriteSlotKeys.has(composite)) return;
              beginRewriteSlot(composite);
              try {
                const next = await generateDetailPageSuitePrompts(project.id, {
                  moduleId,
                  slotKey,
                });
                applyProjectSlotPrompt(next, moduleId, slotKey);
                const mod = next.suite.modules.find((m) => m.module_id === moduleId);
                const slot = mod
                  ? resolveModuleDisplaySlots(mod).find((s) => s.item_key === slotKey)
                  : undefined;
                if (slot?.positive_prompt) {
                  setPromptEdit((prev) =>
                    prev
                      ? {
                          ...prev,
                          prompt: composeDetailPageSuiteVisiblePrompt(
                            slot.positive_prompt,
                            next.brief ?? {},
                            slot.item_label,
                            moduleId,
                          ),
                        }
                      : prev,
                  );
                }
                toast({ variant: "success", title: "本条已重写" });
              } catch (e) {
                await alert({
                  title: "重写失败",
                  message: e instanceof Error ? e.message : String(e),
                  variant: "error",
                });
              } finally {
                endRewriteSlot(composite);
              }
            })();
          }}
        />
      ) : null}

      {addSlotDialog && project ? (
        <DetailPageSuiteSlotPromptEditDialog
          open
          mode="add"
          title="新增点位"
          prompt=""
          saving={addSlotSaving}
          onOpenChange={(open) => {
            if (!open) setAddSlotDialog(null);
          }}
          onSave={async (promptText) => {
            const check = canAddCustomSuiteSlot(project.suite, addSlotDialog.moduleId);
            if (!check.ok) {
              await alert({ title: "无法新增点位", message: check.reason, variant: "error" });
              return;
            }
            setAddSlotSaving(true);
            try {
              const modules = project.suite.modules.map((m) =>
                m.module_id === addSlotDialog.moduleId
                  ? addCustomPromptSlotToModule(m, promptText)
                  : m,
              );
              await persist({ suite: { ...project.suite, modules } });
              setAddSlotDialog(null);
              toast({ variant: "success", title: "已新增点位，可勾选后出图" });
            } catch (e) {
              await alert({
                title: "添加失败",
                message: e instanceof Error ? e.message : String(e),
                variant: "error",
              });
            } finally {
              setAddSlotSaving(false);
            }
          }}
        />
      ) : null}

      {addItemDialog ? (
        <Dialog open onOpenChange={(open) => !open && setAddItemDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增子维度</DialogTitle>
              <EcomDialogCloseButton />
            </DialogHeader>
            <label className="block text-sm text-[#6e6e73]">
              拍摄对象
              <input
                className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm outline-none focus:border-[#0071e3]"
                value={addItemDialog.value}
                autoFocus
                onChange={(e) =>
                  setAddItemDialog((prev) =>
                    prev ? { ...prev, value: e.target.value } : prev,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addItemDialog.value.trim()) {
                    e.preventDefault();
                    void (async () => {
                      const { moduleId, value } = addItemDialog;
                      setAddItemDialog(null);
                      const save = await confirm({
                        title: "保存到我的模板？",
                        message: "选「确定」会复制一份模板并写入该子维度；取消则仅本次任务有效。",
                      });
                      const modules = project.suite.modules.map((m) => {
                        if (m.module_id !== moduleId) return m;
                        const pool = m.candidate_pool.includes(value)
                          ? m.candidate_pool
                          : [...m.candidate_pool, value];
                        const selected = m.selected_item_list.includes(value)
                          ? m.selected_item_list
                          : [...m.selected_item_list, value].slice(0, Math.max(m.generate_count, 1));
                        return { ...m, candidate_pool: pool, selected_item_list: selected };
                      });
                      await persist({ suite: { ...project.suite, modules } });
                      if (save && project.suite.templateId) {
                        await copyDetailPageSuiteTemplate(
                          project.suite.templateId,
                          `${project.title ?? "套图"} 我的模板`,
                          modules.map((m) => ({
                            module_id: m.module_id,
                            module_name: m.module_name,
                            required: false,
                            max_num: m.max_num,
                            candidate_pool: m.candidate_pool,
                          })),
                        );
                        toast({ variant: "success", title: "已复制为我的模板（可在后台继续改）" });
                      }
                    })();
                  }
                }}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <EcomButtonSecondary type="button" onClick={() => setAddItemDialog(null)}>
                取消
              </EcomButtonSecondary>
              <EcomButtonSecondary
                type="button"
                disabled={!addItemDialog.value.trim()}
                onClick={() => {
                  void (async () => {
                    const { moduleId, value } = addItemDialog;
                    if (!value.trim()) return;
                    setAddItemDialog(null);
                    const save = await confirm({
                      title: "保存到我的模板？",
                      message: "选「确定」会复制一份模板并写入该子维度；取消则仅本次任务有效。",
                    });
                    const modules = project.suite.modules.map((m) => {
                      if (m.module_id !== moduleId) return m;
                      const pool = m.candidate_pool.includes(value)
                        ? m.candidate_pool
                        : [...m.candidate_pool, value];
                      const selected = m.selected_item_list.includes(value)
                        ? m.selected_item_list
                        : [...m.selected_item_list, value].slice(0, Math.max(m.generate_count, 1));
                      return { ...m, candidate_pool: pool, selected_item_list: selected };
                    });
                    await persist({ suite: { ...project.suite, modules } });
                    if (save && project.suite.templateId) {
                      await copyDetailPageSuiteTemplate(
                        project.suite.templateId,
                        `${project.title ?? "套图"} 我的模板`,
                        modules.map((m) => ({
                          module_id: m.module_id,
                          module_name: m.module_name,
                          required: false,
                          max_num: m.max_num,
                          candidate_pool: m.candidate_pool,
                        })),
                      );
                      toast({ variant: "success", title: "已复制为我的模板（可在后台继续改）" });
                    }
                  })();
                }}
              >
                确定
              </EcomButtonSecondary>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export function DetailPageSuiteStudio() {
  return (
    <BackgroundGenerationProvider>
      <DetailPageSuiteStudioInner />
    </BackgroundGenerationProvider>
  );
}
