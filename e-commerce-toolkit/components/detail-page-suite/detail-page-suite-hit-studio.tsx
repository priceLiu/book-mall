"use client";

import { Loader2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { DetailPageSuiteHitComponentEditor } from "@/components/detail-page-suite/detail-page-suite-hit-component-editor";
import {
  DetailPageSuiteContentPanel,
  DetailPageSuiteWorkbenchChrome,
  type DetailPageSuiteSlotImagePreviewPayload,
} from "@/components/detail-page-suite/detail-page-suite-content-panel";
import { DetailPageSuiteSizeChartEditDialog } from "@/components/detail-page-suite/detail-page-suite-size-chart-edit-dialog";
import { DetailPageSuiteSlotPromptEditDialog } from "@/components/detail-page-suite/detail-page-suite-slot-prompt-edit-dialog";
import {
  BackgroundGenerationProvider,
  useBackgroundGeneration,
} from "@/components/generation";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { EcomWorkbenchBottomTaskDock } from "@/components/layout/ecom-workbench-bottom-task-dock";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  addCustomPromptSlotToModule,
  addSizeChartDataSlotToModule,
  canAddCustomSuiteSlot,
  DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
} from "@/lib/detail-page-suite-add-custom-slot";
import { downloadDetailPageSuiteHitExportZip } from "@/lib/detail-page-suite-export-download";
import {
  resolveModuleDisplaySlots,
  syncSuiteModulesSlots,
} from "@/lib/detail-page-suite-module-slots";
import {
  appendDefaultSizeChartTableToBrief,
  ensureSizeChartBriefTableCount,
  isDetailPageSuiteSizeChartDataLabel,
  resolveSizeChartTableForSlot,
  resolveSizeChartTableIndexForLabel,
  upsertSizeChartTableInBrief,
} from "@/lib/detail-page-suite-size-chart";
import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";
import {
  listDetailPageSuitePromptGenTargets,
  pruneDetailPageSuitePromptSelection,
  detailPageSuiteProjectSlotHasImage,
  resolveDetailPageSuiteBusyImageGenExcludeKeys,
  resolveDetailPageSuiteImageGenSlotKeys,
} from "@/lib/detail-page-suite-prompt-selection";
import { listDetailPageSuitePendingImageKeys } from "@/lib/detail-page-suite-pending";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import {
  HIT_COMPLIANCE_COPY,
  readHitTemplate,
  type HitTemplate,
} from "@/lib/detail-page-suite-hit-types";
import {
  createDetailPageSuiteHitProject,
  decomposeDetailPageSuiteHit,
  deleteDetailPageSuiteHitProject,
  DetailPageSuiteHitInFlightError,
  fetchDetailPageSuiteHitModels,
  generateDetailPageSuiteHitImages,
  getDetailPageSuiteHitProject,
  listDetailPageSuiteHitSummaries,
  resetDetailPageSuiteHitTemplate,
  rewriteDetailPageSuiteHit,
  saveDetailPageSuiteHitTemplate,
  updateDetailPageSuiteHitProject,
  uploadDetailPageSuiteHitRef,
  visionDetailPageSuiteHitSellpoints,
} from "@/lib/ecom-detail-page-suite-hit-api";
import {
  DETAIL_PAGE_SUITE_HIT_DECOMPOSE_EXPECTED_MS,
  detailPageSuiteHitDecomposeTaskId,
  hitDecomposeFailMessage,
  isHitDecomposeDone,
} from "@/lib/detail-page-suite-hit-decompose-job";
import { isHitDecomposeInFlight } from "@/lib/detail-page-suite-hit-progress";
import { resolveHitBottomTask } from "@/lib/detail-page-suite-hit-bottom-task";
import { isVisionSellpointJobRunning, readHitVisionSellpointJob } from "@/lib/detail-page-suite-vision-sellpoint-progress";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const STORAGE_KEY = "ecom-detail-page-suite-hit-active-project";
const HIT_MODEL_REF_MAX = 6;

type HitUploadRole = "reference_suite" | "product" | "model";

function savedSellpointsText(project: DetailPageSuiteProject): string {
  return project.brief?.sellPoints?.map((s) => s.text).join("\n") ?? "";
}

function isSellpointDraftDirty(project: DetailPageSuiteProject, draft: string): boolean {
  return draft.trim() !== savedSellpointsText(project).trim();
}

function allPromptTargetKeys(project: DetailPageSuiteProject): Set<string> {
  return new Set(listDetailPageSuitePromptGenTargets(project).map((t) => t.key));
}

function DetailPageSuiteHitStudioInner() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const [project, setProject] = useState<DetailPageSuiteProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const visionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadingRole, setUploadingRole] = useState<HitUploadRole | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string | undefined>();
  const uploadBusy = uploadingRole != null;
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState("");
  const [visionModelKey, setVisionModelKey] = useState("");
  const [imageModelKey, setImageModelKey] = useState("");
  const [activeGenSlotKeys, setActiveGenSlotKeys] = useState<Set<string>>(() => new Set());
  const [promptSelectionKeys, setPromptSelectionKeys] = useState<Set<string>>(() => new Set());
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerModuleId, setImagePickerModuleId] = useState<string | undefined>();
  const [imagePickerIntent, setImagePickerIntent] = useState<"settings" | "generate">(
    "generate",
  );
  const imageModelsRef = useRef(imageModels);
  imageModelsRef.current = imageModels;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slotImagePreview, setSlotImagePreview] =
    useState<DetailPageSuiteSlotImagePreviewPayload | null>(null);
  const [promptEdit, setPromptEdit] = useState<{
    moduleId: string;
    slotKey: string;
    label: string;
    prompt: string;
    slotCopy?: string;
  } | null>(null);
  const [addSlotDialog, setAddSlotDialog] = useState<{ moduleId: string } | null>(null);
  const [addSlotSaving, setAddSlotSaving] = useState(false);
  const [sellpointDraft, setSellpointDraft] = useState("");
  const suiteFileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const decomposeLockRef = useRef(false);
  const rewriteLockRef = useRef(false);
  const rewritePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);
  const [exportPackBusy, setExportPackBusy] = useState(false);
  const [sizeChartEdit, setSizeChartEdit] = useState<{
    moduleId: string;
    slotKey: string;
    label: string;
  } | null>(null);
  const [sizeChartEditSaving, setSizeChartEditSaving] = useState(false);
  const templateSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = useMemo(
    () => (project ? readHitTemplate(project.meta?.hitTemplate) : null),
    [project],
  );
  const decomposeDockTaskId = project ? detailPageSuiteHitDecomposeTaskId(project.id) : "";
  const decomposeDockRunning = backgroundGen.tasks.some(
    (t) => t.id === decomposeDockTaskId && t.status === "running",
  );
  const hitBusy =
    decomposing ||
    rewriting ||
    isHitDecomposeInFlight(project?.meta ?? null) ||
    (decomposeDockRunning && !backgroundGen.isTaskMinimized(decomposeDockTaskId));
  const bottomTask = resolveHitBottomTask({
    project,
    uploadBusy,
    uploadProgress,
    uploadProgressLabel,
    decomposing,
    rewriting,
    visionBusy,
    imageGenSlotCount: activeGenSlotKeys.size,
  });

  const syncActiveGenFromProject = useCallback((p: DetailPageSuiteProject) => {
    const next = new Set<string>();
    for (const key of listDetailPageSuitePendingImageKeys(p.meta)) {
      if (!detailPageSuiteProjectSlotHasImage(p, key)) next.add(key);
    }
    setActiveGenSlotKeys(next);
  }, []);

  const syncImageModelFromProject = useCallback((p: DetailPageSuiteProject) => {
    const saved = p.settings.imageModelKey?.trim();
    if (!saved) return;
    setImageModelKey(pickBoundStoryboardModelKey(imageModelsRef.current, saved));
  }, []);

  const applyHitProject = useCallback(
    (p: DetailPageSuiteProject) => {
      setProject(p);
      setSellpointDraft(savedSellpointsText(p));
      localStorage.setItem(STORAGE_KEY, p.id);
      setPromptSelectionKeys((prev) => pruneDetailPageSuitePromptSelection(p, prev));
      syncActiveGenFromProject(p);
      syncImageModelFromProject(p);
    },
    [syncActiveGenFromProject, syncImageModelFromProject],
  );

  const loadProject = useCallback(
    async (id: string) => {
      const p = await getDetailPageSuiteHitProject(id);
      applyHitProject(p);
    },
    [applyHitProject],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await fetchDetailPageSuiteHitModels();
        if (cancelled) return;
        setImageModels(models.imageModels);
        setChatModelKey(models.defaults.chat);
        setVisionModelKey(models.defaults.chat);
        setImageModelKey(
          pickBoundStoryboardModelKey(models.imageModels, models.defaults.image),
        );
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          await loadProject(saved);
        } else {
          const created = await createDetailPageSuiteHitProject();
          if (!cancelled) {
            applyHitProject(created);
            setPromptSelectionKeys(new Set());
          }
        }
      } catch (e) {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
        else {
          await alert({
            title: "加载失败",
            message: e instanceof Error ? e.message : "未知错误",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alert, loadProject, applyHitProject]);

  const stopRewritePoll = useCallback(() => {
    if (rewritePollRef.current) {
      clearInterval(rewritePollRef.current);
      rewritePollRef.current = null;
    }
  }, []);

  const pollRewriteProject = useCallback(
    async (projectId: string) => {
      try {
        const p = await getDetailPageSuiteHitProject(projectId);
        setProject(p);
        const status = p.meta?.hitStatus;
        if (status === "ready") {
          stopRewritePoll();
          setRewriting(false);
          setPromptSelectionKeys(new Set());
          toast({ title: "原创文案与 Prompt 已生成" });
          return;
        }
        if (status === "decomposed" && p.meta?.hitError) {
          stopRewritePoll();
          setRewriting(false);
          await alert({
            title: "生成失败",
            message: p.meta.hitError,
            variant: "error",
          });
          return;
        }
        if (status === "error") {
          stopRewritePoll();
          setRewriting(false);
        }
      } catch {
        /* 下一轮轮询重试 */
      }
    },
    [alert, stopRewritePoll, toast],
  );

  const stopVisionSellpointPoll = useCallback(() => {
    if (visionPollRef.current) {
      clearInterval(visionPollRef.current);
      visionPollRef.current = null;
    }
  }, []);

  const applyVisionSellpointPollResult = useCallback(
    (p: DetailPageSuiteProject) => {
      setProject(p);
      const job = readHitVisionSellpointJob(p.meta);
      if (job?.status === "done") {
        stopVisionSellpointPoll();
        setVisionBusy(false);
        setSellpointDraft(p.brief?.sellPoints?.map((s) => s.text).join("\n") ?? "");
        void toast({ title: "识图卖点已更新" });
        return;
      }
      if (job?.status === "error") {
        stopVisionSellpointPoll();
        setVisionBusy(false);
        void alert({
          title: "识图失败",
          message: job.error ?? job.progress?.detail ?? "未知错误",
          variant: "error",
        });
      }
    },
    [alert, stopVisionSellpointPoll, toast],
  );

  const startVisionSellpointPoll = useCallback(
    (projectId: string) => {
      stopVisionSellpointPoll();
      visionPollRef.current = setInterval(() => {
        void getDetailPageSuiteHitProject(projectId)
          .then(applyVisionSellpointPollResult)
          .catch(() => undefined);
      }, 800);
    },
    [applyVisionSellpointPollResult, stopVisionSellpointPoll],
  );

  const applyDecomposeSuccess = useCallback(
    (p: DetailPageSuiteProject) => {
      applyHitProject(p);
    },
    [applyHitProject],
  );

  const startHitDecomposeBackgroundJob = useCallback(
    (
      projectId: string,
      fireOpts?: { visionModelKey?: string; chatModelKey?: string; fire?: boolean },
    ) => {
      const taskId = detailPageSuiteHitDecomposeTaskId(projectId);
      const existing = backgroundGen.tasks.find((t) => t.id === taskId);
      const wasRunning = existing?.status === "running";

      if (existing && existing.status !== "running") {
        if (fireOpts?.fire === false) return;
        backgroundGen.dismissTask(taskId);
      }

      backgroundGen.registerTask({
        id: taskId,
        label: "爆款套图 · 拆解",
        hint: "结构 + 叙事 + 氛围",
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        expectedDurationMs: DETAIL_PAGE_SUITE_HIT_DECOMPOSE_EXPECTED_MS,
        status: wasRunning ? "running" : undefined,
        minimized: existing?.minimized,
        poll: async () => {
          try {
            const p = await getDetailPageSuiteHitProject(projectId);
            applyHitProject(p);
            const err = hitDecomposeFailMessage(p.meta);
            if (err) return { status: "failed" as const, error: err };
            if (isHitDecomposeDone(p.meta) && p.meta?.hitStatus !== "polishing") {
              return { status: "succeeded" as const };
            }
            return { status: "running" as const };
          } catch {
            return { status: "running" as const };
          }
        },
        onSucceeded: async () => {
          const p = await getDetailPageSuiteHitProject(projectId);
          applyDecomposeSuccess(p);
          setDecomposing(false);
          await toast({ variant: "success", title: "拆解完成" });
        },
        onFailed: async () => {
          setDecomposing(false);
          try {
            const p = await getDetailPageSuiteHitProject(projectId);
            applyHitProject(p);
            const err = hitDecomposeFailMessage(p.meta);
            if (err) {
              await alert({ title: "拆解失败", message: err, variant: "error" });
            }
          } catch (e) {
            await alert({
              title: "拆解失败",
              message: e instanceof Error ? e.message : "未知错误",
              variant: "error",
            });
          }
        },
      });

      if (fireOpts?.fire === false || wasRunning) return;

      void decomposeDetailPageSuiteHit(projectId, {
        visionModelKey: fireOpts?.visionModelKey,
        chatModelKey: fireOpts?.chatModelKey,
        async: true,
      }).catch(async (e) => {
        if (!backgroundGen.tasks.some((t) => t.id === taskId && t.status === "running")) {
          return;
        }
        try {
          const p = await getDetailPageSuiteHitProject(projectId);
          applyHitProject(p);
          if (isHitDecomposeInFlight(p.meta)) {
            toast({
              title: "连接中断，拆解仍在后台进行",
              message: "进度见右下角 Dock，请勿重复提交。",
            });
            return;
          }
          const err =
            hitDecomposeFailMessage(p.meta) ??
            (e instanceof Error ? e.message : "拆解失败");
          backgroundGen.failTask(taskId, err);
          await alert({ title: "拆解失败", message: err, variant: "error" });
        } catch (inner) {
          backgroundGen.failTask(
            taskId,
            inner instanceof Error ? inner.message : "拆解失败",
          );
        }
      });
    },
    [alert, applyDecomposeSuccess, applyHitProject, backgroundGen, toast],
  );

  useEffect(() => {
    if (!project?.id) return;
    if (isVisionSellpointJobRunning(readHitVisionSellpointJob(project.meta))) {
      setVisionBusy(true);
      if (!visionPollRef.current) startVisionSellpointPoll(project.id);
    }
  }, [project?.id, project?.meta?.hitVisionSellpoint?.status, startVisionSellpointPoll]);

  useEffect(() => {
    return () => stopVisionSellpointPoll();
  }, [stopVisionSellpointPoll]);

  useEffect(() => {
    if (!project?.id) return;
    if (project.meta?.hitStatus === "decomposing") {
      startHitDecomposeBackgroundJob(project.id, { fire: false });
    }
    if (project.meta?.hitStatus !== "polishing") {
      stopRewritePoll();
      setRewriting(false);
      return;
    }
    setRewriting(true);
    void pollRewriteProject(project.id);
    rewritePollRef.current = setInterval(() => {
      void pollRewriteProject(project.id);
    }, 800);
    return () => stopRewritePoll();
  }, [
    pollRewriteProject,
    project?.id,
    project?.meta?.hitStatus,
    startHitDecomposeBackgroundJob,
    stopRewritePoll,
  ]);

  const refsByRole = useMemo(() => {
    if (!project) return { suite: [], product: [], model: [] };
    return {
      suite: project.references.filter((r) => r.role === "reference_suite"),
      product: project.references.filter((r) => r.role === "product"),
      model: project.references.filter((r) => r.role === "model"),
    };
  }, [project]);

  async function handleUpload(role: HitUploadRole, files: File[]) {
    if (!project || files.length === 0) return;
    setUploadingRole(role);
    setUploadProgress(10);
    setUploadProgressLabel(
      files.length > 1
        ? `正在上传 1/${files.length}：${files[0]?.name ?? "图片"}`
        : `正在上传：${files[0]?.name ?? "图片"}`,
    );
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
    }, 180);
    try {
      let next = project;
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setUploadProgressLabel(
          files.length > 1
            ? `正在上传 ${i + 1}/${files.length}：${file.name}`
            : `正在上传：${file.name}`,
        );
        if (files.length > 1) {
          setUploadProgress(Math.min(88, 10 + Math.round(((i + 1) / files.length) * 78)));
        }
        next = await uploadDetailPageSuiteHitRef(project.id, file, { role });
      }
      setProject(next);
      setUploadProgress(100);
      setUploadProgressLabel("上传完成");
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      window.clearInterval(tick);
      setUploadingRole(null);
      window.setTimeout(() => {
        setUploadProgress(null);
        setUploadProgressLabel(undefined);
      }, 450);
    }
  }

  async function handleRemoveRef(id: string) {
    if (!project) return;
    const next = project.references.filter((r) => r.id !== id);
    const updated = await updateDetailPageSuiteHitProject(project.id, {
      references: next,
    });
    setProject(updated);
  }

  async function handleAttachModelFromLibrary(entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) {
    if (!project) return;
    const existing = project.references.filter((r) => r.role === "model");
    if (existing.length >= HIT_MODEL_REF_MAX) {
      await alert({
        title: "已达上限",
        message: `模特参考最多 ${HIT_MODEL_REF_MAX} 张`,
        variant: "error",
      });
      return;
    }
    setUploadingRole("model");
    setUploadProgress(null);
    setUploadProgressLabel("正在从模特库导入…");
    try {
      const newRef = {
        id: crypto.randomUUID(),
        label: entry.name.slice(0, 40) || "模特图",
        role: "model" as const,
        ossUrl: entry.ossUrl,
      };
      const updated = await updateDetailPageSuiteHitProject(project.id, {
        references: [
          ...project.references.filter((r) => r.role !== "model"),
          ...[...existing, newRef].slice(-HIT_MODEL_REF_MAX),
        ],
      });
      setProject(updated);
    } catch (e) {
      await alert({
        title: "模特库导入失败",
        message: e instanceof Error ? e.message : "无法从模特库添加",
        variant: "error",
      });
    } finally {
      setUploadingRole(null);
      setUploadProgressLabel(undefined);
    }
  }

  async function saveSellpointsFromDraft() {
    if (!project) return;
    const lines = sellpointDraft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const sellPoints = lines.map((text, i) => ({
      id: project.brief?.sellPoints?.[i]?.id ?? `sp-${i}`,
      text,
      source: "user" as const,
    }));
    const updated = await updateDetailPageSuiteHitProject(project.id, {
      brief: { ...(project.brief ?? {}), sellPoints },
    });
    setProject(updated);
  }

  async function ensureSellpointsSavedBeforeAction(): Promise<boolean> {
    if (!project) return false;
    if (!isSellpointDraftDirty(project, sellpointDraft)) return true;
    const shouldSave = await confirm({
      title: "卖点尚未保存",
      message:
        "文本框中的卖点尚未写入项目。是否先保存再继续？选择「不保存，继续」将丢弃未保存的修改。",
      confirmLabel: "先保存",
      cancelLabel: "不保存，继续",
    });
    if (shouldSave) {
      await saveSellpointsFromDraft();
      return true;
    }
    setSellpointDraft(savedSellpointsText(project));
    return true;
  }

  async function handleVisionSellpoints() {
    if (!project || visionBusy) return;
    if (isVisionSellpointJobRunning(readHitVisionSellpointJob(project.meta))) {
      startVisionSellpointPoll(project.id);
      return;
    }
    setVisionBusy(true);
    try {
      const updated = await visionDetailPageSuiteHitSellpoints(project.id, visionModelKey, {
        async: true,
      });
      applyVisionSellpointPollResult(updated);
      const job = readHitVisionSellpointJob(updated.meta);
      if (job?.status === "running") {
        startVisionSellpointPoll(project.id);
      }
    } catch (e) {
      if (e instanceof DetailPageSuiteHitInFlightError) {
        setProject(e.project);
        setVisionBusy(true);
        startVisionSellpointPoll(project.id);
        return;
      }
      setVisionBusy(false);
      await alert({
        title: "识图失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    }
  }

  async function handleDecompose() {
    if (!project || decomposeLockRef.current) return;
    if (isHitDecomposeInFlight(project.meta)) {
      toast({
        title: "拆解仍在进行",
        message: "进度见右下角 Dock；约 3 分钟后可最小化继续编辑。",
      });
      backgroundGen.expandDock();
      return;
    }
    decomposeLockRef.current = true;
    await saveSellpointsFromDraft();
    setDecomposing(true);
    try {
      startHitDecomposeBackgroundJob(project.id, {
        visionModelKey,
        chatModelKey: chatModelKey || undefined,
        fire: true,
      });
      const refreshed = await getDetailPageSuiteHitProject(project.id).catch(() => null);
      if (refreshed) setProject(refreshed);
      toast({
        title: "已开始拆解",
        message: "只学结构与氛围，不复制竞品图文。进度可在页面或右下角查看。",
      });
    } catch (e) {
      if (e instanceof DetailPageSuiteHitInFlightError) {
        setProject(e.project);
        startHitDecomposeBackgroundJob(project.id, { fire: false });
        toast({ title: "拆解已在进行", message: "请勿重复提交；见右下角 Dock。" });
        return;
      }
      await alert({
        title: "拆解失败",
        message: /连接中断|upstream|fetch failed/i.test(e instanceof Error ? e.message : "")
          ? formatEcomTransportError(e)
          : e instanceof Error
            ? e.message
            : "未知错误",
        variant: "error",
      });
      setDecomposing(false);
    } finally {
      decomposeLockRef.current = false;
    }
  }

  async function handleRewrite() {
    if (!project || rewriteLockRef.current) return;
    if (isHitDecomposeInFlight(project.meta)) {
      toast({ title: "任务进行中", message: "请稍候，页面会自动刷新进度。" });
      return;
    }
    if (!savedSellpointsText(project).trim() && !sellpointDraft.trim()) {
      await alert({
        title: "请先填写新品卖点",
        message: "原创文案以新品卖点为主体，未填写时不会生成。",
        variant: "error",
      });
      return;
    }
    rewriteLockRef.current = true;
    await saveSellpointsFromDraft();
    setProject((p) =>
      p
        ? {
            ...p,
            meta: { ...(p.meta ?? {}), hitError: undefined },
          }
        : p,
    );
    setRewriting(true);
    try {
      const updated = await rewriteDetailPageSuiteHit(project.id, {
        chatModelKey,
        async: true,
      });
      setProject(updated);
      if (updated.meta?.hitStatus !== "polishing") {
        setRewriting(false);
        if (updated.meta?.hitStatus === "ready") {
          toast({ title: "原创文案与 Prompt 已生成" });
        }
      }
    } catch (e) {
      if (e instanceof DetailPageSuiteHitInFlightError) {
        setProject(e.project);
        setRewriting(true);
        toast({ title: "生成已在进行", message: "进度将自动同步，请勿重复提交。" });
        return;
      }
      setRewriting(false);
      await alert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      rewriteLockRef.current = false;
    }
  }

  function handleTemplateChange(next: HitTemplate) {
    if (!project) return;
    setProject({
      ...project,
      meta: { ...(project.meta ?? {}), hitTemplate: next },
    });
    if (templateSaveTimer.current) clearTimeout(templateSaveTimer.current);
    templateSaveTimer.current = setTimeout(() => {
      void saveDetailPageSuiteHitTemplate(project.id, next)
        .then((updated) => setProject(updated))
        .catch(async (e) => {
          await alert({
            title: "保存结构失败",
            message: e instanceof Error ? e.message : "未知错误",
            variant: "error",
          });
        });
    }, 400);
  }

  async function handleResetTemplate() {
    if (!project) return;
    try {
      const updated = await resetDetailPageSuiteHitTemplate(project.id);
      setProject(updated);
      toast({ title: "已重置为 AI 拆解结构" });
    } catch (e) {
      await alert({
        title: "重置失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    }
  }

  async function persistImageModelSettings(modelKey: string) {
    if (!project) return;
    const updated = await updateDetailPageSuiteHitProject(project.id, {
      settings: { ...project.settings, imageModelKey: modelKey },
    });
    setProject(updated);
  }

  async function runImageGen(
    moduleId?: string,
    slotKeys?: string[],
    modelKeyOverride?: string,
  ) {
    if (!project) return;
    const effectiveModelKey = (modelKeyOverride ?? imageModelKey).trim();
    if (!effectiveModelKey) {
      await alert({
        title: "请选择出图模型",
        message: "点击工具栏「选择生图模型与参数」后再出图。",
        variant: "error",
      });
      return;
    }
    if (refsByRole.product.length === 0) {
      await alert({
        title: "请先上传新品产品图",
        message: "出图只使用自有新品与模特素材，不会调用竞品截图。",
        variant: "error",
      });
      return;
    }
    const excludeKeys = resolveDetailPageSuiteBusyImageGenExcludeKeys(
      project,
      activeGenSlotKeys,
    );
    const keys =
      slotKeys ??
      resolveDetailPageSuiteImageGenSlotKeys(project, promptSelectionKeys, {
        moduleId,
        excludeKeys,
      });
    if (keys.length === 0) {
      await alert({
        title: "请先勾选要出图的点位",
        message: moduleId
          ? "请在本模块内勾选至少一个有提示词的点位。"
          : "在下方模块格子中勾选至少一个点位。",
        variant: "error",
      });
      return;
    }
    setActiveGenSlotKeys((prev) => new Set([...prev, ...keys]));
    setImageModelKey(effectiveModelKey);
    try {
      await persistImageModelSettings(effectiveModelKey);
      const includeSlotCopyOnImage = project.settings.hitIncludeSlotCopyOnImage === true;
      const result = await generateDetailPageSuiteHitImages(project.id, {
        moduleId,
        slotKeys: keys,
        modelKey: effectiveModelKey,
        includeSlotCopyOnImage,
      });
      setProject(result.project);
      syncActiveGenFromProject(result.project);
      if (result.failures.length > 0) {
        await alert({
          title: "部分出图失败",
          message: result.failures.slice(0, 5).join("\n"),
          variant: "error",
        });
      } else {
        toast({ title: `已生成 ${result.generated} 张` });
      }
    } catch (e) {
      syncActiveGenFromProject(project);
      await alert({
        title: "出图失败",
        message: formatEcomImageGenUserMessage(
          e instanceof Error ? e.message : "出图失败",
        ),
        variant: "error",
      });
    }
  }

  if (needLogin) return <EcomLoginPrompt />;
  if (loading || !project) return <ProductCreationStudioSkeleton />;

  function uploadCardProgress(role: HitUploadRole) {
    const active = uploadingRole === role;
    return {
      busy: uploadBusy || hitBusy,
      showUploadProgress:
        active && (uploadProgress != null || Boolean(uploadProgressLabel)),
      uploadProgress: active ? uploadProgress : null,
      uploadProgressLabel: active ? uploadProgressLabel : undefined,
    };
  }

  const chromeProjectHandlers = {
    onNewProject: async () => {
      if (!project) return;
      await runEcomNewProjectWithSavePrompt({
        confirm,
        hasWorkToSave: Boolean(project),
        save: async () => {
          await saveSellpointsFromDraft();
        },
        onProceed: async () => {
          const created = await createDetailPageSuiteHitProject();
          applyHitProject(created);
          setPromptSelectionKeys(new Set());
        },
      });
    },
    loadProjectList: async () => {
      const items = await listDetailPageSuiteHitSummaries();
      return items.map((it) => ({
        id: it.id,
        title: it.title?.trim() || "爆款详情页套图",
        updatedAt: it.updatedAt,
        thumbnailUrl: it.thumbnailUrl,
      }));
    },
    onOpenProject: (id: string) => void loadProject(id),
    onDeleteProject: async () => {
      if (
        !(await doubleConfirm({
          title: "删除当前爆款详情页套图项目？",
          message: "将删除本项目在云端保存的配置。",
          secondTitle: "确认不可恢复删除？",
          secondMessage: "删除后无法恢复；已生成的图片仍保留在「我的资产」中。",
          confirmLabel: "删除",
        }))
      ) {
        return;
      }
      await deleteDetailPageSuiteHitProject(project.id);
      const created = await createDetailPageSuiteHitProject();
      applyHitProject(created);
      setPromptSelectionKeys(new Set());
    },
    onPickImageModel: () => {
      setImagePickerModuleId(undefined);
      setImagePickerIntent("settings");
      setImagePickerOpen(true);
    },
    onExportPack: async () => {
      setExportPackBusy(true);
      try {
        await downloadDetailPageSuiteHitExportZip(project.id);
        toast({ title: "素材包已开始下载" });
      } catch (e) {
        await alert({
          title: "导出失败",
          message: e instanceof Error ? e.message : "未知错误",
          variant: "error",
        });
      } finally {
        setExportPackBusy(false);
      }
    },
    exportPackBusy,
  };

  return (
    <EcomWorkspaceLayout fullWidth contentClassName="min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <DetailPageSuiteWorkbenchChrome
          project={project}
          variant="hit"
          llmBusy={hitBusy || uploadBusy}
          {...chromeProjectHandlers}
        />
        <div className="ecom-scrollbar-overlay min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
          <div className="border-b border-[#e8e8ed] bg-[#fff8e8] px-5 py-2 text-[11px] text-[#6e4b00]">
            {HIT_COMPLIANCE_COPY}
          </div>
          <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-5 py-4">
            <h1 className="mb-3 text-base font-semibold text-[#1d1d1f]">上传与拆解</h1>
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <EcomRefUploadCard
                title="竞品详情长截图"
                items={refsByRole.suite.map((r) => ({
                  id: r.id,
                  ossUrl: r.ossUrl,
                  label: r.label,
                  kind: "image" as const,
                }))}
                emptyHint="必填 · 淘宝完整滚动详情长图，仅用于学结构"
                multiple={false}
                {...uploadCardProgress("reference_suite")}
                onUploadFiles={(files) => void handleUpload("reference_suite", files)}
                onOpenFilePicker={() => suiteFileInputRef.current?.click()}
                inputRef={suiteFileInputRef}
                onRemove={(id) => void handleRemoveRef(id)}
                onPreviewItem={(item) => setPreviewUrl(item.ossUrl)}
              />
              <EcomRefUploadCard
                title="新品产品图"
                items={refsByRole.product.map((r) => ({
                  id: r.id,
                  ossUrl: r.ossUrl,
                  label: r.label,
                  kind: "image" as const,
                }))}
                emptyHint="出图必填 · 自有新品实拍，不使用竞品图"
                multiple
                {...uploadCardProgress("product")}
                onUploadFiles={(files) => void handleUpload("product", files)}
                onOpenFilePicker={() => productFileInputRef.current?.click()}
                inputRef={productFileInputRef}
                onRemove={(id) => void handleRemoveRef(id)}
                onPreviewItem={(item) => setPreviewUrl(item.ossUrl)}
              />
              <EcomRefUploadCard
                title="模特图（可选）"
                items={refsByRole.model.map((r) => ({
                  id: r.id,
                  ossUrl: r.ossUrl,
                  label: r.label,
                  kind: "image" as const,
                }))}
                emptyHint="可选 · 上传或从模特库导入"
                multiple
                {...uploadCardProgress("model")}
                onUploadFiles={(files) => void handleUpload("model", files)}
                onOpenFilePicker={() => modelFileInputRef.current?.click()}
                inputRef={modelFileInputRef}
                onRemove={(id) => void handleRemoveRef(id)}
                onPreviewItem={(item) => setPreviewUrl(item.ossUrl)}
                headerActions={
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={
                      uploadBusy ||
                      hitBusy ||
                      refsByRole.model.length >= HIT_MODEL_REF_MAX
                    }
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => setModelLibraryOpen(true)}
                  >
                    <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                    模特库导入
                  </EcomButtonSecondary>
                }
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-[#1d1d1f]">
                新品核心卖点（每行一条）
              </label>
              <textarea
                className="min-h-[88px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                value={sellpointDraft}
                onChange={(e) => setSellpointDraft(e.target.value)}
                placeholder="手填新品卖点，或点击下方识图。文案将以此为主体原创重写。"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <EcomButtonSecondary
                  size="sm"
                  disabled={visionBusy || hitBusy}
                  onClick={() => void handleVisionSellpoints()}
                >
                  AI 识图卖点
                </EcomButtonSecondary>
                <EcomButtonPrimary
                  size="sm"
                  disabled={hitBusy || refsByRole.suite.length === 0}
                  onClick={() => void handleDecompose()}
                >
                  {hitBusy && decomposing ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  拆解爆款范式
                </EcomButtonPrimary>
              </div>
            </div>
            {project.meta?.hitError &&
            !bottomTask.active &&
            !isHitDecomposeInFlight(project.meta) &&
            !rewriting ? (
              <p className="text-sm text-red-600">{project.meta.hitError}</p>
            ) : null}
            {project.meta?.hitWarning ? (
              <p className="mt-2 text-xs text-amber-800">{project.meta.hitWarning}</p>
            ) : null}
            <p className="mt-2 text-[11px] text-[#86868b]">
              拆解仅依赖竞品长图；新品图/模特用于识图卖点与出图，可在拆解后补传。
            </p>
          </div>

          {template ? (
            <>
              <DetailPageSuiteHitComponentEditor
                template={template}
                busy={hitBusy}
                rewriteBusy={rewriting}
                onChange={handleTemplateChange}
                onReset={() => void handleResetTemplate()}
                onRewrite={() => void handleRewrite()}
              />
            </>
          ) : null}

          <DetailPageSuiteContentPanel
            variant="hit"
            hideHeader
            project={project}
            llmBusy={hitBusy || uploadBusy}
            uploading={uploadBusy}
            activeGenSlotKeys={activeGenSlotKeys}
            promptSelectionKeys={promptSelectionKeys}
            onTogglePromptSelection={(key) => {
              setPromptSelectionKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onToggleAllPromptSelection={(selected) => {
              if (!project) return;
              if (!selected) setPromptSelectionKeys(new Set());
              else setPromptSelectionKeys(allPromptTargetKeys(project));
            }}
            onGenerateModuleImages={(moduleId) => {
              setImagePickerModuleId(moduleId);
              setImagePickerIntent("generate");
              setImagePickerOpen(true);
            }}
            onUploadFiles={() => {}}
            onAttachAssets={() => {}}
            onRemoveRef={() => {}}
            onPreview={(url) => setPreviewUrl(url)}
            onPreviewSlotImage={setSlotImagePreview}
            hitIncludeSlotCopyOnImage={project.settings.hitIncludeSlotCopyOnImage === true}
            onHitIncludeSlotCopyOnImageChange={(checked) => {
              void (async () => {
                if (!project) return;
                setProject({
                  ...project,
                  settings: { ...project.settings, hitIncludeSlotCopyOnImage: checked },
                });
                try {
                  const updated = await updateDetailPageSuiteHitProject(project.id, {
                    settings: { ...project.settings, hitIncludeSlotCopyOnImage: checked },
                  });
                  setProject(updated);
                } catch (e) {
                  await alert({
                    title: "保存出图选项失败",
                    message: e instanceof Error ? e.message : "未知错误",
                    variant: "error",
                  });
                }
              })();
            }}
            onOpenPromptEdit={(moduleId, slotKey, prompt, label, slotCopy) => {
              if (isDetailPageSuiteSizeChartDataLabel(label)) {
                setSizeChartEdit({ moduleId, slotKey, label });
                return;
              }
              setPromptEdit({ moduleId, slotKey, prompt, label, slotCopy });
            }}
            onToggleModule={() => {}}
            onChangeCount={() => {}}
            onToggleItem={() => {}}
            onRequestAddItem={() => {}}
            onRequestAddSlot={(moduleId) => {
              void (async () => {
                if (!(await ensureSellpointsSavedBeforeAction())) return;
                const check = canAddCustomSuiteSlot(project.suite, moduleId);
                if (!check.ok) {
                  await alert({
                    title: "无法新增点位",
                    message: check.reason,
                    variant: "error",
                  });
                  return;
                }
                if (moduleId === DETAIL_PAGE_SUITE_SIZE_MODULE_ID) {
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
                    const updated = await updateDetailPageSuiteHitProject(project.id, {
                      brief,
                      suite: { ...project.suite, modules },
                    });
                    setProject(updated);
                    toast({ title: "已新增尺码数据表点位" });
                  } catch (e) {
                    await alert({
                      title: "新增失败",
                      message: e instanceof Error ? e.message : "未知错误",
                      variant: "error",
                    });
                  }
                  return;
                }
                setAddSlotDialog({ moduleId });
              })();
            }}
            onPickImageModel={chromeProjectHandlers.onPickImageModel}
            onNewProject={chromeProjectHandlers.onNewProject}
            loadProjectList={chromeProjectHandlers.loadProjectList}
            onOpenProject={chromeProjectHandlers.onOpenProject}
            onDeleteProject={chromeProjectHandlers.onDeleteProject}
          />
        </div>

        <EcomWorkbenchBottomTaskDock
          placement="workspace"
          active={bottomTask.active}
          title={bottomTask.title}
          detail={bottomTask.detail}
          progress={bottomTask.progress}
        />
      </div>

      <EcomModelLibraryPickerDialog
        open={modelLibraryOpen}
        onOpenChange={setModelLibraryOpen}
        closeOnPick={false}
        onPick={(entry) => handleAttachModelFromLibrary(entry)}
      />

      <StoryboardModelPickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        mode="image"
        models={imageModels}
        value={imageModelKey}
        onChange={setImageModelKey}
        confirmLabel={imagePickerIntent === "settings" ? "保存设置" : "开始生图"}
        onConfirm={(modelKey) => {
          setImageModelKey(modelKey);
          setImagePickerOpen(false);
          void (async () => {
            try {
              await persistImageModelSettings(modelKey);
              if (imagePickerIntent === "generate") {
                await runImageGen(imagePickerModuleId, undefined, modelKey);
              } else {
                toast({ title: "生图模型已保存" });
              }
            } catch (e) {
              await alert({
                title: "保存失败",
                message: e instanceof Error ? e.message : "未知错误",
                variant: "error",
              });
            }
          })();
        }}
      />

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
              await alert({
                title: "无法新增点位",
                message: check.reason,
                variant: "error",
              });
              return;
            }
            setAddSlotSaving(true);
            try {
              const modules = project.suite.modules.map((m) =>
                m.module_id === addSlotDialog.moduleId
                  ? addCustomPromptSlotToModule(m, promptText)
                  : m,
              );
              const updated = await updateDetailPageSuiteHitProject(project.id, {
                suite: { ...project.suite, modules },
              });
              setProject(updated);
              setAddSlotDialog(null);
              toast({ title: "已新增点位，可勾选后出图" });
            } catch (e) {
              await alert({
                title: "添加失败",
                message: e instanceof Error ? e.message : "未知错误",
                variant: "error",
              });
            } finally {
              setAddSlotSaving(false);
            }
          }}
        />
      ) : null}

      <DetailPageSuiteSlotPromptEditDialog
        open={Boolean(promptEdit)}
        title={promptEdit?.label ?? "编辑提示词"}
        prompt={promptEdit?.prompt ?? ""}
        slotCopy={promptEdit?.slotCopy ?? ""}
        showSlotCopyField
        onOpenChange={(open) => {
          if (!open) setPromptEdit(null);
        }}
        onSave={async (prompt, slotCopy) => {
          if (!promptEdit || !project) return;
          const modules = project.suite.modules.map((m) => {
            if (m.module_id !== promptEdit.moduleId) return m;
            return {
              ...m,
              slots: m.slots.map((s) => {
                if (s.item_key !== promptEdit.slotKey) return s;
                const next = {
                  ...s,
                  positive_prompt: prompt,
                  promptEdited: true,
                };
                if (slotCopy !== undefined) {
                  return {
                    ...next,
                    ...(slotCopy ? { slot_copy: slotCopy } : { slot_copy: undefined }),
                  };
                }
                return next;
              }),
            };
          });
          const updated = await updateDetailPageSuiteHitProject(project.id, {
            suite: { ...project.suite, modules },
          });
          setProject(updated);
          setPromptEdit(null);
        }}
      />

      <EcomImagePreviewDialog
        open={Boolean(previewUrl)}
        src={previewUrl ?? ""}
        onOpenChange={() => setPreviewUrl(null)}
      />
      <EcomImagePreviewDialog
        open={Boolean(slotImagePreview)}
        src={slotImagePreview?.src ?? ""}
        title={slotImagePreview?.title}
        items={slotImagePreview?.items}
        initialIndex={slotImagePreview?.initialIndex}
        onOpenChange={() => setSlotImagePreview(null)}
      />

      {sizeChartEdit && project ? (
        <DetailPageSuiteSizeChartEditDialog
          open
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
              const updated = await updateDetailPageSuiteHitProject(project.id, { brief });
              setProject(updated);
              setSizeChartEdit(null);
              toast({ title: "尺码表已保存" });
            } catch (e) {
              await alert({
                title: "保存失败",
                message: e instanceof Error ? e.message : "未知错误",
                variant: "error",
              });
            } finally {
              setSizeChartEditSaving(false);
            }
          }}
        />
      ) : null}

    </EcomWorkspaceLayout>
  );
}

export function DetailPageSuiteHitStudio() {
  return (
    <BackgroundGenerationProvider>
      <DetailPageSuiteHitStudioInner />
    </BackgroundGenerationProvider>
  );
}
