"use client";

import { Loader2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
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
import { EcomLinearProgressLabel } from "@/components/media/ecom-linear-progress-label";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  addCustomPromptSlotToModule,
  addSizeChartDataSlotToModule,
  canAddCustomSuiteSlot,
  DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
} from "@/lib/detail-page-suite-add-custom-slot";
import { downloadDetailPageSuiteReplicaExportZip } from "@/lib/detail-page-suite-export-download";
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
import { listDetailPageSuitePendingImageKeys } from "@/lib/detail-page-suite-pending";
import {
  detailPageSuiteProjectSlotHasImage,
  listDetailPageSuitePromptGenTargets,
  pruneDetailPageSuitePromptSelection,
  resolveDetailPageSuiteBusyImageGenExcludeKeys,
  resolveDetailPageSuiteImageGenSlotKeys,
} from "@/lib/detail-page-suite-prompt-selection";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import {
  assignDetailPageSuiteReplicaSegmentModule,
  createDetailPageSuiteReplicaProject,
  decomposeDetailPageSuiteReplica,
  DetailPageSuiteReplicaDecomposeInFlightError,
  DetailPageSuiteReplicaVisionSellpointInFlightError,
  deleteDetailPageSuiteReplicaProject,
  fetchDetailPageSuiteReplicaModels,
  generateDetailPageSuiteReplicaImages,
  generateDetailPageSuiteReplicaPrompts,
  getDetailPageSuiteReplicaProject,
  listDetailPageSuiteReplicaSummaries,
  updateDetailPageSuiteReplicaProject,
  uploadDetailPageSuiteReplicaRef,
  visionDetailPageSuiteReplicaSellpoints,
} from "@/lib/ecom-detail-page-suite-replica-api";
import {
  DETAIL_PAGE_SUITE_REPLICA_DECOMPOSE_EXPECTED_MS,
  detailPageSuiteReplicaDecomposeTaskId,
  isReplicaDecomposeDone,
  replicaDecomposeFailMessage,
} from "@/lib/detail-page-suite-replica-decompose-job";
import {
  isReplicaDecomposeInFlight,
  replicaDecomposeStatusCopy,
} from "@/lib/detail-page-suite-replica-progress";
import {
  isVisionSellpointJobRunning,
  readReplicaVisionSellpointJob,
  visionSellpointProgressLabel,
  visionSellpointProgressPercent,
} from "@/lib/detail-page-suite-vision-sellpoint-progress";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const STORAGE_KEY = "ecom-detail-page-suite-replica-active-project";
/** 与 book-mall REPLICA_ROLE_LIMITS.model 一致 */
const REPLICA_MODEL_REF_MAX = 6;

function savedSellpointsText(project: DetailPageSuiteProject): string {
  return project.brief?.sellPoints?.map((s) => s.text).join("\n") ?? "";
}

function isSellpointDraftDirty(project: DetailPageSuiteProject, draft: string): boolean {
  return draft.trim() !== savedSellpointsText(project).trim();
}

function allPromptTargetKeys(project: DetailPageSuiteProject): Set<string> {
  return new Set(listDetailPageSuitePromptGenTargets(project).map((t) => t.key));
}

type PhaseAVisualDetail = {
  model?: string;
  garment?: string;
  background?: string;
  scene?: string;
  lighting?: string;
  pose?: string;
  props?: string;
  onImageText?: string;
};

type PhaseAModule = {
  module_id: string;
  detected?: boolean;
  coverageNote?: string;
  items?: Array<{
    item_label?: string;
    layoutHint?: string;
    referenceCopyHints?: string[] | string;
    visualDetail?: PhaseAVisualDetail;
  }>;
};

function formatReferenceCopyHints(raw: string[] | string | undefined): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  const t = String(raw).trim();
  if (!t) return [];
  return t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function formatVisualDetailLines(d: PhaseAVisualDetail | undefined): string[] {
  if (!d) return [];
  const labels: Array<[keyof PhaseAVisualDetail, string]> = [
    ["model", "模特"],
    ["garment", "服装"],
    ["background", "背景"],
    ["scene", "场景"],
    ["lighting", "光线"],
    ["pose", "姿态"],
    ["props", "道具"],
    ["onImageText", "图上文字"],
  ];
  return labels
    .map(([key, label]) => {
      const v = d[key]?.trim();
      return v ? `${label}：${v}` : null;
    })
    .filter(Boolean) as string[];
}

type ReplicaUploadRole = "reference_suite" | "product" | "model";

function readPhaseA(project: DetailPageSuiteProject): PhaseAModule[] | null {
  const raw = project.meta?.replicaPhaseA;
  if (!raw || typeof raw !== "object") return null;
  const modules = (raw as { modules?: unknown }).modules;
  return Array.isArray(modules) ? (modules as PhaseAModule[]) : null;
}

type InventorySegment = {
  segmentIndex?: number;
  item_key: string;
  item_label: string;
  layoutHint?: string;
  referenceCopyHints?: string[];
  visualDetail?: PhaseAVisualDetail;
};

function readReplicaInventory(project: DetailPageSuiteProject): InventorySegment[] | null {
  const raw = project.meta?.replicaInventory;
  if (!raw || typeof raw !== "object") return null;
  const segments = (raw as { segments?: unknown }).segments;
  return Array.isArray(segments) ? (segments as InventorySegment[]) : null;
}

function readReplicaSegmentMapping(
  project: DetailPageSuiteProject,
): Record<string, { module_id: string | null; source?: string; confidence?: string }> {
  const raw = project.meta?.replicaSegmentMapping;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<
    string,
    { module_id: string | null; source?: string; confidence?: string }
  >;
}

function defaultPromptModuleIds(modules: PhaseAModule[]): string[] {
  return modules
    .filter((m) => {
      if (m.module_id === "mod7_size_table") return m.detected === true;
      return m.detected === true && (m.items?.length ?? 0) > 0;
    })
    .map((m) => m.module_id);
}

function DetailPageSuiteReplicaStudioInner() {
  const { alert, confirm, doubleConfirm, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const [project, setProject] = useState<DetailPageSuiteProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const visionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadingRole, setUploadingRole] = useState<ReplicaUploadRole | null>(null);
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
  } | null>(null);
  const [addSlotDialog, setAddSlotDialog] = useState<{ moduleId: string } | null>(null);
  const [addSlotSaving, setAddSlotSaving] = useState(false);
  const [sellpointDraft, setSellpointDraft] = useState("");
  const suiteFileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const decomposeLockRef = useRef(false);
  const generateLockRef = useRef(false);
  const decomposePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseAInitRef = useRef<string | null>(null);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [exportPackBusy, setExportPackBusy] = useState(false);
  const [sizeChartEdit, setSizeChartEdit] = useState<{
    moduleId: string;
    slotKey: string;
    label: string;
  } | null>(null);
  const [sizeChartEditSaving, setSizeChartEditSaving] = useState(false);
  const [promptModuleIds, setPromptModuleIds] = useState<Set<string>>(() => new Set());
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);

  const phaseA = useMemo(() => (project ? readPhaseA(project) : null), [project]);
  const inventorySegments = useMemo(
    () => (project ? readReplicaInventory(project) : null),
    [project],
  );
  const segmentMapping = useMemo(
    () => (project ? readReplicaSegmentMapping(project) : {}),
    [project],
  );
  const modulePickOptions = useMemo(() => {
    const fromSuite = project?.suite?.modules ?? [];
    return fromSuite.map((m) => ({
      id: m.module_id,
      name: m.module_name,
    }));
  }, [project?.suite?.modules]);
  const [segmentAssignBusyKey, setSegmentAssignBusyKey] = useState<string | null>(null);
  const allPhaseAModuleIds = useMemo(
    () => phaseA?.map((m) => m.module_id) ?? [],
    [phaseA],
  );
  const decomposeDockTaskId = project ? detailPageSuiteReplicaDecomposeTaskId(project.id) : "";
  const decomposeDockRunning = backgroundGen.tasks.some(
    (t) => t.id === decomposeDockTaskId && t.status === "running",
  );
  const replicaBusy =
    decomposing ||
    generatingPrompts ||
    isReplicaDecomposeInFlight(project?.meta ?? null) ||
    (decomposeDockRunning && !backgroundGen.isTaskMinimized(decomposeDockTaskId));
  const decomposeProgressCopy = replicaDecomposeStatusCopy(project?.meta ?? null);
  const visionSellpointJob = readReplicaVisionSellpointJob(project?.meta ?? null);
  const showVisionSellpointProgress =
    visionBusy || isVisionSellpointJobRunning(visionSellpointJob);

  useEffect(() => {
    if (!project?.id || !phaseA?.length) return;
    if (phaseAInitRef.current === project.id) return;
    phaseAInitRef.current = project.id;
    setPromptModuleIds(new Set(defaultPromptModuleIds(phaseA)));
  }, [project?.id, phaseA]);

  const syncImageModelFromProject = useCallback((p: DetailPageSuiteProject) => {
    const saved = p.settings.imageModelKey?.trim();
    if (!saved) return;
    setImageModelKey(pickBoundStoryboardModelKey(imageModelsRef.current, saved));
  }, []);

  const syncActiveGenFromProject = useCallback((p: DetailPageSuiteProject) => {
    const next = new Set<string>();
    for (const key of listDetailPageSuitePendingImageKeys(p.meta)) {
      if (!detailPageSuiteProjectSlotHasImage(p, key)) next.add(key);
    }
    setActiveGenSlotKeys(next);
  }, []);

  const applyReplicaProject = useCallback((p: DetailPageSuiteProject) => {
    setProject(p);
    setSellpointDraft(savedSellpointsText(p));
    localStorage.setItem(STORAGE_KEY, p.id);
    setPromptSelectionKeys((prev) => pruneDetailPageSuitePromptSelection(p, prev));
    syncImageModelFromProject(p);
    syncActiveGenFromProject(p);
  }, [syncActiveGenFromProject, syncImageModelFromProject]);

  const loadProject = useCallback(
    async (id: string) => {
      const p = await getDetailPageSuiteReplicaProject(id);
      applyReplicaProject(p);
    },
    [applyReplicaProject],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await fetchDetailPageSuiteReplicaModels();
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
          const created = await createDetailPageSuiteReplicaProject();
          if (!cancelled) {
            applyReplicaProject(created);
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
  }, [alert, loadProject]);

  const stopDecomposePoll = useCallback(() => {
    if (decomposePollRef.current) {
      clearInterval(decomposePollRef.current);
      decomposePollRef.current = null;
    }
  }, []);

  const stopVisionSellpointPoll = useCallback(() => {
    if (visionPollRef.current) {
      clearInterval(visionPollRef.current);
      visionPollRef.current = null;
    }
  }, []);

  const applyVisionSellpointPollResult = useCallback(
    (p: DetailPageSuiteProject) => {
      setProject(p);
      const job = readReplicaVisionSellpointJob(p.meta);
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
        void getDetailPageSuiteReplicaProject(projectId)
          .then(applyVisionSellpointPollResult)
          .catch(() => undefined);
      }, 800);
    },
    [applyVisionSellpointPollResult, stopVisionSellpointPoll],
  );

  const applyDecomposeSuccess = useCallback(
    (p: DetailPageSuiteProject) => {
      applyReplicaProject(p);
      phaseAInitRef.current = null;
      const modules = readPhaseA(p);
      if (modules?.length) {
        setPromptModuleIds(new Set(defaultPromptModuleIds(modules)));
        phaseAInitRef.current = p.id;
      }
    },
    [applyReplicaProject],
  );

  const startReplicaDecomposeBackgroundJob = useCallback(
    (
      projectId: string,
      fireOpts?: { visionModelKey?: string; chatModelKey?: string; fire?: boolean },
    ) => {
      const taskId = detailPageSuiteReplicaDecomposeTaskId(projectId);
      const existing = backgroundGen.tasks.find((t) => t.id === taskId);
      const wasRunning = existing?.status === "running";

      if (existing && existing.status !== "running") {
        if (fireOpts?.fire === false) return;
        backgroundGen.dismissTask(taskId);
      }

      backgroundGen.registerTask({
        id: taskId,
        label: "详情页复刻 · 拆解",
        hint: "清单 + 分批归类",
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        expectedDurationMs: DETAIL_PAGE_SUITE_REPLICA_DECOMPOSE_EXPECTED_MS,
        status: wasRunning ? "running" : undefined,
        minimized: existing?.minimized,
        poll: async () => {
          try {
            const p = await getDetailPageSuiteReplicaProject(projectId);
            applyReplicaProject(p);
            const err = replicaDecomposeFailMessage(p.meta);
            if (err) return { status: "failed" as const, error: err };
            if (isReplicaDecomposeDone(p.meta)) return { status: "succeeded" as const };
            return { status: "running" as const };
          } catch {
            return { status: "running" as const };
          }
        },
        onSucceeded: async () => {
          const p = await getDetailPageSuiteReplicaProject(projectId);
          applyDecomposeSuccess(p);
          setDecomposing(false);
          await toast({ variant: "success", title: "拆解完成" });
        },
        onFailed: async () => {
          setDecomposing(false);
          try {
            const p = await getDetailPageSuiteReplicaProject(projectId);
            applyReplicaProject(p);
            const err = replicaDecomposeFailMessage(p.meta);
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

      void decomposeDetailPageSuiteReplica(projectId, {
        visionModelKey: fireOpts?.visionModelKey,
        chatModelKey: fireOpts?.chatModelKey,
        async: true,
      }).catch(async (e) => {
        if (!backgroundGen.tasks.some((t) => t.id === taskId && t.status === "running")) {
          return;
        }
        try {
          const p = await getDetailPageSuiteReplicaProject(projectId);
          applyReplicaProject(p);
          if (isReplicaDecomposeInFlight(p.meta)) {
            toast({
              title: "连接中断，拆解仍在后台进行",
              message: "进度见右下角 Dock，请勿重复提交。",
            });
            return;
          }
          const err =
            replicaDecomposeFailMessage(p.meta) ??
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
    [alert, applyDecomposeSuccess, applyReplicaProject, backgroundGen, toast],
  );

  const startReplicaTaskPoll = useCallback(
    (projectId: string, mode: "prompts") => {
      stopDecomposePoll();
      decomposePollRef.current = setInterval(() => {
        void getDetailPageSuiteReplicaProject(projectId)
          .then((p) => {
            setProject(p);
            const status = p.meta?.replicaStatus;
            if (mode === "prompts" && status === "ready") {
              stopDecomposePoll();
              setGeneratingPrompts(false);
              setPromptSelectionKeys(new Set());
              toast({ title: "Prompt 已生成" });
            } else if (status === "error") {
              stopDecomposePoll();
              setGeneratingPrompts(false);
            }
          })
          .catch(() => undefined);
      }, 2500);
    },
    [stopDecomposePoll, toast],
  );

  useEffect(() => {
    if (!project?.id) return;
    if (isVisionSellpointJobRunning(readReplicaVisionSellpointJob(project.meta))) {
      setVisionBusy(true);
      if (!visionPollRef.current) startVisionSellpointPoll(project.id);
    }
  }, [project?.id, project?.meta?.replicaVisionSellpoint?.status, startVisionSellpointPoll]);

  useEffect(() => {
    return () => stopVisionSellpointPoll();
  }, [stopVisionSellpointPoll]);

  useEffect(() => {
    if (!project?.id) return;
    if (project.meta?.replicaStatus === "decomposing") {
      startReplicaDecomposeBackgroundJob(project.id, { fire: false });
    }
    if (project.meta?.replicaStatus !== "polishing") {
      stopDecomposePoll();
      return;
    }
    startReplicaTaskPoll(project.id, "prompts");
    return () => stopDecomposePoll();
  }, [
    project?.id,
    project?.meta?.replicaStatus,
    startReplicaDecomposeBackgroundJob,
    startReplicaTaskPoll,
    stopDecomposePoll,
  ]);

  const refsByRole = useMemo(() => {
    if (!project) return { suite: [], product: [], model: [] };
    return {
      suite: project.references.filter((r) => r.role === "reference_suite"),
      product: project.references.filter((r) => r.role === "product"),
      model: project.references.filter((r) => r.role === "model"),
    };
  }, [project]);

  async function handleUpload(role: ReplicaUploadRole, files: File[]) {
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
        next = await uploadDetailPageSuiteReplicaRef(project.id, file, { role });
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
    const updated = await updateDetailPageSuiteReplicaProject(project.id, {
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
    if (existing.length >= REPLICA_MODEL_REF_MAX) {
      await alert({
        title: "已达上限",
        message: `模特参考最多 ${REPLICA_MODEL_REF_MAX} 张`,
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
      const updated = await updateDetailPageSuiteReplicaProject(project.id, {
        references: [
          ...project.references.filter((r) => r.role !== "model"),
          ...[...existing, newRef].slice(-REPLICA_MODEL_REF_MAX),
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
    const updated = await updateDetailPageSuiteReplicaProject(project.id, {
      brief: { ...(project.brief ?? {}), sellPoints },
    });
    setProject(updated);
  }

  async function handleVisionSellpoints() {
    if (!project || visionBusy) return;
    if (isVisionSellpointJobRunning(readReplicaVisionSellpointJob(project.meta))) {
      startVisionSellpointPoll(project.id);
      return;
    }
    setVisionBusy(true);
    try {
      const updated = await visionDetailPageSuiteReplicaSellpoints(project.id, visionModelKey, {
        async: true,
      });
      applyVisionSellpointPollResult(updated);
      const job = readReplicaVisionSellpointJob(updated.meta);
      if (job?.status === "running") {
        startVisionSellpointPoll(project.id);
      }
    } catch (e) {
      if (e instanceof DetailPageSuiteReplicaVisionSellpointInFlightError) {
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
    if (isReplicaDecomposeInFlight(project.meta)) {
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
      startReplicaDecomposeBackgroundJob(project.id, {
        visionModelKey,
        chatModelKey: chatModelKey || undefined,
        fire: true,
      });
      const refreshed = await getDetailPageSuiteReplicaProject(project.id).catch(() => null);
      if (refreshed) setProject(refreshed);
      toast({
        title: "已开始拆解",
        message: "可在页面查看进度；超过约 3 分钟将收至右下角继续后台执行。",
      });
    } catch (e) {
      if (e instanceof DetailPageSuiteReplicaDecomposeInFlightError) {
        setProject(e.project);
        startReplicaDecomposeBackgroundJob(project.id, { fire: false });
        toast({
          title: "拆解已在进行",
          message: "请勿重复提交；见右下角 Dock。",
        });
        return;
      }
      const refreshed = await getDetailPageSuiteReplicaProject(project.id).catch(() => null);
      if (refreshed) setProject(refreshed);
      const stillRunning = isReplicaDecomposeInFlight(refreshed?.meta ?? null);
      if (stillRunning) {
        startReplicaDecomposeBackgroundJob(project.id, { fire: false });
        toast({
          title: "连接中断，拆解仍在后台进行",
          message: "请勿再次点击拆解；见右下角 Dock。",
        });
        return;
      }
      if (refreshed?.meta?.replicaStatus === "decomposed") {
        setDecomposing(false);
        toast({ title: "拆解完成" });
        return;
      }
      const raw = e instanceof Error ? e.message : "未知错误";
      const transport = /连接中断|upstream|fetch failed/i.test(raw);
      await alert({
        title: "拆解失败",
        message: transport ? formatEcomTransportError(e) : raw,
        variant: "error",
      });
      setDecomposing(false);
      stopDecomposePoll();
    } finally {
      decomposeLockRef.current = false;
    }
  }

  async function handleGeneratePrompts() {
    if (!project || generateLockRef.current) return;
    if (isReplicaDecomposeInFlight(project.meta)) {
      toast({ title: "任务进行中", message: "请稍候，页面会自动刷新进度。" });
      return;
    }
    const moduleIds = [...promptModuleIds];
    if (moduleIds.length === 0) {
      await alert({
        title: "请选择模块",
        message: "在拆解结果区勾选至少一个要生成 Prompt 的模块。",
        variant: "error",
      });
      return;
    }
    generateLockRef.current = true;
    await saveSellpointsFromDraft();
    setGeneratingPrompts(true);
    startReplicaTaskPoll(project.id, "prompts");
    try {
      const updated = await generateDetailPageSuiteReplicaPrompts(project.id, {
        moduleIds,
        chatModelKey,
      });
      stopDecomposePoll();
      setProject(updated);
      setGeneratingPrompts(false);
      setPromptSelectionKeys(new Set());
      toast({ title: "Prompt 已生成" });
    } catch (e) {
      if (e instanceof DetailPageSuiteReplicaDecomposeInFlightError) {
        setProject(e.project);
        toast({ title: "生成已在进行", message: "请勿重复提交；进度将自动同步。" });
        return;
      }
      const refreshed = await getDetailPageSuiteReplicaProject(project.id).catch(() => null);
      if (refreshed) setProject(refreshed);
      if (isReplicaDecomposeInFlight(refreshed?.meta ?? null)) {
        toast({
          title: "连接中断，生成仍在后台进行",
          message: "请勿重复点击；进度将自动刷新。",
        });
        return;
      }
      if (refreshed?.meta?.replicaStatus === "ready") {
        stopDecomposePoll();
        setGeneratingPrompts(false);
        setPromptSelectionKeys(new Set());
        toast({ title: "Prompt 已生成" });
        return;
      }
      await alert({
        title: "生成 Prompt 失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
      setGeneratingPrompts(false);
      stopDecomposePoll();
    } finally {
      generateLockRef.current = false;
    }
  }

  async function persistImageModelSettings(modelKey: string) {
    if (!project) return;
    const updated = await updateDetailPageSuiteReplicaProject(project.id, {
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
      const result = await generateDetailPageSuiteReplicaImages(project.id, {
        moduleId,
        slotKeys: keys,
        modelKey: effectiveModelKey,
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

  function uploadCardProgress(role: ReplicaUploadRole) {
    const active = uploadingRole === role;
    return {
      busy: uploadBusy || replicaBusy,
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
          const created = await createDetailPageSuiteReplicaProject();
          applyReplicaProject(created);
          setPromptSelectionKeys(new Set());
        },
      });
    },
    loadProjectList: async () => {
      const items = await listDetailPageSuiteReplicaSummaries();
      return items.map((it) => ({
        id: it.id,
        title: it.title?.trim() || "详情页套图复刻",
        updatedAt: it.updatedAt,
        thumbnailUrl: it.thumbnailUrl,
      }));
    },
    onOpenProject: (id: string) => void loadProject(id),
    onDeleteProject: async () => {
      if (
        !(await doubleConfirm({
          title: "删除当前详情页套图复刻项目？",
          message: "将删除本项目在云端保存的配置。",
          secondTitle: "确认不可恢复删除？",
          secondMessage: "删除后无法恢复；已生成的图片仍保留在「我的资产」中。",
          confirmLabel: "删除",
        }))
      ) {
        return;
      }
      await deleteDetailPageSuiteReplicaProject(project.id);
      const created = await createDetailPageSuiteReplicaProject();
      applyReplicaProject(created);
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
        await downloadDetailPageSuiteReplicaExportZip(project.id);
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
          variant="replica"
          llmBusy={replicaBusy || uploadBusy}
          {...chromeProjectHandlers}
        />
        <div className="ecom-scrollbar-overlay min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
        <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-5 py-4">
          <h1 className="mb-3 text-base font-semibold text-[#1d1d1f]">上传与拆解</h1>
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <EcomRefUploadCard
              title="参考详情长图"
              items={refsByRole.suite.map((r) => ({
                id: r.id,
                ossUrl: r.ossUrl,
                label: r.label,
                kind: "image" as const,
              }))}
              emptyHint="必填 · 整页或长条参考套图"
              multiple={false}
              {...uploadCardProgress("reference_suite")}
              onUploadFiles={(files) => void handleUpload("reference_suite", files)}
              onOpenFilePicker={() => suiteFileInputRef.current?.click()}
              inputRef={suiteFileInputRef}
              onRemove={(id) => void handleRemoveRef(id)}
              onPreviewItem={(item) => setPreviewUrl(item.ossUrl)}
            />
            <EcomRefUploadCard
              title="产品实拍"
              items={refsByRole.product.map((r) => ({
                id: r.id,
                ossUrl: r.ossUrl,
                label: r.label,
                kind: "image" as const,
              }))}
              emptyHint="必填 · 用于锁定商品与识图卖点"
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
              emptyHint="可选 · 上传或从模特库导入，出图参考模特气质"
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
                    replicaBusy ||
                    refsByRole.model.length >= REPLICA_MODEL_REF_MAX
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
            <label className="mb-1 block text-sm font-medium text-[#1d1d1f]">卖点（每行一条）</label>
            <textarea
              className="min-h-[88px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
              value={sellpointDraft}
              onChange={(e) => setSellpointDraft(e.target.value)}
              placeholder="手填卖点，或点击下方识图"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <EcomButtonSecondary
                size="sm"
                disabled={visionBusy || replicaBusy}
                onClick={() => void handleVisionSellpoints()}
              >
                AI 识图卖点
              </EcomButtonSecondary>
              <EcomButtonPrimary
                size="sm"
                disabled={replicaBusy || refsByRole.suite.length === 0}
                onClick={() => void handleDecompose()}
              >
                {replicaBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                拆解
              </EcomButtonPrimary>
            </div>
            {showVisionSellpointProgress ? (
              <EcomLinearProgressLabel
                className="mt-2"
                progress={visionSellpointProgressPercent(visionSellpointJob)}
                label={visionSellpointProgressLabel(visionSellpointJob)}
              />
            ) : null}
          </div>
          {replicaBusy && decomposeProgressCopy ? (
            <StoryboardTaskStatus
              active
              sweep
              title={decomposeProgressCopy.title}
              detail={
                decomposeProgressCopy.detail ||
                "拆解为 1 次 Vision；生成 Prompt 为 1 次文本模型（含所选全部模块）。"
              }
            />
          ) : null}
          {project.meta?.replicaError ? (
            <p className="text-sm text-red-600">{project.meta.replicaError}</p>
          ) : null}
          {project.meta?.replicaWarning ? (
            <p className="mt-2 text-xs text-amber-800">{project.meta.replicaWarning}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-[#86868b]">
            拆解仅依赖参考长图；产品/模特用于卖点识图与出图，可在拆解后补传。
          </p>
        </div>

        {inventorySegments?.length ? (
          <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-5 py-3">
            <h2 className="text-sm font-semibold">
              画面清单（{inventorySegments.length} 条 · 自上而下）
            </h2>
            <p className="mt-1 text-[11px] text-[#86868b]">
              先完整列段，再归入 12 模块；待归类项请选择模块后才会进入下方模块拆解与润色。
            </p>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
              {inventorySegments.map((seg) => {
                const mapped = segmentMapping[seg.item_key]?.module_id ?? "";
                const pending = !mapped;
                const copyLines = formatReferenceCopyHints(seg.referenceCopyHints);
                const detailLines = formatVisualDetailLines(seg.visualDetail);
                return (
                  <li
                    key={seg.item_key}
                    className="rounded-lg border border-[#e8e8ed] bg-white p-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#1d1d1f]">
                        #{seg.segmentIndex ?? "—"} {seg.item_label}
                      </span>
                      {pending ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                          待归类
                        </span>
                      ) : null}
                      <select
                        className="ml-auto max-w-[220px] rounded-md border border-[#d2d2d7] bg-white px-2 py-1 text-[11px]"
                        disabled={replicaBusy || segmentAssignBusyKey === seg.item_key}
                        value={mapped}
                        onChange={(e) => {
                          const moduleId = e.target.value || null;
                          void (async () => {
                            if (!project) return;
                            setSegmentAssignBusyKey(seg.item_key);
                            try {
                              const updated = await assignDetailPageSuiteReplicaSegmentModule(
                                project.id,
                                { itemKey: seg.item_key, moduleId },
                              );
                              setProject(updated);
                              phaseAInitRef.current = null;
                              const modules = readPhaseA(updated);
                              if (modules?.length) {
                                setPromptModuleIds(new Set(defaultPromptModuleIds(modules)));
                                phaseAInitRef.current = updated.id;
                              }
                            } catch (err) {
                              await alert({
                                title: "保存归类失败",
                                message: err instanceof Error ? err.message : "未知错误",
                                variant: "error",
                              });
                            } finally {
                              setSegmentAssignBusyKey(null);
                            }
                          })();
                        }}
                      >
                        <option value="">选择模块…</option>
                        {modulePickOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {seg.layoutHint ? (
                      <p className="mt-1 text-[#6e6e73]">版式：{seg.layoutHint}</p>
                    ) : null}
                    {copyLines.length ? (
                      <p className="mt-1 text-[#424245]">参考文案：{copyLines.join(" / ")}</p>
                    ) : null}
                    {detailLines.length ? (
                      <ul className="mt-0.5 list-disc pl-4 text-[#6e6e73]">
                        {detailLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {phaseA ? (
          <div className="border-b border-[#e8e8ed] bg-white px-5 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">按模块汇总（只读）</h2>
              <div className="flex flex-wrap items-center gap-2">
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={replicaBusy || allPhaseAModuleIds.length === 0}
                  onClick={() => setPromptModuleIds(new Set(allPhaseAModuleIds))}
                >
                  全选模块
                </EcomButtonSecondary>
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={replicaBusy}
                  onClick={() => setPromptModuleIds(new Set())}
                >
                  清空
                </EcomButtonSecondary>
                <EcomButtonPrimary
                  size="sm"
                  type="button"
                  disabled={replicaBusy || promptModuleIds.size === 0}
                  onClick={() => void handleGeneratePrompts()}
                >
                  {generatingPrompts ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  生成 Prompt（{promptModuleIds.size} 模块 · 单次）
                </EcomButtonPrimary>
              </div>
            </div>
            <div className="space-y-2 text-xs text-[#424245]">
              {phaseA.map((m) => (
                <div key={m.module_id} className="rounded-lg border border-[#e8e8ed] p-2">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={promptModuleIds.has(m.module_id)}
                      disabled={replicaBusy}
                      onChange={(e) => {
                        setPromptModuleIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.module_id);
                          else next.delete(m.module_id);
                          return next;
                        });
                      }}
                    />
                    <span className="font-medium">
                      {m.module_id} {m.detected ? "" : "· 未识别"}
                      {m.items?.length ? ` · ${m.items.length} 条` : ""}
                    </span>
                  </label>
                  {m.coverageNote ? <p className="text-[#6e6e73]">{m.coverageNote}</p> : null}
                  {m.items?.length ? (
                    <ul className="mt-1 space-y-2">
                      {m.items.map((it, i) => {
                        const copyLines = formatReferenceCopyHints(it.referenceCopyHints);
                        const detailLines = formatVisualDetailLines(it.visualDetail);
                        return (
                          <li key={i} className="list-none rounded-md bg-[#f5f5f7] px-2 py-1.5">
                            <div className="font-medium text-[#1d1d1f]">{it.item_label}</div>
                            {it.layoutHint ? (
                              <p className="text-[#6e6e73]">版式：{it.layoutHint}</p>
                            ) : null}
                            {copyLines.length ? (
                              <div className="mt-1">
                                <p className="text-[11px] font-medium text-[#1d1d1f]">参考文案</p>
                                <ul className="mt-0.5 list-disc pl-4 text-[#424245]">
                                  {copyLines.map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {detailLines.length ? (
                              <ul className="mt-0.5 list-disc pl-4 text-[#424245]">
                                {detailLines.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="ml-6 text-[#86868b]">无</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

          <DetailPageSuiteContentPanel
            variant="replica"
            hideHeader
            project={project}
            llmBusy={replicaBusy || uploadBusy}
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
            onOpenPromptEdit={(moduleId, slotKey, prompt, label) => {
              if (isDetailPageSuiteSizeChartDataLabel(label)) {
                setSizeChartEdit({ moduleId, slotKey, label });
                return;
              }
              setPromptEdit({ moduleId, slotKey, prompt, label });
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
                    const updated = await updateDetailPageSuiteReplicaProject(project.id, {
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
              const updated = await updateDetailPageSuiteReplicaProject(project.id, {
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
        onOpenChange={(open) => {
          if (!open) setPromptEdit(null);
        }}
        onSave={async (prompt) => {
          if (!promptEdit || !project) return;
          const modules = project.suite.modules.map((m) => {
            if (m.module_id !== promptEdit.moduleId) return m;
            return {
              ...m,
              slots: m.slots.map((s) =>
                s.item_key === promptEdit.slotKey
                  ? { ...s, positive_prompt: prompt, promptEdited: true }
                  : s,
              ),
            };
          });
          const updated = await updateDetailPageSuiteReplicaProject(project.id, {
            suite: { ...project.suite, modules },
          });
          setProject(updated);
          setPromptEdit(null);
        }}
      />

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
              const updated = await updateDetailPageSuiteReplicaProject(project.id, { brief });
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
    </EcomWorkspaceLayout>
  );
}

export function DetailPageSuiteReplicaStudio() {
  return (
    <BackgroundGenerationProvider>
      <DetailPageSuiteReplicaStudioInner />
    </BackgroundGenerationProvider>
  );
}
