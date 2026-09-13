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
  canAddCustomSuiteSlot,
} from "@/lib/detail-page-suite-add-custom-slot";
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
  SUITE_PRODUCT_REF_ACK,
} from "@/lib/detail-page-suite-assistant-choice-ui";
import {
  materializeModuleSlots,
  mergeModuleSlotsPreservingContent,
  resolveModuleDisplaySlots,
  syncModuleSlotsFromSelection,
  syncSuiteModulesSlots,
} from "@/lib/detail-page-suite-module-slots";
import { readDetailPageSuitePromptSnapshots } from "@/lib/detail-page-suite-prompt-snapshots";
import {
  detailPageSuiteHasPendingWork,
  listDetailPageSuitePendingImageKeys,
  listDetailPageSuitePendingPromptModuleIds,
  reconcileDetailPageSuitePendingMeta,
} from "@/lib/detail-page-suite-pending";
import {
  composeSuiteSlotKey,
  ensureSlotsDefaultSelected,
  listSelectedSuiteSlotKeys,
  toggleSuiteModuleImageSelection,
  toggleSuiteSlotImageSelection,
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

function suiteFromTemplate(template: DetailPageSuiteTemplate) {
  return {
    templateId: template.id,
    templateSnapshot: template,
    modules: template.modules.map((m) => ({
      module_id: m.module_id,
      module_name: m.module_name,
      enable: true,
      generate_count: m.max_num,
      max_num: m.max_num,
      select_mode: "manual" as const,
      candidate_pool: [...m.candidate_pool],
      selected_item_list: [...m.candidate_pool].slice(0, m.max_num),
      slots: [],
    })).map(syncModuleSlotsFromSelection),
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

function DetailPageSuiteStudioInner() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const [project, setProject] = useState<DetailPageSuiteProject | null>(null);
  const [templates, setTemplates] = useState<DetailPageSuiteTemplate[]>([]);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
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
      const meta = reconcileDetailPageSuitePendingMeta(p.suite, p.meta);
      const synced: DetailPageSuiteProject = meta !== p.meta ? { ...p, meta } : p;
      projectRef.current = synced;
      setProject(synced);
      setActiveGenSlotKeys(new Set(listDetailPageSuitePendingImageKeys(synced.meta)));
      setActivePromptModuleIds(new Set(listDetailPageSuitePendingPromptModuleIds(synced.meta)));
      sessionStorage.setItem(PROJECT_STORAGE_KEY, synced.id);
      syncImageSettingsFromProject(synced);
    },
    [syncImageSettingsFromProject],
  );

  const loadProjectById = useCallback(
    async (id: string, opts?: { announceRecovery?: boolean }) => {
      const { project: loaded, recovered } = await getDetailPageSuiteProject(id);
      applyProject(loaded);
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
      applyProject(next);
      return next;
    },
    [applyProject],
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
    if (!project?.id) return;
    if (!detailPageSuiteHasPendingWork(project.meta)) return;
    let cancelled = false;
    const refresh = async () => {
      if (cancelled) return;
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

  const beginPromptModule = useCallback((moduleId: string) => {
    setActivePromptModuleIds((prev) => new Set([...prev, moduleId]));
  }, []);

  const endPromptModule = useCallback((moduleId: string) => {
    setActivePromptModuleIds((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });
  }, []);

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
      let keys: string[] = [];
      setActiveGenSlotKeys((prev) => {
        keys = opts.slotKeys.filter((k) => !prev.has(k));
        if (keys.length === 0) return prev;
        return new Set([...prev, ...keys]);
      });
      if (keys.length === 0) {
        toast({
          title: "所选点位均在生成中",
          message: "请稍候或在右下角 Dock 查看进度。",
        });
        return;
      }
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

      try {
        const result = await generateDetailPageSuiteImages(project.id, {
          moduleId: opts.moduleId,
          slotKeys: keys,
          modelKey: opts.modelKey,
          imageSize: opts.imageSize,
          imageRatio: opts.imageRatio,
        });
        applyProject(result.project);
        if (useDock) backgroundGen.dismissTask(taskId);
        if (result.failures.length) {
          await alert({
            title: `完成 ${result.generated} 张，失败 ${result.failures.length}`,
            message: result.failures.slice(0, 5).join("\n"),
            variant: "error",
          });
        } else if (result.generated > 0) {
          toast({ variant: "success", title: `已生成 ${result.generated} 张` });
        }
      } catch (e) {
        if (useDock) {
          backgroundGen.failTask(taskId, e instanceof Error ? e.message : "生图失败");
        }
        await alert({
          title: "生图失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        endSlotGen(keys);
      }
    },
    [alert, applyProject, backgroundGen, endSlotGen, project, toast],
  );

  const requestImagePicker = useCallback((req: ImagePickerRequest) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setImagePicker(req);
  }, []);

  const loadProjectByIdRef = useRef(loadProjectById);
  loadProjectByIdRef.current = loadProjectById;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await fetchDetailPageSuiteModels();
        if (cancelled) return;
        setImageModels(models.imageModels);
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
          if (message === SUITE_PRODUCT_REF_ACK && project.references.length === 0) {
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
            history = appendChat(history, "assistant", "请为开启模块勾选子维度，或随机抽取。");
            await persist({
              chatHistory: history,
              meta: { ...(project.meta ?? {}), phase: "subdims" },
            });
            return;
          }
        }

        if (phase === "subdims") {
          if (message === "随机抽取未满模块") {
            const modules = project.suite.modules.map((m) => {
              if (!m.enable) return m;
              const n = m.generate_count;
              const pool = [...m.candidate_pool];
              const picked: string[] = [];
              while (picked.length < n && pool.length) {
                const i = Math.floor(Math.random() * pool.length);
                picked.push(pool.splice(i, 1)[0]!);
              }
              return { ...m, select_mode: "random" as const, selected_item_list: picked };
            });
            history = appendChat(history, "assistant", "已随机抽取，可继续改勾选后确认。");
            await persist({ suite: { ...project.suite, modules }, chatHistory: history });
            return;
          }
          if (message === "确认子维度") {
            history = appendChat(history, "assistant", "可以生成提示词了。");
            await persist({
              chatHistory: history,
              meta: { ...(project.meta ?? {}), phase: "prompts" },
            });
            return;
          }
        }

        if (message === "生成全部提示词") {
          const next = await generateDetailPageSuitePrompts(project.id);
          const modules = next.suite.modules.map((m) => ({
            ...m,
            slots: ensureSlotsDefaultSelected(m.slots),
          }));
          const after = appendChat(
            appendChat(next.chatHistory, "user", message),
            "assistant",
            "提示词已生成，可在中间区修改后出图。",
          );
          applyProject(
            await updateDetailPageSuiteProject(next.id, {
              suite: { ...next.suite, modules },
              chatHistory: after,
              meta: { ...(next.meta ?? {}), phase: "images" },
            }),
          );
          toast({ variant: "success", title: "提示词已生成" });
          return;
        }

        if (message === "生成全部图片") {
          const keys = listSelectedSuiteSlotKeys(project);
          if (keys.length === 0) {
            await alert({
              title: "没有可出图的点位",
              message: "请先生成提示词，并勾选要出图的子维度。",
              variant: "error",
            });
            return;
          }
          requestImagePicker({ slotKeys: keys });
        }
      } catch (e) {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
        else await alert({ title: "操作失败", message: e instanceof Error ? e.message : String(e), variant: "error" });
      } finally {
        setLlmBusyStatus(null);
      }
    },
    [alert, applyProject, persist, project, requestImagePicker, templates, toast],
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
            activeRewriteSlotKeys={activeRewriteSlotKeys}
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
              setPromptEdit({
                moduleId,
                slotKey,
                label,
                prompt: promptText,
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
              setAddSlotDialog({ moduleId });
            }}
            onToggleModuleImageSelect={(moduleId, selected) => {
              const modules = project.suite.modules.map((m) =>
                m.module_id === moduleId ? toggleSuiteModuleImageSelection(m, selected) : m,
              );
              void persist({ suite: { ...project.suite, modules } });
            }}
            onToggleSlotImageSelect={(moduleId, slotKey) => {
              const modules = project.suite.modules.map((m) =>
                m.module_id === moduleId ? toggleSuiteSlotImageSelection(m, slotKey) : m,
              );
              void persist({ suite: { ...project.suite, modules } });
            }}
            onGenModulePrompts={(moduleId) => {
              void (async () => {
                beginPromptModule(moduleId);
                try {
                  const next = await generateDetailPageSuitePrompts(project.id, { moduleId });
                  const modules = next.suite.modules.map((m) =>
                    m.module_id === moduleId
                      ? { ...m, slots: ensureSlotsDefaultSelected(m.slots) }
                      : m,
                  );
                  applyProject(
                    await updateDetailPageSuiteProject(next.id, {
                      suite: { ...next.suite, modules },
                    }),
                  );
                  toast({ variant: "success", title: "本模块提示词已生成" });
                } catch (e) {
                  await alert({
                    title: "生成失败",
                    message: e instanceof Error ? e.message : String(e),
                    variant: "error",
                  });
                } finally {
                  endPromptModule(moduleId);
                }
              })();
            }}
            onRequestGenerateModule={(moduleId, slotKeys) => {
              const mod = project.suite.modules.find((m) => m.module_id === moduleId);
              const keys =
                slotKeys ??
                (mod
                  ? resolveModuleDisplaySlots(mod)
                      .filter((s) => s.positive_prompt?.trim() && s.selectedForImage !== false)
                      .map((s) => composeSuiteSlotKey(moduleId, s.item_key))
                  : []);
              if (keys.length === 0) {
                toast({ title: "请先勾选有提示词的子维度", variant: "error" });
                return;
              }
              requestImagePicker({ moduleId, slotKeys: keys });
            }}
            onRequestGenerateSlot={(moduleId, slotKey) => {
              requestImagePicker({
                moduleId,
                slotKeys: [composeSuiteSlotKey(moduleId, slotKey)],
              });
            }}
            onRewriteSlot={(moduleId, slotKey) => {
              void (async () => {
                const composite = composeSuiteSlotKey(moduleId, slotKey);
                beginRewriteSlot(composite);
                try {
                  applyProject(
                    await generateDetailPageSuitePrompts(project.id, { moduleId, slotKey }),
                  );
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
            void persist({
              settings: {
                ...project.settings,
                imageModelKey: modelKey,
                imageSize,
                imageRatio: displayRatio,
              },
            });
            if (req.settingsOnly) {
              toast({ variant: "success", title: "生图设置已保存" });
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

      {promptEdit && project ? (
        <DetailPageSuiteSlotPromptEditDialog
          open
          title={promptEdit.label}
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
              beginRewriteSlot(composite);
              try {
                const next = await generateDetailPageSuitePrompts(project.id, {
                  moduleId,
                  slotKey,
                });
                applyProject(next);
                const mod = next.suite.modules.find((m) => m.module_id === moduleId);
                const slot = mod
                  ? resolveModuleDisplaySlots(mod).find((s) => s.item_key === slotKey)
                  : undefined;
                if (slot?.positive_prompt) {
                  setPromptEdit((prev) =>
                    prev ? { ...prev, prompt: slot.positive_prompt } : prev,
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
